const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config', 'domains.json');
const PROXY_PORT = process.env.PROXY_PORT || 3128;
const MODE = process.env.MODE || 'direct';

let domains = [];

function loadConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    domains = config.domains || [];
    console.log(`[${new Date().toISOString()}] Loaded ${domains.filter(d => d.active).length} active domains`);
  } catch (error) {
    console.error('Error loading config:', error.message);
  }
}

function shouldProxy(hostname) {
  for (const domain of domains) {
    if (!domain.active) continue;
    
    if (domain.pattern.startsWith('*.') || domain.pattern.startsWith('*')) {
      const base = domain.pattern.replace(/^\*\.?/, '');
      if (hostname === base || hostname.endsWith('.' + base)) {
        return true;
      }
    } else {
      if (hostname === domain.pattern || hostname.endsWith('.' + domain.pattern)) {
        return true;
      }
    }
  }
  return false;
}

function handleConnect(req, clientSocket, head) {
  const [hostname, port] = req.url.split(':');
  const targetPort = parseInt(port) || 443;

  console.log(`[${new Date().toISOString()}] CONNECT ${hostname}:${targetPort} [${MODE}]`);

  if (MODE === 'direct') {
    const targetSocket = net.connect({
      host: hostname,
      port: targetPort
    }, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      targetSocket.write(head);
      clientSocket.write(head);
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    targetSocket.on('error', (err) => {
      console.error(`Target error: ${err.message}`);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.end();
    });

    clientSocket.on('error', (err) => {
      console.error(`Client error: ${err.message}`);
      targetSocket.end();
    });

    targetSocket.on('close', () => clientSocket.end());
    clientSocket.on('close', () => targetSocket.end());
  } else {
    const tunnelHost = process.env.TUNNEL_HOST || '127.0.0.1';
    const tunnelPort = parseInt(process.env.TUNNEL_PORT) || 1080;
    
    const targetSocket = net.connect({
      host: tunnelHost,
      port: tunnelPort
    }, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      targetSocket.write(head);
      clientSocket.write(head);
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    targetSocket.on('error', (err) => {
      console.error(`Tunnel error: ${err.message}`);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.end();
    });

    clientSocket.on('error', (err) => {
      console.error(`Client error: ${err.message}`);
      targetSocket.end();
    });

    targetSocket.on('close', () => clientSocket.end());
    clientSocket.on('close', () => targetSocket.end());
  }
}

function handleHttp(req, clientSocket) {
  const hostname = req.headers.host?.split(':')[0];
  const url = new URL(req.url, `http://${hostname}`);

  console.log(`[${new Date().toISOString()}] HTTP ${req.method} ${hostname}${url.pathname} [${MODE}]`);

  if (MODE === 'direct') {
    const targetSocket = net.connect({
      host: hostname,
      port: parseInt(req.headers.host?.split(':')[1]) || 80
    }, () => {
      const request = `${req.method} ${url.pathname}${url.search} HTTP/1.1\r\n`;
      const headers = Object.entries(req.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');
      targetSocket.write(request + headers + '\r\n\r\n');
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    targetSocket.on('error', (err) => {
      console.error(`HTTP target error: ${err.message}`);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.end();
    });
  } else {
    const tunnelHost = process.env.TUNNEL_HOST || '127.0.0.1';
    const tunnelPort = parseInt(process.env.TUNNEL_PORT) || 1080;
    
    const targetSocket = net.connect({
      host: tunnelHost,
      port: tunnelPort
    }, () => {
      const request = `${req.method} ${url.pathname}${url.search} HTTP/1.1\r\n`;
      const headers = Object.entries(req.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');
      targetSocket.write(request + headers + '\r\n\r\n');
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    targetSocket.on('error', (err) => {
      console.error(`Tunnel error: ${err.message}`);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.end();
    });
  }
}

const server = http.createServer();

server.on('connect', handleConnect);
server.on('request', handleHttp);

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[${new Date().toISOString()}] GeoProxy server running on 127.0.0.1:${PROXY_PORT}`);
  console.log(`[${new Date().toISOString()}] Mode: ${MODE}`);
  if (MODE !== 'direct') {
    console.log(`[${new Date().toISOString()}] Tunnel: ${process.env.TUNNEL_HOST || '127.0.0.1'}:${process.env.TUNNEL_PORT || 1080}`);
  }
  loadConfig();
});

setInterval(loadConfig, 30000);

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close();
});

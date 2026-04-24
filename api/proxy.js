export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  
  if (url.pathname === '/health' || url.pathname === '/') {
    return new Response(JSON.stringify({ 
      status: 'geo-proxy running',
      mode: 'blacklist',
      usage: '/api/proxy?h=example.com/path'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  let target = url.searchParams.get('h');
  if (!target) {
    return new Response(JSON.stringify({ 
      error: 'Missing ?h= parameter',
      usage: '/api/proxy?h=example.com/path'
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  target = decodeURIComponent(target);
  const parsed = parseTarget(target);
  
  if (!parsed) {
    return new Response(JSON.stringify({ error: 'Invalid target' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const targetUrl = `https://${parsed.host}${parsed.path}${parsed.query}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: buildHeaders(req.headers),
      redirect: 'follow',
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'content-encoding', 'content-length', 'connection'].includes(key.toLowerCase())) {
        responseHeaders.append(key, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: `Proxy error: ${error.message}` }), { 
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function parseTarget(target) {
  if (!target) return null;
  target = target.replace(/&amp;/g, '&');
  
  let host = target;
  let path = '';
  let query = '';
  
  const atIndex = host.indexOf('/');
  if (atIndex > -1) {
    const pathPart = host.slice(atIndex);
    host = host.slice(0, atIndex);
    
    const qIndex = pathPart.indexOf('?');
    if (qIndex > -1) {
      path = pathPart.slice(0, qIndex);
      query = pathPart.slice(qIndex);
    } else {
      path = pathPart;
    }
  }
  
  return { host, path, query };
}

function buildHeaders(requestHeaders) {
  const headers = new Headers();
  
  requestHeaders.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!['host', 'connection', 'content-length', 'content-type'].includes(lowerKey)) {
      headers.set(key, value);
    }
  });

  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }
  
  if (!headers.has('Accept')) {
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8');
  }
  
  return headers;
}
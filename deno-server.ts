const ALLOWED_DOMAINS = [
  "*.anthropic.com",
  "*.claude.ai",
  "*.openai.com",
  "*.ai.google.com",
  "*.googleapis.com",
  "*.googleusercontent.com",
  "generativelanguage.googleapis.com",
  "*.github.com",
  "*.githubusercontent.com",
  "*.ollama.com",
  "api.aitoken.dev",
  "*.ankiapi.xyz",
  "*.anki-sync.com",
  "claude.desktop",
  "httpbin.org",
  "*.httpbin.org",
];

const BLOCKED_IPS = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
];

function isDomainAllowed(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  
  for (const pattern of ALLOWED_DOMAINS) {
    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      if (normalizedHost === base || normalizedHost.endsWith("." + base)) {
        return true;
      }
    } else if (normalizedHost === pattern) {
      return true;
    }
  }
  return false;
}

function isIpBlocked(ip: string): boolean {
  return BLOCKED_IPS.some((block) => ip.startsWith(block.split("/")[0]));
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let targetHost = url.searchParams.get("h");
  let targetPath = "";
  let targetQuery = "";
  
  if (targetHost) {
    targetHost = decodeURIComponent(targetHost);
    
    const atIndex = targetHost.indexOf("/");
    if (atIndex > -1) {
      const pathPart = targetHost.slice(atIndex);
      targetHost = targetHost.slice(0, atIndex);
      
      const qIndex = pathPart.indexOf("?");
      if (qIndex > -1) {
        targetPath = pathPart.slice(0, qIndex);
        targetQuery = pathPart.slice(qIndex);
      } else {
        targetPath = pathPart;
      }
    }
  }
  
  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ 
      status: "ok", 
      allowedDomains: ALLOWED_DOMAINS.length 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  if (!targetHost) {
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(JSON.stringify({ 
        status: "geo-proxy running",
        usage: "/?h=example.com/path"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ 
      error: "Missing ?h= parameter",
      usage: "/?h=example.com/path"
    }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!isDomainAllowed(targetHost)) {
    return new Response(JSON.stringify({ error: `Domain not allowed: ${targetHost}` }), { 
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const targetUrl = `https://${targetHost}${targetPath}${targetQuery}`;
  
  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (key !== "host" && key !== "connection") {
        headers[key] = value;
      }
    });
    headers["Host"] = targetHost;
    headers["X-Forwarded-For"] = req.headers.get("cf-connecting-ip") || "unknown";
    headers["X-Forwarded-Proto"] = "https";

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.body,
      redirect: "follow",
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!["transfer-encoding", "content-encoding", "content-length"].includes(key.toLowerCase())) {
        responseHeaders.append(key, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`Proxy error: ${error}`);
    return new Response(`Proxy error: ${error.message}`, { status: 502 });
  }
}

Deno.serve(handler);

const PROXY_HOST = 'localhost';
const PROXY_PORT = 3000;
const STORAGE_KEY = 'geoproxy_domains';
const USE_DENO_DEPLOY = true;
const DENO_DEPLOY_URL = 'https://geo-proxy-rf-rrtnrdjztkjv.t-h-s-o-c.deno.net';

let domains = [];
let proxyUrl = USE_DENO_DEPLOY ? DENO_DEPLOY_URL : `http://${PROXY_HOST}:${PROXY_PORT}`;

function matchesDomain(hostname) {
  for (const domain of domains) {
    if (!domain.active) continue;
    
    const pattern = domain.pattern;
    if (pattern.startsWith('*.')) {
      const base = pattern.slice(2);
      if (hostname === base || hostname.endsWith('.' + base)) return true;
    } else if (pattern.startsWith('*')) {
      const base = pattern.slice(1);
      if (hostname.endsWith(base)) return true;
    } else {
      if (hostname === pattern || hostname.endsWith('.' + pattern)) return true;
    }
  }
  return false;
}

function setupWebRequest() {
  chrome.webRequest.onBeforeRequest.removeListener(handleRequest);
  chrome.webRequest.onBeforeRequest.addListener(
    handleRequest,
    { urls: ['<all_urls>'] },
    ['blocking']
  );
}

function handleRequest(request) {
  const url = new URL(request.url);
  const hostname = url.hostname;
  
  if (matchesDomain(hostname)) {
    const proxyTarget = `${hostname}${url.pathname}${url.search}`;
    const redirectUrl = `${proxyUrl}/?h=${encodeURIComponent(proxyTarget)}`;
    
    console.log(`Redirecting: ${hostname} -> ${proxyUrl}`);
    
    return { redirectUrl };
  }
  
  return {};
}

async function updateProxyConfig() {
  try {
    setupWebRequest();
    console.log(`Proxy updated: ${domains.filter(d => d.active).length} active domains`);
  } catch (error) {
    console.error('Failed to update proxy:', error);
  }
}

async function loadDomains() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    domains = result[STORAGE_KEY] || [];
    await updateProxyConfig();
  } catch (error) {
    console.error('Failed to load domains:', error);
    domains = [];
  }
}

async function saveDomains() {
  await chrome.storage.local.set({ [STORAGE_KEY]: domains });
  await updateProxyConfig();
}

function matchesPattern(hostname, pattern) {
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2);
    return hostname === base || hostname.endsWith('.' + base);
  } else if (pattern.startsWith('*')) {
    const base = pattern.slice(1);
    return hostname.endsWith(base);
  }
  return hostname === pattern || hostname.endsWith('.' + pattern);
}

async function addDomain(pattern, description = '') {
  const cleanPattern = pattern.trim().toLowerCase();
  const exists = domains.find(d => d.pattern === cleanPattern);
  
  if (exists) {
    exists.active = true;
  } else {
    domains.unshift({
      pattern: cleanPattern,
      description: description || '',
      active: true,
      addedAt: new Date().toISOString()
    });
  }
  
  await saveDomains();
  return domains.find(d => d.pattern === cleanPattern);
}

async function removeDomain(pattern) {
  const index = domains.findIndex(d => d.pattern === pattern);
  if (index !== -1) {
    domains.splice(index, 1);
    await saveDomains();
  }
}

async function toggleDomain(pattern) {
  const domain = domains.find(d => d.pattern === pattern);
  if (domain) {
    domain.active = !domain.active;
    domain.updatedAt = new Date().toISOString();
    await saveDomains();
    return domain;
  }
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_DOMAINS':
        sendResponse({ domains });
        break;
        
      case 'ADD_DOMAIN':
        const added = await addDomain(message.pattern, message.description);
        sendResponse({ success: true, domain: added });
        break;
        
      case 'REMOVE_DOMAIN':
        await removeDomain(message.pattern);
        sendResponse({ success: true });
        break;
        
      case 'TOGGLE_DOMAIN':
        const toggled = await toggleDomain(message.pattern);
        sendResponse({ success: true, domain: toggled });
        break;
        
      case 'UPDATE_DOMAIN':
        const domain = domains.find(d => d.pattern === message.pattern);
        if (domain) {
          if (message.description !== undefined) domain.description = message.description;
          if (message.active !== undefined) domain.active = message.active;
          await saveDomains();
          sendResponse({ success: true, domain });
        } else {
          sendResponse({ success: false, error: 'Domain not found' });
        }
        break;
        
      case 'IMPORT_DOMAINS':
        const imported = [];
        for (const item of message.domains) {
          const pattern = typeof item === 'string' ? item : item.pattern;
          const desc = typeof item === 'object' ? (item.description || '') : '';
          const active = typeof item === 'object' ? (item.active !== false) : true;
          
          if (!domains.find(d => d.pattern === pattern)) {
            domains.push({ pattern, description: desc, active, addedAt: new Date().toISOString() });
            imported.push(pattern);
          }
        }
        await saveDomains();
        sendResponse({ success: true, imported, total: imported.length });
        break;
        
      case 'GET_STATUS':
        sendResponse({
          enabled: true,
          domainCount: domains.length,
          activeCount: domains.filter(d => d.active).length,
          proxyUrl: proxyUrl
        });
        break;
    }
  })();
  return true;
});

chrome.proxy.onProxyError.addListener((details) => {
  console.error('Proxy error:', details.error);
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadDomains();
  
  if (domains.length === 0) {
    try {
      const response = await fetch(chrome.runtime.getURL('domains.json'));
      if (response.ok) {
        const defaultDomains = await response.json();
        domains = defaultDomains;
        await saveDomains();
      }
    } catch (e) {
      console.error('Failed to load default domains:', e);
    }
  }
});

loadDomains();

setInterval(loadDomains, 30000);

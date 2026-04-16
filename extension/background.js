const PROXY_HOST = 'localhost';
const PROXY_PORT = 3000;
const STORAGE_KEY = 'geoproxy_domains';
const USE_DENO_DEPLOY = true;
const DENO_DEPLOY_URL = 'https://geo-proxy-rf.t-h-s-o-c.deno.net';

let domains = [];
let proxyUrl = USE_DENO_DEPLOY ? DENO_DEPLOY_URL : `http://${PROXY_HOST}:${PROXY_PORT}`;

const RULE_ID_START = 1;

async function updateProxyRules() {
  const rules = [];
  let ruleId = RULE_ID_START;

  for (const domain of domains) {
    if (!domain.active) continue;
    
    let pattern = domain.pattern;
    let cleanPattern;
    let urlFilter;
    
    if (pattern.startsWith('*.')) {
      cleanPattern = pattern.slice(2);
      urlFilter = `.*\\.${cleanPattern.replace(/\./g, '\\.')}.*`;
    } else if (pattern.startsWith('*')) {
      cleanPattern = pattern.slice(1);
      urlFilter = `.*${cleanPattern.replace(/\./g, '\\.')}.*`;
    } else {
      cleanPattern = pattern;
      urlFilter = `.*${cleanPattern.replace(/\./g, '\\.')}.*`;
    }
    
    rules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: `${proxyUrl}/?h=${encodeURIComponent(cleanPattern)}`
        }
      },
      condition: {
        urlFilter: urlFilter,
        resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'stylesheet']
      }
    });
  }

  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map(r => r.id);
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: rules
    });
    console.log(`Proxy rules updated: ${rules.length} rules`);
  } catch (error) {
    console.error('Failed to update rules:', error);
  }
}

async function loadDomains() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    domains = result[STORAGE_KEY] || [];
    await updateProxyRules();
  } catch (error) {
    console.error('Failed to load domains:', error);
    domains = [];
  }
}

async function saveDomains() {
  await chrome.storage.local.set({ [STORAGE_KEY]: domains });
  await updateProxyRules();
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

const PROXY_URL = 'https://geo-proxy-delta.vercel.app/api/proxy?h=';

const DEFAULT_WHITELIST = [
  '*.anthropic.com',
  '*.claude.ai', 
  '*.openai.com',
  '*.google.com',
  '*.googleapis.com',
  '*.github.com',
  '*.githubusercontent.com',
  '*.ollama.com',
  'api.aitoken.dev',
  'httpbin.org',
];

const DEFAULT_BLACKLIST = [
  { pattern: '*.ru', description: 'Russia TLD', active: true },
  { pattern: '*.рф', description: 'Russia TLD (Cyrillic)', active: true },
];

let whitelist = DEFAULT_WHITELIST;
let blacklist = DEFAULT_BLACKLIST;
let proxyEnabled = true;

async function loadSettings() {
  const stored = await chrome.storage.local.get(['whitelist', 'blacklist', 'proxyEnabled']);
  whitelist = stored.whitelist || DEFAULT_WHITELIST;
  blacklist = stored.blacklist || DEFAULT_BLACKLIST;
  proxyEnabled = stored.proxyEnabled !== false;
  
  updateProxyRules();
}

async function updateProxyRules() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = rules.map(r => r.id);
    
    if (existingIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingIds,
        addRules: []
      });
    }
    
    if (!proxyEnabled) {
      console.log('Proxy disabled');
      return;
    }

    const blockedPatterns = blacklist.filter(d => d.active).map(d => d.pattern);
    const allowedPatterns = whitelist;
    
    const newRules = [];
    const baseId = Math.floor(Math.random() * 90000) + 10000;
    
    // Block Russian TLDs
    blockedPatterns.forEach((pattern, index) => {
      const urlPattern = patternToUrlPattern(pattern);
      
      newRules.push({
        id: baseId + index,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: urlPattern,
          resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'stylesheet']
        }
      });
    });
    
    // Redirect allowed domains to proxy
    allowedPatterns.forEach((pattern, index) => {
      const urlPattern = patternToUrlPattern(pattern);
      
      newRules.push({
        id: baseId + 100 + index,
        priority: 2,
        action: { 
          type: 'redirect',
          redirect: { url: PROXY_URL + '<url>' }
        },
        condition: {
          urlFilter: urlPattern,
          resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'stylesheet']
        }
      });
    });

    if (newRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules
      });
    }
    
    console.log('Rules updated:', newRules.length);
  } catch (error) {
    console.error('Error:', error.message || error);
  }
}

function patternToUrlPattern(pattern) {
  let urlPattern = pattern.replace(/\./g, '\\.');
  urlPattern = urlPattern.replace(/\*/g, '.*');
  return urlPattern;
}

function isBlacklisted(hostname) {
  const normalized = hostname.toLowerCase();
  for (const item of blacklist) {
    if (!item.active) continue;
    
    const pattern = item.pattern.toLowerCase();
    if (pattern.startsWith('*.')) {
      const base = pattern.slice(2);
      if (normalized === base || normalized.endsWith('.' + base)) {
        return true;
      }
    } else if (normalized === pattern) {
      return true;
    }
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    chrome.storage.local.get(['proxyUrl'], (result) => {
      sendResponse({
        active: true,
        proxyUrl: result.proxyUrl || PROXY_URL,
        domainCount: blacklist.filter(d => d.active).length,
        status: 'active'
      });
    });
    return true;
  }
  
  if (message.type === 'GET_DOMAINS') {
    sendResponse({ domains: blacklist });
    return true;
  }
  
  if (message.type === 'ADD_DOMAIN') {
    const exists = blacklist.find(d => d.pattern === message.pattern);
    if (!exists) {
      blacklist.push({
        pattern: message.pattern,
        description: message.description || 'Custom',
        active: true
      });
    } else {
      exists.active = true;
    }
    chrome.storage.local.set({ blacklist });
    updateProxyRules();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'REMOVE_DOMAIN') {
    blacklist = blacklist.filter(d => d.pattern !== message.pattern);
    chrome.storage.local.set({ blacklist });
    updateProxyRules();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'TOGGLE_DOMAIN') {
    const domain = blacklist.find(d => d.pattern === message.pattern);
    if (domain) {
      domain.active = !domain.active;
      chrome.storage.local.set({ blacklist });
      updateProxyRules();
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'IMPORT_DOMAINS') {
    const newDomains = message.domains.map(pattern => ({
      pattern,
      description: 'Imported',
      active: true
    }));
    
    newDomains.forEach(newDomain => {
      const exists = blacklist.find(d => d.pattern === newDomain.pattern);
      if (!exists) {
        blacklist.push(newDomain);
      } else {
        exists.active = true;
      }
    });
    
    chrome.storage.local.set({ blacklist });
    updateProxyRules();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        sendResponse({
          hostname,
          isBlacklisted: isBlacklisted(hostname)
        });
      } else {
        sendResponse({ hostname: null, isBlacklisted: false });
      }
    });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  loadSettings();
});

chrome.runtime.onStartup.addListener(() => {
  loadSettings();
});

loadSettings();
const PROXY_URL = 'https://geo-proxy-delta.vercel.app/api/proxy';

const DEFAULT_BLACKLIST = [
  { pattern: '*.ru', description: 'Russia TLD', active: true },
  { pattern: '*.рф', description: 'Russia TLD (Cyrillic)', active: true },
];

let blacklist = [];
let proxyUrl = PROXY_URL;

async function loadBlacklist() {
  const stored = await chrome.storage.local.get(['blacklist', 'proxyUrl']);
  blacklist = stored.blacklist || DEFAULT_BLACKLIST;
  proxyUrl = stored.proxyUrl || PROXY_URL;
  
  if (!stored.blacklist) {
    await chrome.storage.local.set({ blacklist: DEFAULT_BLACKLIST });
  }
  
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

    const blacklistPatterns = blacklist.filter(d => d.active).map(d => d.pattern);
    
    const newRules = [];
    const baseId = Date.now() % 100000;
    
    blacklistPatterns.forEach((pattern, index) => {
      const urlPattern = patternToUrlPattern(pattern);
      
      newRules.push({
        id: baseId + index,
        priority: 1,
        action: { type: 'direct' },
        condition: {
          urlFilter: urlPattern,
          resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'stylesheet', 'object', 'ping', 'csp_report', 'media', 'websocket', 'other']
        }
      });
    });

    if (newRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules
      });
    }
    
    console.log('Proxy rules updated:', newRules.length, 'rules');
  } catch (error) {
    console.error('Error updating proxy rules:', error);
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
  loadBlacklist();
});

chrome.runtime.onStartup.addListener(() => {
  loadBlacklist();
});

loadBlacklist();
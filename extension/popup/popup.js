document.addEventListener('DOMContentLoaded', init);

let currentHostname = null;

async function init() {
  await loadStatus();
  await loadCurrentTab();
  await loadDomains();
  setupEventListeners();
}

async function loadStatus() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
  
  const indicator = document.getElementById('statusIndicator');
  const domainCount = document.getElementById('domainCount');
  const activeCount = document.getElementById('activeCount');
  
  if (response.enabled) {
    indicator.classList.add('active');
    indicator.querySelector('.status-text').textContent = 'Active';
  } else {
    indicator.classList.remove('active');
    indicator.querySelector('.status-text').textContent = 'Inactive';
  }
  
  domainCount.textContent = response.domainCount || 0;
  activeCount.textContent = response.activeCount || 0;
}

async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url && tab.url.startsWith('http')) {
      const url = new URL(tab.url);
      currentHostname = url.hostname;
      
      const domainCard = document.getElementById('currentDomain');
      const domainName = domainCard.querySelector('.domain-name');
      const domainStatus = domainCard.querySelector('.domain-status');
      const addBtn = document.getElementById('addCurrentBtn');
      
      domainName.textContent = currentHostname;
      
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DOMAINS'
      });
      
      const isProxied = response.domains?.some(d => 
        d.active && matchesPattern(currentHostname, d.pattern)
      );
      
      if (isProxied) {
        domainStatus.innerHTML = '<span class="badge badge-active">Proxied</span>';
        addBtn.style.display = 'none';
      } else {
        domainStatus.innerHTML = '<span class="badge badge-default">Not Proxied</span>';
        addBtn.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Failed to load current tab:', error);
  }
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

async function loadDomains() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_DOMAINS' });
  const list = document.getElementById('domainList');
  
  if (!response.domains || response.domains.length === 0) {
    list.innerHTML = '<div class="empty-state">No domains yet</div>';
    return;
  }
  
  const activeDomains = response.domains.filter(d => d.active).slice(0, 10);
  
  if (activeDomains.length === 0) {
    list.innerHTML = '<div class="empty-state">No active domains</div>';
    return;
  }
  
  list.innerHTML = activeDomains.map(domain => `
    <div class="domain-item" data-pattern="${escapeHtml(domain.pattern)}">
      <div class="domain-item-name">${escapeHtml(domain.pattern)}</div>
      <div class="domain-item-actions">
        <button class="btn btn-icon btn-small" data-action="delete" data-pattern="${escapeHtml(domain.pattern)}" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
  
  list.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const pattern = e.currentTarget.dataset.pattern;
      await chrome.runtime.sendMessage({ type: 'REMOVE_DOMAIN', pattern });
      await loadStatus();
      await loadDomains();
    });
  });
}

function setupEventListeners() {
  document.getElementById('addCurrentBtn').addEventListener('click', async () => {
    if (!currentHostname) return;
    
    await chrome.runtime.sendMessage({
      type: 'ADD_DOMAIN',
      pattern: currentHostname
    });
    
    await loadStatus();
    await loadCurrentTab();
    await loadDomains();
  });
  
  document.getElementById('refreshBtn').addEventListener('click', async (e) => {
    const icon = e.currentTarget.querySelector('svg');
    icon.classList.add('loading');
    
    await loadStatus();
    await loadCurrentTab();
    await loadDomains();
    
    setTimeout(() => icon.classList.remove('loading'), 500);
  });
  
  document.getElementById('openEditorBtn').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('editor/editor.html')
    });
  });
  
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importModal').classList.add('active');
    document.getElementById('importTextarea').focus();
  });
  
  document.getElementById('closeImport').addEventListener('click', () => {
    document.getElementById('importModal').classList.remove('active');
  });
  
  document.getElementById('cancelImport').addEventListener('click', () => {
    document.getElementById('importModal').classList.remove('active');
  });
  
  document.getElementById('confirmImport').addEventListener('click', async () => {
    const textarea = document.getElementById('importTextarea');
    const text = textarea.value.trim();
    
    if (!text) return;
    
    let domains;
    try {
      if (text.startsWith('[')) {
        domains = JSON.parse(text);
      } else {
        domains = text.split('\n').map(d => d.trim()).filter(Boolean);
      }
    } catch (e) {
      alert('Invalid format. Please use JSON array or one domain per line.');
      return;
    }
    
    const response = await chrome.runtime.sendMessage({
      type: 'IMPORT_DOMAINS',
      domains
    });
    
    textarea.value = '';
    document.getElementById('importModal').classList.remove('active');
    
    await loadStatus();
    await loadDomains();
  });
  
  document.getElementById('importModal').addEventListener('click', (e) => {
    if (e.target.id === 'importModal') {
      document.getElementById('importModal').classList.remove('active');
    }
  });
  
  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('editor/editor.html')
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

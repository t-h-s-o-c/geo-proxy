document.addEventListener('DOMContentLoaded', async () => {
  const currentDomainEl = document.getElementById('currentDomain');
  const currentDomainStatusEl = document.getElementById('currentDomainStatus');
  const blacklistCountEl = document.getElementById('blacklistCount');
  const addToBlacklistBtn = document.getElementById('addToBlacklistBtn');
  const openEditorBtn = document.getElementById('openEditorBtn');

  async function loadStatus() {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    const currentTab = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' });
    const domains = await chrome.runtime.sendMessage({ type: 'GET_DOMAINS' });
    
    if (currentTab.hostname) {
      currentDomainEl.textContent = currentTab.hostname;
      
      if (currentTab.isBlacklisted) {
        currentDomainStatusEl.innerHTML = '<span class="badge direct">DIRECT</span>';
        addToBlacklistBtn.textContent = 'Remove from Blacklist';
        addToBlacklistBtn.classList.add('danger');
      } else {
        currentDomainStatusEl.innerHTML = '<span class="badge proxy">PROXY</span>';
        addToBlacklistBtn.textContent = 'Add to Blacklist';
        addToBlacklistBtn.classList.remove('danger');
      }
    } else {
      currentDomainEl.textContent = 'No active tab';
      currentDomainStatusEl.innerHTML = '-';
    }
    
    const activeCount = domains.domains.filter(d => d.active).length;
    blacklistCountEl.textContent = activeCount;
  }

  addToBlacklistBtn.addEventListener('click', async () => {
    const currentTab = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' });
    
    if (!currentTab.hostname) return;
    
    if (currentTab.isBlacklisted) {
      await chrome.runtime.sendMessage({ 
        type: 'REMOVE_DOMAIN', 
        pattern: currentTab.hostname 
      });
    } else {
      await chrome.runtime.sendMessage({ 
        type: 'ADD_DOMAIN', 
        pattern: currentTab.hostname,
        description: 'Added from popup' 
      });
    }
    
    await loadStatus();
  });

  openEditorBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'editor/editor.html' });
  });

  loadStatus();
});
document.addEventListener('DOMContentLoaded', async () => {
  const searchInput = document.getElementById('searchInput');
  const newDomainInput = document.getElementById('newDomainInput');
  const addDomainBtn = document.getElementById('addDomainBtn');
  const presetRuBtn = document.getElementById('presetRuBtn');
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const domainList = document.getElementById('domainList');
  const totalCount = document.getElementById('totalCount');
  const activeCount = document.getElementById('activeCount');
  const inactiveCount = document.getElementById('inactiveCount');
  
  const importModal = document.getElementById('importModal');
  const exportModal = document.getElementById('exportModal');
  const importTextarea = document.getElementById('importTextarea');
  const exportTextarea = document.getElementById('exportTextarea');
  const closeImportModal = document.getElementById('closeImportModal');
  const closeExportModal = document.getElementById('closeExportModal');
  const confirmImportBtn = document.getElementById('confirmImportBtn');
  const copyExportBtn = document.getElementById('copyExportBtn');

  let domains = [];

  async function loadDomains() {
    domains = await chrome.runtime.sendMessage({ type: 'GET_DOMAINS' });
    renderDomains();
    updateStats();
  }

  function renderDomains() {
    const filter = searchInput.value.toLowerCase();
    const filtered = domains.filter(d => 
      d.pattern.toLowerCase().includes(filter) || 
      d.description.toLowerCase().includes(filter)
    );
    
    if (filtered.length === 0) {
      domainList.innerHTML = '<div class="empty-state">No domains in blacklist</div>';
      return;
    }
    
    domainList.innerHTML = filtered.map(domain => `
      <div class="domain-item ${domain.active ? 'active' : 'inactive'}">
        <div class="domain-info">
          <div class="domain-pattern">${domain.pattern}</div>
          <div class="domain-description">${domain.description}</div>
        </div>
        <div class="domain-actions">
          <button class="toggle-btn ${domain.active ? 'active' : ''}" data-pattern="${domain.pattern}">
            ${domain.active ? 'ON' : 'OFF'}
          </button>
          <button class="delete-btn" data-pattern="${domain.pattern}">&times;</button>
        </div>
      </div>
    `).join('');
    
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ 
          type: 'TOGGLE_DOMAIN', 
          pattern: btn.dataset.pattern 
        });
        loadDomains();
      });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ 
          type: 'REMOVE_DOMAIN', 
          pattern: btn.dataset.pattern 
        });
        loadDomains();
      });
    });
  }

  function updateStats() {
    totalCount.textContent = domains.length;
    activeCount.textContent = domains.filter(d => d.active).length;
    inactiveCount.textContent = domains.filter(d => !d.active).length;
  }

  addDomainBtn.addEventListener('click', async () => {
    const pattern = newDomainInput.value.trim();
    if (!pattern) return;
    
    await chrome.runtime.sendMessage({ 
      type: 'ADD_DOMAIN', 
      pattern: pattern,
      description: 'Manual' 
    });
    
    newDomainInput.value = '';
    loadDomains();
  });

  newDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomainBtn.click();
    }
  });

  presetRuBtn.addEventListener('click', async () => {
    const ruDomains = ['*.ru', '*.рф'];
    for (const pattern of ruDomains) {
      await chrome.runtime.sendMessage({ 
        type: 'ADD_DOMAIN', 
        pattern: pattern,
        description: 'Russia TLD' 
      });
    }
    loadDomains();
  });

  importBtn.addEventListener('click', () => {
    importModal.style.display = 'flex';
  });

  exportBtn.addEventListener('click', () => {
    const exportData = domains.map(d => d.pattern);
    exportTextarea.value = JSON.stringify(exportData, null, 2);
    exportModal.style.display = 'flex';
  });

  closeImportModal.addEventListener('click', () => {
    importModal.style.display = 'none';
  });

  closeExportModal.addEventListener('click', () => {
    exportModal.style.display = 'none';
  });

  confirmImportBtn.addEventListener('click', async () => {
    const text = importTextarea.value.trim();
    if (!text) return;
    
    let newDomains = [];
    try {
      newDomains = JSON.parse(text);
    } catch {
      newDomains = text.split('\n').map(d => d.trim()).filter(d => d);
    }
    
    await chrome.runtime.sendMessage({ 
      type: 'IMPORT_DOMAINS', 
      domains: newDomains 
    });
    
    importTextarea.value = '';
    importModal.style.display = 'none';
    loadDomains();
  });

  copyExportBtn.addEventListener('click', () => {
    exportTextarea.select();
    document.execCommand('copy');
  });

  searchInput.addEventListener('input', renderDomains);

  loadDomains();
});
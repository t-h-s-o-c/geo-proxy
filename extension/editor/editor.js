const PRESETS = {
  ai: [
    { pattern: 'claude.ai', description: 'Claude Web' },
    { pattern: '*.anthropic.com', description: 'Anthropic' },
    { pattern: 'api.anthropic.com', description: 'Anthropic API' },
    { pattern: 'openai.com', description: 'OpenAI' },
    { pattern: '*.openai.com', description: 'OpenAI' },
    { pattern: 'api.openai.com', description: 'OpenAI API' },
    { pattern: 'generativelanguage.googleapis.com', description: 'Google Gemini' },
    { pattern: 'ai.google.dev', description: 'Google AI Studio' },
    { pattern: 'ollama.com', description: 'Ollama' },
    { pattern: 'huggingface.co', description: 'Hugging Face' },
    { pattern: 'api.cohere.ai', description: 'Cohere' },
    { pattern: '*.mistral.ai', description: 'Mistral' },
    { pattern: 'api.perplexity.ai', description: 'Perplexity' },
    { pattern: '*.groq.com', description: 'Groq' },
    { pattern: 'api.together.xyz', description: 'Together AI' }
  ],
  github: [
    { pattern: 'github.com', description: 'GitHub' },
    { pattern: '*.github.com', description: 'GitHub' },
    { pattern: 'api.github.com', description: 'GitHub API' },
    { pattern: '*.githubusercontent.com', description: 'GitHub Raw' }
  ],
  all: [
    { pattern: 'claude.ai', description: 'Claude Web' },
    { pattern: '*.anthropic.com', description: 'Anthropic' },
    { pattern: 'openai.com', description: 'OpenAI' },
    { pattern: '*.openai.com', description: 'OpenAI' },
    { pattern: 'api.openai.com', description: 'OpenAI API' },
    { pattern: 'generativelanguage.googleapis.com', description: 'Google Gemini' },
    { pattern: 'ai.google.dev', description: 'Google AI Studio' },
    { pattern: 'ollama.com', description: 'Ollama' },
    { pattern: 'huggingface.co', description: 'Hugging Face' },
    { pattern: 'github.com', description: 'GitHub' },
    { pattern: '*.github.com', description: 'GitHub' },
    { pattern: 'api.github.com', description: 'GitHub API' },
    { pattern: 'openrouter.ai', description: 'OpenRouter' }
  ]
};

let domains = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadDomains();
  setupEventListeners();
}

async function loadDomains() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_DOMAINS' });
  domains = response.domains || [];
  renderDomains();
  updateStats();
}

function renderDomains() {
  const tbody = document.getElementById('domainTableBody');
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filter = document.getElementById('filterSelect').value;
  
  let filtered = domains;
  
  if (search) {
    filtered = filtered.filter(d => 
      d.pattern.toLowerCase().includes(search) ||
      (d.description && d.description.toLowerCase().includes(search))
    );
  }
  
  if (filter === 'active') {
    filtered = filtered.filter(d => d.active);
  } else if (filter === 'inactive') {
    filtered = filtered.filter(d => !d.active);
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No domains found</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(domain => `
    <tr>
      <td>
        <label class="toggle-switch">
          <input type="checkbox" ${domain.active ? 'checked' : ''} data-action="toggle" data-pattern="${escapeHtml(domain.pattern)}">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td class="pattern-cell">${escapeHtml(domain.pattern)}</td>
      <td class="description-cell">${escapeHtml(domain.description || '-')}</td>
      <td class="date-cell">${formatDate(domain.addedAt)}</td>
      <td class="actions-cell">
        <button class="btn btn-icon btn-sm" data-action="delete" data-pattern="${escapeHtml(domain.pattern)}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
  
  tbody.querySelectorAll('[data-action="toggle"]').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const pattern = e.target.dataset.pattern;
      await chrome.runtime.sendMessage({ type: 'TOGGLE_DOMAIN', pattern });
      await loadDomains();
    });
  });
  
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const pattern = e.currentTarget.dataset.pattern;
      await chrome.runtime.sendMessage({ type: 'REMOVE_DOMAIN', pattern });
      await loadDomains();
    });
  });
}

function updateStats() {
  document.getElementById('totalCount').textContent = domains.length;
  document.getElementById('activeCount').textContent = domains.filter(d => d.active).length;
}

function setupEventListeners() {
  document.getElementById('searchInput').addEventListener('input', renderDomains);
  document.getElementById('filterSelect').addEventListener('change', renderDomains);
  
  document.getElementById('addDomainBtn').addEventListener('click', () => {
    document.getElementById('addModal').classList.add('active');
    document.getElementById('domainPattern').focus();
  });
  
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('addModal').classList.remove('active');
  });
  
  document.getElementById('cancelModal').addEventListener('click', () => {
    document.getElementById('addModal').classList.remove('active');
  });
  
  document.getElementById('saveModal').addEventListener('click', async () => {
    const pattern = document.getElementById('domainPattern').value.trim();
    const description = document.getElementById('domainDescription').value.trim();
    
    if (!pattern) {
      showToast('Pattern is required', 'error');
      return;
    }
    
    await chrome.runtime.sendMessage({ type: 'ADD_DOMAIN', pattern, description });
    document.getElementById('addModal').classList.remove('active');
    document.getElementById('domainPattern').value = '';
    document.getElementById('domainDescription').value = '';
    await loadDomains();
    showToast('Domain added', 'success');
  });
  
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importModal').classList.add('active');
  });
  
  document.getElementById('closeImport').addEventListener('click', () => {
    document.getElementById('importModal').classList.remove('active');
  });
  
  document.getElementById('cancelImport').addEventListener('click', () => {
    document.getElementById('importModal').classList.remove('active');
  });
  
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const preset = e.target.dataset.preset;
      document.getElementById('importTextarea').value = JSON.stringify(PRESETS[preset], null, 2);
    });
  });
  
  document.getElementById('confirmImport').addEventListener('click', async () => {
    const text = document.getElementById('importTextarea').value.trim();
    if (!text) return;
    
    let domainsToImport;
    try {
      if (text.startsWith('[')) {
        domainsToImport = JSON.parse(text);
      } else {
        domainsToImport = text.split('\n').map(d => d.trim()).filter(Boolean);
      }
    } catch (e) {
      showToast('Invalid format', 'error');
      return;
    }
    
    const response = await chrome.runtime.sendMessage({
      type: 'IMPORT_DOMAINS',
      domains: domainsToImport
    });
    
    document.getElementById('importModal').classList.remove('active');
    document.getElementById('importTextarea').value = '';
    await loadDomains();
    showToast(`Imported ${response.total} domains`, 'success');
  });
  
  document.getElementById('exportBtn').addEventListener('click', () => {
    const data = domains.map(d => ({
      pattern: d.pattern,
      description: d.description,
      active: d.active
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geoproxy-domains-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
  });
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
}

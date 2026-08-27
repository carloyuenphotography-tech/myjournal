let allRules = [];

function initGoogleSignIn() {
  const container = document.getElementById("googleSignInContainer");
  if (!container) {
    document.addEventListener('DOMContentLoaded', initGoogleSignIn);
    return;
  }
  if (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_CLIENT_ID && window.google) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(container, { theme: "outline", size: "large" });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const savedEmail = sessionStorage.getItem("user_google_email") || (sessionStorage.getItem("google_user") ? JSON.parse(sessionStorage.getItem("google_user")).email : null);
  if (savedEmail && typeof ALLOWED_EMAILS !== 'undefined' && Array.isArray(ALLOWED_EMAILS)) {
    if (ALLOWED_EMAILS.map(e => e.toLowerCase().trim()).includes(savedEmail.toLowerCase().trim())) {
      initializeApp();
      return;
    }
  }
  checkLoginStatus();
});

function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  if (payload && payload.email) {
    const userEmail = payload.email.toLowerCase().trim();
    if (typeof ALLOWED_EMAILS !== 'undefined' && Array.isArray(ALLOWED_EMAILS)) {
      if (!ALLOWED_EMAILS.map(e => e.toLowerCase().trim()).includes(userEmail)) {
        alert(`⚠️ 存取被拒：帳號 (${userEmail}) 未獲授權。`);
        return;
      }
    }
    sessionStorage.setItem("user_google_email", userEmail);
    sessionStorage.setItem('google_user', JSON.stringify({ name: payload.name, email: userEmail, picture: payload.picture }));
    initializeApp();
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch(e) { return null; }
}

function checkLoginStatus() {
  if (sessionStorage.getItem('google_user')) initializeApp();
  else {
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('mainContainer').style.display = 'none';
  }
}

function initializeApp() {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('mainContainer').style.display = 'block';
  loadRecurringData();
}

function showStatus(text, color = '#0284c7') {
  const msg = document.getElementById('statusMessage');
  if (msg) { msg.style.color = color; msg.textContent = text; }
}

function getProp(obj, keyNames) {
  if (!obj) return '';
  for (let k of Object.keys(obj)) {
    if (keyNames.includes(k.trim().toLowerCase())) {
      return obj[k];
    }
  }
  return '';
}

function loadRecurringData() {
  const sheetId = CONFIG.DAILY_SHEET_ID;
  const recGid = CONFIG.GIDS ? CONFIG.GIDS.DAILY_RECURRING : null;
  if (!sheetId || !recGid) {
    showStatus('❌ 缺少 DAILY_SHEET_ID 或 DAILY_RECURRING GID', '#ef4444');
    return;
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${recGid}&t=${new Date().getTime()}`;

  Papa.parse(csvUrl, {
    download: true, header: true, skipEmptyLines: true,
    complete: (results) => {
      allRules = parseRecurringRows(results.data);
      showStatus('');
      renderRulesList();
    },
    error: () => showStatus('❌ 讀取失敗，請確認 Google Sheet 公開權限', '#ef4444')
  });
}

function parseRecurringRows(rows) {
  if (!rows) return [];
  return rows.map((r, idx) => {
    return {
      id: String(getProp(r, ['id', '唯一編號']) || '').trim() || `R${String(idx + 1).padStart(3, '0')}`,
      content: String(getProp(r, ['content', '內容', '事項', '事項名稱']) || '').trim(),
      type: String(getProp(r, ['type', '類型']) || 'Task').trim(),
      frequency: String(getProp(r, ['frequency', '頻率', '頻率規則']) || 'DAILY').trim().toUpperCase(),
      dayParam: String(getProp(r, ['dayparam', '日期參數', '自訂日期']) || '').trim(),
      lastGenerated: String(getProp(r, ['lastgenerated', '最後產生日期']) || '').trim(),
      remarks: String(getProp(r, ['remarks', '備註']) || '').trim()
    };
  }).filter(r => r.content !== '');
}

function renderRulesList() {
  const grid = document.getElementById('rulesGrid');
  grid.innerHTML = '';

  if (allRules.length === 0) {
    grid.innerHTML = '<div style="text-align:center; color:#64748b; padding:30px 0;">目前無重複規則</div>';
    return;
  }

  allRules.forEach(rule => {
    const card = document.createElement('div');
    card.className = 'rule-card';

    let paramText = rule.dayParam ? ` (參數: ${rule.dayParam})` : '';

    card.innerHTML = `
      <div class="rule-info">
        <div class="rule-header">
          <span class="rule-id">${rule.id}</span>
          <span class="rule-freq">${rule.frequency}${paramText}</span>
          <span class="rule-type">${rule.type}</span>
        </div>
        <div class="rule-title">${rule.content}</div>
        <div class="rule-details">
          ${rule.remarks ? `💬 備註: ${rule.remarks} ｜ ` : ''}
          ⏱️ 上次產生: ${rule.lastGenerated || '未產生'}
        </div>
      </div>
      <div class="rule-actions">
        <button class="btn-sm btn-edit" onclick="openEditModal('${rule.id}')">✏️ 編輯</button>
        <button class="btn-sm btn-del" onclick="deleteRule('${rule.id}')">🗑️ 刪除</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function updateDayParamHint() {
  const freq = document.getElementById('modalFrequency').value;
  const hintEl = document.getElementById('dayParamHint');
  
  if (freq === 'DAILY' || freq === 'MONTHLY_END' || freq === 'QUARTERLY_END') {
    hintEl.textContent = '此模式不需填寫 DayParam (可留空)';
  } else if (freq === 'MONTHLY_DAY') {
    hintEl.textContent = '請填寫日期數字 (例如 15 代表每月 15 號)';
  } else if (freq === 'YEARLY') {
    hintEl.textContent = '請填寫月日格式 (例如 05-15 代表每年 5 月 15 日)';
  }
}

function openAddModal() {
  document.getElementById('modalTitle').textContent = '➕ 新增重複規則';
  document.getElementById('modalRuleId').value = '';
  document.getElementById('modalIdInput').value = `R${String(allRules.length + 1).padStart(3, '0')}`;
  document.getElementById('modalIdInput').disabled = false;
  document.getElementById('modalType').value = 'Task';
  document.getElementById('modalContent').value = '';
  document.getElementById('modalFrequency').value = 'DAILY';
  document.getElementById('modalDayParam').value = '';
  document.getElementById('modalRemarks').value = '';
  updateDayParamHint();
  document.getElementById('ruleModal').style.display = 'flex';
}

function openEditModal(id) {
  const target = allRules.find(r => r.id === id);
  if (!target) return;

  document.getElementById('modalTitle').textContent = '✏️ 編輯重複規則';
  document.getElementById('modalRuleId').value = target.id;
  document.getElementById('modalIdInput').value = target.id;
  document.getElementById('modalIdInput').disabled = true;
  document.getElementById('modalType').value = target.type;
  document.getElementById('modalContent').value = target.content;
  document.getElementById('modalFrequency').value = target.frequency;
  document.getElementById('modalDayParam').value = target.dayParam;
  document.getElementById('modalRemarks').value = target.remarks;
  updateDayParamHint();
  document.getElementById('ruleModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('ruleModal').style.display = 'none';
}

function handleFormSubmit(e) {
  e.preventDefault();
  const ruleId = document.getElementById('modalRuleId').value;
  const idInput = document.getElementById('modalIdInput').value.trim();
  const type = document.getElementById('modalType').value;
  const content = document.getElementById('modalContent').value.trim();
  const frequency = document.getElementById('modalFrequency').value;
  const dayParam = document.getElementById('modalDayParam').value.trim();
  const remarks = document.getElementById('modalRemarks').value.trim();

  if (!content) return;

  const finalId = idInput || `R${new Date().getTime()}`;

  if (ruleId) {
    // 編輯舊資料
    const target = allRules.find(r => r.id === ruleId);
    if (target) {
      target.type = type; target.content = content;
      target.frequency = frequency; target.dayParam = dayParam; target.remarks = remarks;
      syncToSheet('editRecurring', { id: target.id, type, content, frequency, dayParam, remarks });
    }
  } else {
    // 新增資料
    const newRule = { id: finalId, type, content, frequency, dayParam, remarks, lastGenerated: '' };
    allRules.push(newRule);
    syncToSheet('addRecurring', { id: finalId, type, content, frequency, dayParam, remarks });
  }

  closeModal();
  renderRulesList();
}

function deleteRule(id) {
  if (!confirm(`確定要刪除重複規則 (${id}) 嗎？`)) return;

  const idx = allRules.findIndex(r => r.id === id);
  if (idx !== -1) {
    allRules.splice(idx, 1);
    syncToSheet('deleteRecurring', { id });
    renderRulesList();
  }
}

function syncToSheet(action, paramsObj) {
  const apiUrl = CONFIG.API_URLS ? CONFIG.API_URLS.DAILY : '';
  if (!apiUrl) return;

  const params = new URLSearchParams({ action, key: CONFIG.SECRET_KEY || '', ...paramsObj });
  fetch(`${apiUrl}?${params.toString()}`, { mode: 'no-cors' });
}

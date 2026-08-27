let allRules = [];

window.initGoogleSignIn = function() {
  const container = document.getElementById("googleSignInContainer");
  if (!container) {
    document.addEventListener('DOMContentLoaded', window.initGoogleSignIn);
    return;
  }
  if (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_CLIENT_ID && window.google) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(container, { theme: "outline", size: "large" });
  }
};

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
    if (document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'flex';
    if (document.getElementById('mainContainer')) document.getElementById('mainContainer').style.display = 'none';
  }
}

function initializeApp() {
  if (document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'none';
  if (document.getElementById('mainContainer')) document.getElementById('mainContainer').style.display = 'block';
  loadRecurringData();
}

function showStatus(text, color = '#0284c7') {
  const msg = document.getElementById('statusMessage');
  if (msg) { msg.style.color = color; msg.textContent = text; }
}

function loadRecurringData() {
  if (typeof CONFIG === 'undefined') {
    showStatus('❌ 缺少 config.js 設定', '#ef4444');
    return;
  }
  const sheetId = CONFIG.DAILY_SHEET_ID;
  const recGid = CONFIG.GIDS ? CONFIG.GIDS.DAILY_RECURRING : null;
  if (!sheetId || !recGid) {
    showStatus('❌ 缺少 DAILY_SHEET_ID 或 DAILY_RECURRING GID', '#ef4444');
    return;
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${recGid}&t=${new Date().getTime()}`;

  if (typeof Papa === 'undefined') {
    showStatus('❌ 載入 PapaParse 失敗，請確認網路連線', '#ef4444');
    return;
  }

  Papa.parse(csvUrl, {
    download: true,
    header: false,
    skipEmptyLines: true,
    complete: (results) => {
      allRules = parseRecurringArrayRows(results.data);
      showStatus('');
      renderRulesList();
    },
    error: () => showStatus('❌ 讀取失敗，請確認 Google Sheet 公開權限', '#ef4444')
  });
}

function parseRecurringArrayRows(rows) {
  if (!rows || rows.length === 0) return [];

  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const rowStr = rows[i].join(',').toLowerCase();
    if (rowStr.includes('content') || rowStr.includes('id')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const headers = rows[headerIndex].map(h => String(h).trim().toLowerCase());
  const idIdx = headers.findIndex(h => h === 'id' || h.includes('id'));
  const contentIdx = headers.findIndex(h => h === 'content' || h.includes('content') || h.includes('事項'));
  const typeIdx = headers.findIndex(h => h === 'type' || h.includes('type'));
  const freqIdx = headers.findIndex(h => h === 'frequency' || h.includes('frequency'));
  const dayIdx = headers.findIndex(h => h === 'dayparam' || h.includes('dayparam'));
  const lastIdx = headers.findIndex(h => h === 'lastgenerated' || h.includes('lastgenerated'));
  const remIdx = headers.findIndex(h => h === 'remarks' || h.includes('remarks') || h.includes('備註'));

  const rules = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    const content = contentIdx !== -1 && r[contentIdx] ? String(r[contentIdx]).trim() : '';
    if (!content) continue;

    rules.push({
      id: idIdx !== -1 && r[idIdx] ? String(r[idIdx]).trim() : `R${String(i).padStart(3, '0')}`,
      content: content,
      type: typeIdx !== -1 && r[typeIdx] ? String(r[typeIdx]).trim() : 'Task',
      frequency: freqIdx !== -1 && r[freqIdx] ? String(r[freqIdx]).trim().toUpperCase() : 'DAILY',
      dayParam: dayIdx !== -1 && r[dayIdx] ? String(r[dayIdx]).trim() : '',
      lastGenerated: lastIdx !== -1 && r[lastIdx] ? String(r[lastIdx]).trim() : '',
      remarks: remIdx !== -1 && r[remIdx] ? String(r[remIdx]).trim() : ''
    });
  }
  return rules;
}

function renderRulesList() {
  const grid = document.getElementById('rulesGrid');
  if (!grid) return;
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
        <button class="btn-sm btn-gen" onclick="window.generateSingleRuleNow('${rule.id}', 'today')" title="立即產生卡片至今天">⚡ 今天</button>
        <button class="btn-sm btn-gen" style="background:#059669;" onclick="window.generateSingleRuleNow('${rule.id}', 'tomorrow')" title="立即產生卡片至明天">⚡ 明天</button>
        <button class="btn-sm btn-edit" onclick="window.openEditModal('${rule.id}')">✏️ 編輯</button>
        <button class="btn-sm btn-del" onclick="window.deleteRule('${rule.id}')">🗑️ 刪除</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

window.updateDayParamHint = function() {
  const freq = document.getElementById('modalFrequency').value;
  const hintEl = document.getElementById('dayParamHint');
  if (!hintEl) return;
  if (freq === 'DAILY' || freq === 'MONTHLY_END' || freq === 'QUARTERLY_END') {
    hintEl.textContent = '此模式不需填寫 DayParam (可留空)';
  } else if (freq === 'MONTHLY_DAY') {
    hintEl.textContent = '請填寫日期數字 (例如 15 代表每月 15 號)';
  } else if (freq === 'YEARLY') {
    hintEl.textContent = '請填寫月日格式 (例如 05-15 代表每年 5 月 15 日)';
  }
};

window.openAddModal = function() {
  document.getElementById('modalTitle').textContent = '➕ 新增重複規則';
  document.getElementById('modalRuleId').value = '';
  document.getElementById('modalIdInput').value = `R${String(allRules.length + 1).padStart(3, '0')}`;
  document.getElementById('modalIdInput').disabled = false;
  document.getElementById('modalType').value = 'Task';
  document.getElementById('modalContent').value = '';
  document.getElementById('modalFrequency').value = 'DAILY';
  document.getElementById('modalDayParam').value = '';
  document.getElementById('modalRemarks').value = '';
  window.updateDayParamHint();
  document.getElementById('ruleModal').style.display = 'flex';
};

window.openEditModal = function(id) {
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
  window.updateDayParamHint();
  document.getElementById('ruleModal').style.display = 'flex';
};

window.closeModal = function() {
  document.getElementById('ruleModal').style.display = 'none';
};

window.handleFormSubmit = async function(e) {
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
    const target = allRules.find(r => r.id === ruleId);
    if (target) {
      target.type = type; target.content = content;
      target.frequency = frequency; target.dayParam = dayParam; target.remarks = remarks;
      await syncToSheetAsync('editRecurring', { id: target.id, type, content, frequency, dayParam, remarks });
    }
  } else {
    const newRule = { id: finalId, type, content, frequency, dayParam, remarks, lastGenerated: '' };
    allRules.push(newRule);
    await syncToSheetAsync('addRecurring', { id: finalId, type, content, frequency, dayParam, remarks });
  }

  window.closeModal();
  renderRulesList();
};

window.deleteRule = async function(id) {
  if (!confirm(`確定要刪除重複規則 (${id}) 嗎？`)) return;

  const idx = allRules.findIndex(r => r.id === id);
  if (idx !== -1) {
    allRules.splice(idx, 1);
    await syncToSheetAsync('deleteRecurring', { id });
    renderRulesList();
  }
};

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getTomorrowStr() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function calcTargetDate(frequency, dayParam, baseDateObj) {
  const year = baseDateObj.getFullYear();
  const month = baseDateObj.getMonth();
  const freq = String(frequency).toUpperCase();

  if (freq === 'DAILY') {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(baseDateObj.getDate()).padStart(2, '0')}`;
  }
  if (freq === 'MONTHLY_END') {
    const d = new Date(year, month + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (freq === 'MONTHLY_DAY') {
    const day = parseInt(dayParam || '1', 10);
    const d = new Date(year, month, day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (freq === 'QUARTERLY_END') {
    const qEndMonths = [2, 5, 8, 11];
    let qMonth = qEndMonths.find(m => m >= month);
    let qYear = year;
    if (qMonth === undefined) { qMonth = 2; qYear = year + 1; }
    const d = new Date(qYear, qMonth + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (freq === 'YEARLY') {
    if (!dayParam || !dayParam.includes('-')) return null;
    const [mStr, dStr] = dayParam.split('-');
    return `${year}-${String(mStr).padStart(2, '0')}-${String(dStr).padStart(2, '0')}`;
  }
  return null;
}

/* ⚡ 單一規則生成（改為同步佇列） */
window.generateSingleRuleNow = async function(ruleId, targetDay = 'today') {
  const rule = allRules.find(r => r.id === ruleId);
  if (!rule) return;

  const isTomorrow = targetDay === 'tomorrow';
  const labelText = isTomorrow ? '明天' : '今天';
  const baseDateObj = isTomorrow ? (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })() : new Date();
  const dateStr = isTomorrow ? getTomorrowStr() : getTodayStr();

  const targetDate = calcTargetDate(rule.frequency, rule.dayParam, baseDateObj) || dateStr;
  const newId = 'L_REC_' + new Date().getTime();

  showStatus(`⏳ 正在寫入【${rule.content}】至 ${targetDate} (${labelText}) 待辦...`, '#8b5cf6');

  // 1. 寫入 DAILY_LOG
  await syncToSheetAsync('addLog', {
    id: newId,
    date: targetDate,
    type: rule.type,
    content: rule.content,
    status: 'Pending',
    remarks: rule.remarks
  });

  // 2. 更新 LastGenerated
  rule.lastGenerated = dateStr;
  await syncToSheetAsync('editRecurring', {
    id: rule.id,
    content: rule.content,
    type: rule.type,
    frequency: rule.frequency,
    dayParam: rule.dayParam,
    lastGenerated: dateStr,
    remarks: rule.remarks
  });

  showStatus('');
  alert(`✅ 已成功為【${rule.content}】生成 ${targetDate} (${labelText}) 的待辦事項！\n返回主頁即可查看卡片。`);
  renderRulesList();
};

/* ⚡ 批量生成（改為 async/await 順序寫入，防止 GAS 請求遺失） */
window.generateAllRulesNow = async function(targetDay = 'today') {
  const isTomorrow = targetDay === 'tomorrow';
  const labelText = isTomorrow ? '明天' : '今天';

  if (!confirm(`確定要根據所有符合條件的規則，順序生成${labelText}的待辦事項嗎？`)) return;

  const baseDateObj = isTomorrow ? (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })() : new Date();
  const dateStr = isTomorrow ? getTomorrowStr() : getTodayStr();
  let generatedCount = 0;

  for (let i = 0; i < allRules.length; i++) {
    const rule = allRules[i];
    const targetDate = calcTargetDate(rule.frequency, rule.dayParam, baseDateObj);

    if (targetDate === dateStr || rule.frequency === 'DAILY') {
      showStatus(`⏳ (${i + 1}/${allRules.length}) 正在生成【${rule.content}】...`, '#8b5cf6');

      const newId = 'L_REC_' + new Date().getTime() + '_' + i;

      // 排隊寫入 DAILY_LOG
      await syncToSheetAsync('addLog', {
        id: newId,
        date: dateStr,
        type: rule.type,
        content: rule.content,
        status: 'Pending',
        remarks: rule.remarks
      });

      rule.lastGenerated = dateStr;
      await syncToSheetAsync('editRecurring', {
        id: rule.id,
        content: rule.content,
        type: rule.type,
        frequency: rule.frequency,
        dayParam: rule.dayParam,
        lastGenerated: dateStr,
        remarks: rule.remarks
      });

      generatedCount++;
    }
  }

  showStatus('');
  if (generatedCount > 0) {
    alert(`🎉 成功順序寫入 ${generatedCount} 項待辦事項至${labelText}（${dateStr}）！\n點擊「返回主頁」即可查看。`);
    renderRulesList();
  } else {
    alert(`ℹ️ ${labelText}（${dateStr}）沒有符合條件需新生成的項目。`);
  }
};

/* ⚡ 排隊發送函式 (每筆間隔 350ms) */
function syncToSheetAsync(action, paramsObj) {
  return new Promise((resolve) => {
    if (typeof CONFIG === 'undefined') return resolve();
    const apiUrl = CONFIG.API_URLS ? CONFIG.API_URLS.DAILY : '';
    if (!apiUrl) return resolve();

    const params = new URLSearchParams({ action, key: CONFIG.SECRET_KEY || '', ...paramsObj });
    fetch(`${apiUrl}?${params.toString()}`, { mode: 'no-cors' })
      .then(() => setTimeout(resolve, 350))
      .catch(() => setTimeout(resolve, 350));
  });
}

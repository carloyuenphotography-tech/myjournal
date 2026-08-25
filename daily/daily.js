let allLogs = [];

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let todayStr = getTodayString();

function initGoogleSignIn() {
  if (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_CLIENT_ID) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
      document.getElementById("googleSignInContainer"),
      { theme: "outline", size: "large" }
    );
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadNavbar();
  if (typeof CONFIG === 'undefined') {
    showStatus('❌ 找不到 config.js 設定', '#ef4444');
    return;
  }
  const savedEmail = sessionStorage.getItem("user_google_email") || (sessionStorage.getItem("google_user") ? JSON.parse(sessionStorage.getItem("google_user")).email : null);
  if (savedEmail && typeof ALLOWED_EMAILS !== 'undefined' && Array.isArray(ALLOWED_EMAILS)) {
    if (ALLOWED_EMAILS.map(e => e.toLowerCase().trim()).includes(savedEmail.toLowerCase().trim())) {
      initializeApp();
      return;
    }
  }
  checkLoginStatus();
});

function initializeApp() {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.cancel();
  }
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('mainContainer').style.display = 'block';
  loadLogsData();
}

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
    sessionStorage.setItem('google_token', response.credential);
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

function showStatus(text, color = '#0284c7') {
  const msg = document.getElementById('statusMessage');
  if (msg) { msg.style.color = color; msg.textContent = text; }
}

function loadNavbar() {
  fetch('nav.html')
    .then(res => res.text())
    .then(data => {
      const navContainer = document.getElementById('navbar');
      if (navContainer) navContainer.innerHTML = data;
    }).catch(err => console.log('導覽載入失敗', err));
}

function loadLogsData() {
  const sheetId = CONFIG.DAILY_SHEET_ID;
  const gid = CONFIG.GIDS ? CONFIG.GIDS.DAILY_LOG : '0';
  if (!sheetId) { showStatus('❌ 缺少 DAILY_SHEET_ID', '#ef4444'); return; }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}&t=${new Date().getTime()}`;

  Papa.parse(csvUrl, {
    download: true, header: true, skipEmptyLines: true,
    complete: (results) => {
      allLogs = parseLogs(results.data);
      showStatus('');
      renderTimeline();
      updateBacklogBadge();
    },
    error: () => showStatus('❌ 讀取失敗，請確認 Google Sheet 公開權限', '#ef4444')
  });
}

function parseLogs(rows) {
  if (!rows) return [];
  return rows.map((r, i) => {
    const v = Object.values(r);
    return {
      id: r.ID || r.id || v[0] || `L_${i}`,
      date: (r.Date || r.date || v[1] || '').trim(),
      type: r.Type || r.type || v[2] || 'Task',
      content: r.Content || r.content || v[3] || '',
      status: r.Status || r.status || v[4] || 'Pending',
      remarks: r.Remarks || r.remarks || v[5] || ''
    };
  });
}

function isItemDone(status) {
  return status === '完成' || status === 'Done';
}

/* 渲染時間軸 (Timeline View) */
function renderTimeline() {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = '';
  const showCompleted = document.getElementById('showCompleted').checked;

  // 1. 逾期項目 (Overdue)
  const overdueItems = allLogs.filter(item => item.date && item.date < todayStr && !isItemDone(item.status));
  if (overdueItems.length > 0) {
    const overdueDiv = document.createElement('div');
    overdueDiv.className = 'overdue-section';
    overdueDiv.innerHTML = `
      <div class="overdue-header">
        <span>⚠️ 逾期未完成事項 (${overdueItems.length})</span>
      </div>
      <div class="overdue-list" style="display:flex; flex-direction:column; gap:6px;"></div>
    `;
    const listDiv = overdueDiv.querySelector('.overdue-list');
    overdueItems.forEach(item => listDiv.appendChild(createTaskCard(item)));
    container.appendChild(overdueDiv);
  }

  // 2. 收集所有有日期的項目 (今天、將來或歷史)
  const datedLogs = allLogs.filter(item => item.date && item.date >= todayStr);
  
  // 建立日期地圖，確保「今天」必定存在
  const datesSet = new Set(datedLogs.map(i => i.date));
  datesSet.add(todayStr);
  const sortedDates = Array.from(datesSet).sort();

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  sortedDates.forEach(dateVal => {
    const d = new Date(dateVal);
    const weekdayStr = weekdays[d.getDay()];
    const dayNum = d.getDate();
    const isToday = (dateVal === todayStr);

    let dayItems = datedLogs.filter(i => i.date === dateVal);
    if (!showCompleted) {
      dayItems = dayItems.filter(i => !isItemDone(i.status));
    }

    const pendingCount = dayItems.filter(i => !isItemDone(i.status)).length;

    const dayBlock = document.createElement('div');
    dayBlock.className = `day-block ${isToday ? 'is-today' : ''}`;
    if (isToday) dayBlock.id = 'todayBlock';

    dayBlock.innerHTML = `
      <div class="day-date-col">
        <span class="day-weekday">${weekdayStr}</span>
        <span class="day-number">${dayNum}</span>
      </div>
      <div class="day-content-col">
        ${pendingCount > 0 ? `<div class="pending-tasks-pill">☑ ${pendingCount} pending task${pendingCount > 1 ? 's' : ''}</div>` : ''}
        <div class="day-card-list" style="display:flex; flex-direction:column; gap:6px;"></div>
      </div>
    `;

    const cardList = dayBlock.querySelector('.day-card-list');
    if (dayItems.length === 0 && isToday) {
      cardList.innerHTML = `<div style="font-size:0.8rem; color:#94a3b8; padding:4px 0;">今日無事項</div>`;
    } else {
      dayItems.forEach(item => cardList.appendChild(createTaskCard(item)));
    }

    container.appendChild(dayBlock);
  });
}

function createTaskCard(item) {
  const isDone = isItemDone(item.status);
  const card = document.createElement('div');
  card.className = `task-card type-${item.type} ${isDone ? 'done' : ''}`;
  
  card.innerHTML = `
    <div class="task-info">
      <div class="task-title">${item.content}</div>
      ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
    </div>
    <div class="task-actions">
      <button class="btn-circle" onclick="toggleStatus('${item.id}')" title="切換狀態">${isDone ? '✓' : '○'}</button>
      <button class="btn-circle" onclick="openEditModal('${item.id}')" title="編輯">✏️</button>
    </div>
  `;
  return card;
}

/* Backlog 未有日期工作 Modal 控制 */
function updateBacklogBadge() {
  const count = allLogs.filter(i => (!i.date || i.date.trim() === '') && !isItemDone(i.status)).length;
  document.getElementById('backlogBadgeCount').textContent = count;
}

function openBacklogModal() {
  renderBacklogModal();
  document.getElementById('backlogModal').style.display = 'flex';
}

function closeBacklogModal() {
  document.getElementById('backlogModal').style.display = 'none';
}

function renderBacklogModal() {
  const body = document.getElementById('backlogModalBody');
  body.innerHTML = '';
  
  const showCompleted = document.getElementById('showCompleted').checked;
  const backlogItems = allLogs.filter(i => {
    if (i.date && i.date.trim() !== '') return false;
    if (!showCompleted && isItemDone(i.status)) return false;
    return true;
  });

  if (backlogItems.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">目前沒有未有日期的工作 🎉</div>`;
    return;
  }

  backlogItems.forEach(item => {
    const isDone = isItemDone(item.status);
    const row = document.createElement('div');
    row.style.cssText = `background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; gap:8px; ${isDone ? 'opacity:0.5;' : ''}`;
    
    row.innerHTML = `
      <div style="flex:1; min-width:0;">
        <div style="font-weight:bold; font-size:0.85rem; ${isDone ? 'text-decoration:line-through;' : ''}">${item.content}</div>
        ${item.remarks ? `<div style="font-size:0.75rem; color:#64748b;">${item.remarks}</div>` : ''}
      </div>
      <div style="display:flex; gap:4px; align-items:center;">
        <button onclick="assignToToday('${item.id}')" style="background:#e0f2fe; color:#0284c7; border:none; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; font-weight:bold;">移至今天</button>
        <button onclick="toggleStatus('${item.id}')" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">${isDone ? '✓' : '待辦'}</button>
        <button onclick="openEditModal('${item.id}')" style="background:none; border:none; cursor:pointer; font-size:0.85rem;">✏️</button>
      </div>
    `;
    body.appendChild(row);
  });
}

function assignToToday(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;
  target.date = todayStr;
  
  renderTimeline();
  updateBacklogBadge();
  renderBacklogModal();
  syncToSheet('editLog', { id: target.id, oldContent: target.content, date: target.date, type: target.type, content: target.content, remarks: target.remarks });
}

/* 表單 Modal 操作 */
function openAddModal() {
  document.getElementById('modalFormTitle').textContent = '➕ 新增事項';
  document.getElementById('modalItemId').value = '';
  document.getElementById('modalDate').value = todayStr;
  document.getElementById('modalType').value = 'Task';
  document.getElementById('modalContent').value = '';
  document.getElementById('modalRemarks').value = '';
  document.getElementById('btnDelete').style.display = 'none';
  document.getElementById('itemModal').style.display = 'flex';
}

function openEditModal(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  document.getElementById('modalFormTitle').textContent = '✏️ 編輯事項';
  document.getElementById('modalItemId').value = target.id;
  document.getElementById('modalDate').value = target.date || '';
  document.getElementById('modalType').value = target.type;
  document.getElementById('modalContent').value = target.content;
  document.getElementById('modalRemarks').value = target.remarks || '';
  document.getElementById('btnDelete').style.display = 'block';
  document.getElementById('itemModal').style.display = 'flex';
}

function closeItemModal() {
  document.getElementById('itemModal').style.display = 'none';
}

function handleFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('modalItemId').value;
  const date = document.getElementById('modalDate').value.trim();
  const type = document.getElementById('modalType').value;
  const content = document.getElementById('modalContent').value.trim();
  const remarks = document.getElementById('modalRemarks').value.trim();

  if (!content) return;

  if (id) {
    // 編輯
    const target = allLogs.find(l => l.id === id);
    if (target) {
      const oldContent = target.content;
      target.date = date; target.type = type; target.content = content; target.remarks = remarks;
      syncToSheet('editLog', { id, oldContent, date, type, content, remarks });
    }
  } else {
    // 新增
    const newId = 'L' + new Date().getTime();
    const newItem = { id: newId, date, type, content, status: 'Pending', remarks };
    allLogs.push(newItem);
    syncToSheet('addLog', { id: newId, date, type, content, status: 'Pending', remarks });
  }

  closeItemModal();
  renderTimeline();
  updateBacklogBadge();
  if (document.getElementById('backlogModal').style.display === 'flex') renderBacklogModal();
}

function deleteCurrentItem() {
  const id = document.getElementById('modalItemId').value;
  if (!id || !confirm('確定要刪除這筆事項嗎？')) return;

  const idx = allLogs.findIndex(l => l.id === id);
  if (idx !== -1) {
    const target = allLogs[idx];
    allLogs.splice(idx, 1);
    syncToSheet('deleteLog', { id: target.id, content: target.content });
  }

  closeItemModal();
  renderTimeline();
  updateBacklogBadge();
  if (document.getElementById('backlogModal').style.display === 'flex') renderBacklogModal();
}

function toggleStatus(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  const newStatus = isItemDone(target.status) ? 'Pending' : '完成';
  target.status = newStatus;

  renderTimeline();
  updateBacklogBadge();
  if (document.getElementById('backlogModal').style.display === 'flex') renderBacklogModal();

  syncToSheet('toggleLog', { id: target.id, content: target.content, status: newStatus });
}

function syncToSheet(action, paramsObj) {
  const apiUrl = CONFIG.API_URLS ? CONFIG.API_URLS.DAILY : '';
  if (!apiUrl) return;

  const params = new URLSearchParams({ action, key: CONFIG.SECRET_KEY || '', ...paramsObj });
  fetch(`${apiUrl}?${params.toString()}`, { mode: 'no-cors' });
}

function scrollToToday() {
  const el = document.getElementById('todayBlock');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

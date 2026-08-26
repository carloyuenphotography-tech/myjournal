let allLogs = [];

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTomorrowString() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let todayStr = getTodayString();
let tomorrowStr = getTomorrowString();

/* Google 登入驗證 */
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
  } else if (typeof CONFIG === 'undefined' || !CONFIG.GOOGLE_CLIENT_ID) {
    container.innerHTML = '<div style="color:#ef4444; font-size:0.8rem;">❌ 讀取失敗：缺少 config.js 或 GOOGLE_CLIENT_ID</div>';
  }
}

window.addEventListener('DOMContentLoaded', () => {
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
      refreshAllViews();
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

/* ⚡ Rapid Logging 快速新增處理 */
function handleQuickSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('quickType').value;
  const isBacklog = document.getElementById('quickIsBacklog').checked;
  const content = document.getElementById('quickContent').value.trim();

  if (!content) return;

  const newId = 'L' + new Date().getTime();
  const targetDate = isBacklog ? '' : todayStr;

  const newItem = {
    id: newId,
    date: targetDate,
    type: type,
    content: content,
    status: 'Pending',
    remarks: ''
  };

  allLogs.push(newItem);

  document.getElementById('quickContent').value = '';
  document.getElementById('quickIsBacklog').checked = false;

  refreshAllViews();
  syncToSheet('addLog', { id: newId, date: targetDate, type, content, status: 'Pending', remarks: '' });
}

/* 輔助判斷 */
function isItemDone(status) {
  return status === '完成' || status === 'Done';
}

function isItemArchived(status) {
  return status === 'Archived' || status === '已典藏';
}

function isNoteType(type) {
  return type === '筆記' || type === 'Note';
}

/* 🎨 解析 Hashtag Class */
function getTagClasses(item) {
  const text = ((item.content || '') + ' ' + (item.remarks || '')).toLowerCase();
  const classes = [];
  if (text.includes('#sch') || text.includes('#學校') || text.includes('#學業')) classes.push('tag-sch');
  if (text.includes('#family') || text.includes('#家庭') || text.includes('#家')) classes.push('tag-family');
  if (text.includes('#work') || text.includes('#工作') || text.includes('#辦公')) classes.push('tag-work');
  if (text.includes('#urgent') || text.includes('#重要') || text.includes('#緊急') || text.includes('🔥')) classes.push('tag-urgent');
  if (text.includes('#finance') || text.includes('#買') || text.includes('#購物')) classes.push('tag-finance');
  if (text.includes('#health') || text.includes('#健康') || text.includes('#運動')) classes.push('tag-health');
  if (text.includes('#personal') || text.includes('#個人')) classes.push('tag-personal');
  return classes.join(' ');
}

/* 更新頂部 Bubbles 氣泡數字 */
function updateAllBadges() {
  const overdueCount = allLogs.filter(i => i.date && i.date < todayStr && !isItemDone(i.status) && !isItemArchived(i.status) && !isNoteType(i.type)).length;
  const backlogCount = allLogs.filter(i => (!i.date || i.date.trim() === '') && !isItemDone(i.status) && !isItemArchived(i.status) && !isNoteType(i.type)).length;
  const completedCount = allLogs.filter(i => isItemDone(i.status)).length;
  const archivedCount = allLogs.filter(i => isItemArchived(i.status)).length;

  document.getElementById('overdueBadgeCount').textContent = overdueCount;
  document.getElementById('backlogBadgeCount').textContent = backlogCount;
  document.getElementById('completedBadgeCount').textContent = completedCount;
  document.getElementById('archivedBadgeCount').textContent = archivedCount;
}
function renderMemos() {
  const listContainer = document.getElementById('memoList');
  listContainer.innerHTML = '';

  let lastMonthYear = ''; // 用來比對月份是否切換

  filtered.forEach(memo => {
    // 假設 memo.date 格式為 "2026-09-02"
    const dateObj = new Date(memo.date);
    if (!isNaN(dateObj)) {
      const year = dateObj.getFullYear();
      const monthNum = dateObj.getMonth() + 1; // 1-12
      const monthKey = `${year}-${monthNum}`;

      // 1. 若發現跨月份（或是第一筆），自動插入 Sticky 月份標題
      if (monthKey !== lastMonthYear) {
        lastMonthYear = monthKey;

        // 轉換英文月份名稱 (例如: September)
        const monthNameEN = dateObj.toLocaleString('en-US', { month: 'long' });

        const monthHeader = document.createElement('div');
        monthHeader.className = 'month-divider';
        monthHeader.innerHTML = `
          <span class="month-text">📅 ${monthNum} 月 ${monthNameEN}</span>
          <span class="year-badge">${year} 年</span>
        `;
        listContainer.appendChild(monthHeader);
      }
    }

    // 2. 正常渲染每一個 Memo 卡片 (保持你原本的卡片 HTML)
    const card = createMemoCardElement(memo); 
    listContainer.appendChild(card);
  });
}
/* 📅 渲染每日時間軸 */
function renderTimeline() {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = '';

  const datedLogs = allLogs.filter(item => item.date && item.date >= todayStr && !isItemDone(item.status) && !isItemArchived(item.status));
  
  const datesSet = new Set(datedLogs.map(i => i.date));
  datesSet.add(todayStr);
  datesSet.add(tomorrowStr);
  const sortedDates = Array.from(datesSet).sort();

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  sortedDates.forEach(dateVal => {
    const d = new Date(dateVal);
    const weekdayStr = weekdays[d.getDay()];
    const dayNum = d.getDate();
    const isToday = (dateVal === todayStr);
    const isTomorrow = (dateVal === tomorrowStr);

    let weekdayDisplay = weekdayStr;
    if (isToday) weekdayDisplay = '今天';
    else if (isTomorrow) weekdayDisplay = '明天';

    const dayItems = datedLogs.filter(i => i.date === dateVal);
    const pendingCount = dayItems.filter(i => !isNoteType(i.type)).length;

    const dayBlock = document.createElement('div');
    dayBlock.className = `day-block ${isToday ? 'is-today' : ''} ${isTomorrow ? 'is-tomorrow' : ''}`;
    if (isToday) dayBlock.id = 'todayBlock';

    dayBlock.innerHTML = `
      <div class="day-date-col">
        <span class="day-weekday">${weekdayDisplay}</span>
        <span class="day-number">${dayNum}</span>
      </div>
      <div class="day-content-col">
        ${pendingCount > 0 ? `<div class="pending-tasks-pill">☑ ${pendingCount} pending task${pendingCount > 1 ? 's' : ''}</div>` : ''}
        <div class="day-card-list" style="display:flex; flex-direction:column; gap:6px;"></div>
      </div>
    `;

    const cardList = dayBlock.querySelector('.day-card-list');
    if (dayItems.length === 0) {
      cardList.innerHTML = `<div style="font-size:0.8rem; color:#94a3b8; padding:4px 0;">無待辦事項 🎉</div>`;
    } else {
      dayItems.forEach(item => cardList.appendChild(createTaskCard(item)));
    }

    container.appendChild(dayBlock);
  });
}

/* 建立卡片元素 (點擊整張卡片開啟 Modal) */
function createTaskCard(item) {
  const card = document.createElement('div');
  const tagClass = getTagClasses(item);
  card.className = `task-card type-${item.type} ${tagClass}`;
  card.onclick = () => openEditModal(item.id);
  
  card.innerHTML = `
    <div class="task-info">
      <div class="task-title">${item.content}</div>
      ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
    </div>
  `;
  return card;
}

/* 1. ⚠️ 逾期工作 Modal (點擊卡片開啟編輯) */
function openOverdueModal() {
  renderOverdueModal();
  document.getElementById('overdueModal').style.display = 'flex';
}
function closeOverdueModal() {
  document.getElementById('overdueModal').style.display = 'none';
}
function renderOverdueModal() {
  const body = document.getElementById('overdueModalBody');
  body.innerHTML = '';

  const items = allLogs.filter(i => i.date && i.date < todayStr && !isItemDone(i.status) && !isItemArchived(i.status) && !isNoteType(i.type))
                       .sort((a,b) => b.date.localeCompare(a.date));

  if (items.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#059669; padding:20px 0; font-weight:bold;">✅ 目前沒有逾期的工作！</div>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
    row.onclick = () => openEditModal(item.id);
    row.innerHTML = `
      <div class="task-info">
        <div style="font-size:0.72rem; opacity:0.85; font-weight:bold;">📅 逾期日期：${item.date}</div>
        <div class="task-title">${item.content}</div>
        ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
      </div>
    `;
    body.appendChild(row);
  });
}

/* 2. 📥 未有日期工作 Modal (點擊卡片開啟編輯) */
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

  const items = allLogs.filter(i => (!i.date || i.date.trim() === '') && !isItemDone(i.status) && !isItemArchived(i.status) && !isNoteType(i.type));

  if (items.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">目前沒有未有日期的工作 🎉</div>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
    row.onclick = () => openEditModal(item.id);
    row.innerHTML = `
      <div class="task-info">
        <div class="task-title">${item.content}</div>
        ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
      </div>
    `;
    body.appendChild(row);
  });
}

/* 3. ✅ 已完成工作 Modal (點擊卡片開啟編輯) */
function openCompletedModal() {
  renderCompletedModal();
  document.getElementById('completedModal').style.display = 'flex';
}
function closeCompletedModal() {
  document.getElementById('completedModal').style.display = 'none';
}
function renderCompletedModal() {
  const body = document.getElementById('completedModalBody');
  body.innerHTML = '';

  const items = allLogs.filter(i => isItemDone(i.status))
                       .sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  if (items.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">尚無已完成的事項</div>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
    row.style.opacity = '0.85';
    row.onclick = () => openEditModal(item.id);
    row.innerHTML = `
      <div class="task-info">
        ${item.date ? `<div style="font-size:0.72rem; opacity:0.85;">📅 ${item.date}</div>` : `<div style="font-size:0.72rem; opacity:0.85;">📥 無日期</div>`}
        <div class="task-title" style="text-decoration:line-through;">${item.content}</div>
        ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
      </div>
    `;
    body.appendChild(row);
  });
}

/* 4. 📦 典藏庫 Modal (點擊卡片開啟編輯) */
function archiveItem(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  target.status = 'Archived';
  refreshAllViews();
  syncToSheet('toggleLog', { id: target.id, content: target.content, status: 'Archived' });
}

function openArchivedModal() {
  renderArchivedModal();
  document.getElementById('archivedModal').style.display = 'flex';
}

function closeArchivedModal() {
  document.getElementById('archivedModal').style.display = 'none';
}

function renderArchivedModal() {
  const body = document.getElementById('archivedModalBody');
  body.innerHTML = '';

  const items = allLogs.filter(i => isItemArchived(i.status))
                       .sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  if (items.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">典藏庫為空</div>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
    row.style.opacity = '0.75';
    row.onclick = () => openEditModal(item.id);
    row.innerHTML = `
      <div class="task-info">
        ${item.date ? `<div style="font-size:0.72rem; opacity:0.85;">📅 ${item.date}</div>` : `<div style="font-size:0.72rem; opacity:0.85;">📥 無日期</div>`}
        <div class="task-title">${item.content}</div>
        ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
      </div>
    `;
    body.appendChild(row);
  });
}

function unarchiveItem(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  target.status = 'Pending';
  refreshAllViews();
  syncToSheet('toggleLog', { id: target.id, content: target.content, status: 'Pending' });
}

/* 快捷操作與 Modal 控制 */
function assignToToday(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;
  target.date = todayStr;
  
  refreshAllViews();
  syncToSheet('editLog', { id: target.id, oldContent: target.content, date: target.date, type: target.type, content: target.content, remarks: target.remarks });
}

function refreshAllViews() {
  renderTimeline();
  updateAllBadges();
  if (document.getElementById('overdueModal').style.display === 'flex') renderOverdueModal();
  if (document.getElementById('backlogModal').style.display === 'flex') renderBacklogModal();
  if (document.getElementById('completedModal').style.display === 'flex') renderCompletedModal();
  if (document.getElementById('archivedModal').style.display === 'flex') renderArchivedModal();
}

function openAddModal() {
  document.getElementById('modalFormTitle').textContent = '➕ 新增事項';
  document.getElementById('modalItemId').value = '';
  document.getElementById('modalDate').value = todayStr;
  document.getElementById('modalType').value = 'Task';
  document.getElementById('modalContent').value = '';
  document.getElementById('modalRemarks').value = '';
  
  updateModalButtonsState();
  document.getElementById('itemModal').style.display = 'flex';
}

function openEditModal(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  document.getElementById('modalFormTitle').textContent = '✏️ 編輯 / 操作事項';
  document.getElementById('modalItemId').value = target.id;
  document.getElementById('modalDate').value = target.date || '';
  document.getElementById('modalType').value = target.type;
  document.getElementById('modalContent').value = target.content;
  document.getElementById('modalRemarks').value = target.remarks || '';

  updateModalButtonsState(target);
  document.getElementById('itemModal').style.display = 'flex';
}

/* 動態調配 Modal 內部的按鈕組合 */
function updateModalButtonsState(targetItem) {
  const id = document.getElementById('modalItemId').value;
  const currentType = document.getElementById('modalType').value;
  
  const btnDelete = document.getElementById('btnDelete');
  const btnArchive = document.getElementById('btnArchive');
  const btnAssignToday = document.getElementById('btnAssignTodayModal');
  const btnToggleDone = document.getElementById('btnToggleDoneModal');

  if (!id) {
    btnDelete.style.display = 'none';
    btnArchive.style.display = 'none';
    btnAssignToday.style.display = 'none';
    btnToggleDone.style.display = 'none';
    return;
  }

  const target = targetItem || allLogs.find(l => l.id === id);
  btnDelete.style.display = 'inline-block';
  
  // 典藏按鈕
  btnArchive.style.display = 'inline-block';
  if (target && isItemArchived(target.status)) {
    btnArchive.textContent = '↺ 取消典藏';
    btnArchive.onclick = () => { unarchiveItem(id); closeItemModal(); };
  } else {
    btnArchive.textContent = '📦 典藏';
    btnArchive.onclick = () => archiveFromModal();
  }

  // 移至今天按鈕
  if (target && target.date !== todayStr && !isItemDone(target.status)) {
    btnAssignToday.style.display = 'inline-block';
  } else {
    btnAssignToday.style.display = 'none';
  }

  // 筆記 (Note) 隱藏「完成」按鈕
  if (isNoteType(currentType)) {
    btnToggleDone.style.display = 'none';
  } else {
    btnToggleDone.style.display = 'inline-block';
    if (target && isItemDone(target.status)) {
      btnToggleDone.textContent = '↺ 還原待辦';
      btnToggleDone.style.background = '#e0f2fe';
      btnToggleDone.style.color = '#0284c7';
      btnToggleDone.style.borderColor = '#bae6fd';
    } else {
      btnToggleDone.textContent = '✅ 標示完成';
      btnToggleDone.style.background = '#dcfce7';
      btnToggleDone.style.color = '#15803d';
      btnToggleDone.style.borderColor = '#86efac';
    }
  }
}

function assignToTodayFromModal() {
  const id = document.getElementById('modalItemId').value;
  if (!id) return;
  assignToToday(id);
  closeItemModal();
}

function toggleDoneFromModal() {
  const id = document.getElementById('modalItemId').value;
  if (!id) return;

  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  const newStatus = isItemDone(target.status) ? 'Pending' : '完成';
  target.status = newStatus;

  closeItemModal();
  refreshAllViews();
  syncToSheet('toggleLog', { id: target.id, content: target.content, status: newStatus });
}

function archiveFromModal() {
  const id = document.getElementById('modalItemId').value;
  if (!id) return;

  archiveItem(id);
  closeItemModal();
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
    const target = allLogs.find(l => l.id === id);
    if (target) {
      const oldContent = target.content;
      target.date = date; target.type = type; target.content = content; target.remarks = remarks;
      syncToSheet('editLog', { id, oldContent, date, type, content, remarks });
    }
  } else {
    const newId = 'L' + new Date().getTime();
    const newItem = { id: newId, date, type, content, status: 'Pending', remarks };
    allLogs.push(newItem);
    syncToSheet('addLog', { id: newId, date, type, content, status: 'Pending', remarks });
  }

  closeItemModal();
  refreshAllViews();
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
  refreshAllViews();
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

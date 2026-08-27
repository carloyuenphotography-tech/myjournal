/* ⚙️ 中央分類設定集 */
const CATEGORIES = [
  { id: 'all',      name: '✨ 全部事項', tag: '',           bg: '',        color: '' },
  { id: 'personal', name: '👤 個人',      tag: '#personal', bg: '#f3e8ff', color: '#581c87', isDefault: true },
  { id: 'sch',      name: '🏫 學校/學業', tag: '#sch',      bg: '#FFE06B', color: '#38751e' },
  { id: 'family',   name: '🏠 家庭/家',   tag: '#family',   bg: '#dcfce7', color: '#14532d' },
  { id: 'work',     name: '💼 工作/辦公', tag: '#work',     bg: '#e0f2fe', color: '#075985' },
  { id: 'urgent',   name: '🔥 重要/緊急', tag: '#urgent',   bg: '#ffe4e6', color: '#9f1239' },
  { id: 'finance',  name: '💰 財務/購物', tag: '#finance',  bg: '#ffedd5', color: '#9a3412' },
  { id: 'health',   name: '🌿 健康/運動', tag: '#health',   bg: '#ccfbf1', color: '#115e59' },
  { id: 'photo',    name: '📷 攝影/天氣', tag: '#photo',    bg: '#1E1542', color: '#C5BCDE' }
];


let allLogs = [];
let currentCategoryFilter = 'all';

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
  initCategoriesInfrastructure();

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

function initCategoriesInfrastructure() {
  let styleEl = document.getElementById('dynamicCatStyles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamicCatStyles';
    document.head.appendChild(styleEl);
  }
  let cssText = '';
  CATEGORIES.forEach(c => {
    if (c.id !== 'all' && c.bg) {
      cssText += `.task-card.tag-${c.id} { background-color: ${c.bg} !important; color: ${c.color} !important; }\n`;
    }
  });
  styleEl.textContent = cssText;

  const sidebar = document.getElementById('sidebarCategories');
  if (sidebar) {
    sidebar.innerHTML = '<div class="sidebar-title">看板分類</div>';
    CATEGORIES.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cat-btn ${c.id === currentCategoryFilter ? 'active' : ''}`;
      btn.dataset.cat = c.id;
      btn.onclick = () => setCategoryFilter(c.id);
      btn.textContent = c.name;
      sidebar.appendChild(btn);
    });
  }

  const quickCatSelect = document.getElementById('quickCategory');
  if (quickCatSelect) {
    quickCatSelect.innerHTML = '';
    CATEGORIES.forEach(c => {
      if (c.id !== 'all') {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        if (c.isDefault) opt.selected = true;
        quickCatSelect.appendChild(opt);
      }
    });
  }
}

function initializeApp() {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.cancel();
  }
  if (document.getElementById('authOverlay')) document.getElementById('authOverlay').style.display = 'none';
  if (document.getElementById('mainContainer')) document.getElementById('mainContainer').style.display = 'block';

  const quickDateInput = document.getElementById('quickDate');
  if (quickDateInput) quickDateInput.value = todayStr;

  triggerRecurringCheck();
  loadLogsData();
}

function triggerRecurringCheck() {
  const apiUrl = CONFIG.API_URLS ? CONFIG.API_URLS.DAILY : '';
  if (apiUrl) {
    fetch(`${apiUrl}?action=runTrigger`, { mode: 'no-cors' });
  }
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

function getProp(obj, keyNames) {
  if (!obj) return '';
  for (let k of Object.keys(obj)) {
    if (keyNames.includes(k.trim().toLowerCase())) {
      return obj[k];
    }
  }
  return '';
}

function parseLogs(rows) {
  if (!rows) return [];
  return rows.map((r, i) => {
    const idVal = getProp(r, ['id']);
    const dateVal = getProp(r, ['date', '日期']);
    const typeVal = getProp(r, ['type', '類型']);
    const contentVal = getProp(r, ['content', '內容']);
    const statusVal = getProp(r, ['status', '狀態']);
    const remarksVal = getProp(r, ['remarks', '備註']);

    const finalId = (idVal && String(idVal).trim() !== '') 
      ? String(idVal).trim() 
      : `L_${i}_${Math.random().toString(36).substr(2, 5)}`;

    return {
      id: finalId,
      date: String(dateVal || '').trim(),
      type: String(typeVal || 'Task').trim(),
      content: String(contentVal || '').trim(),
      status: String(statusVal || 'Pending').trim(),
      remarks: String(remarksVal || '').trim()
    };
  });
}

function setCategoryFilter(category) {
  currentCategoryFilter = category;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    if (btn.dataset.cat === category) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  refreshAllViews();
}

function handleQuickSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('quickType').value;
  const catId = document.getElementById('quickCategory').value;
  const isBacklog = document.getElementById('quickIsBacklog').checked;
  let content = document.getElementById('quickContent').value.trim();
  const quickDateVal = document.getElementById('quickDate').value;

  if (!content) return;

  let remarks = '';
  const targetCatObj = CATEGORIES.find(c => c.id === catId);
  if (targetCatObj && targetCatObj.tag) {
    remarks = targetCatObj.tag;
  }

  const newId = 'L' + new Date().getTime();
  const targetDate = isBacklog ? '' : (quickDateVal || todayStr);

  const newItem = {
    id: newId,
    date: targetDate,
    type: type,
    content: content,
    status: 'Pending',
    remarks: remarks
  };

  allLogs.push(newItem);

  document.getElementById('quickContent').value = '';
  document.getElementById('quickIsBacklog').checked = false;

  refreshAllViews();
  syncToSheet('addLog', { id: newId, date: targetDate, type, content, status: 'Pending', remarks: remarks });
}

function isItemDone(status) {
  return status === '完成' || status === 'Done';
}

function isItemArchived(status) {
  return status === 'Archived' || status === '已典藏';
}

function isNoteType(type) {
  if (!type) return false;
  const t = String(type).trim().toLowerCase();
  return t === '筆記' || t === 'note' || t === '-';
}

function getTagClasses(item) {
  const text = ((item.content || '') + ' ' + (item.remarks || '')).toLowerCase();
  const classes = [];
  CATEGORIES.forEach(c => {
    if (c.tag && text.includes(c.tag.toLowerCase())) {
      classes.push(`tag-${c.id}`);
    }
  });
  return classes.join(' ');
}

function updateAllBadges() {
  const overdueCount = allLogs.filter(i => i.date && i.date < todayStr && !isItemDone(i.status) && !isItemArchived(i.status) && !isNoteType(i.type)).length;
  const backlogCount = allLogs.filter(i => (!i.date || i.date.trim() === '') && !isItemDone(i.status) && !isItemArchived(i.status)).length;
  const completedCount = allLogs.filter(i => isItemDone(i.status)).length;
  const archivedCount = allLogs.filter(i => isItemArchived(i.status)).length;

  if (document.getElementById('overdueBadgeCount')) document.getElementById('overdueBadgeCount').textContent = overdueCount;
  if (document.getElementById('backlogBadgeCount')) document.getElementById('backlogBadgeCount').textContent = backlogCount;
  if (document.getElementById('completedBadgeCount')) document.getElementById('completedBadgeCount').textContent = completedCount;
  if (document.getElementById('archivedBadgeCount')) document.getElementById('archivedBadgeCount').textContent = archivedCount;
}

function renderTimeline() {
  const container = document.getElementById('timelineContainer');
  if (!container) return;
  container.innerHTML = '';

  const datedLogs = allLogs.filter(item => item.date && item.date >= todayStr && !isItemDone(item.status) && !isItemArchived(item.status));

  let filteredLogs = datedLogs;
  if (currentCategoryFilter !== 'all') {
    filteredLogs = datedLogs.filter(item => getTagClasses(item).includes(`tag-${currentCategoryFilter}`));
  }

  const datesSet = new Set(filteredLogs.map(i => i.date));
  datesSet.add(todayStr);
  datesSet.add(tomorrowStr);
  const sortedDates = Array.from(datesSet).sort();

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  sortedDates.forEach(dateVal => {
    const d = new Date(dateVal);
    const weekdayStr = weekdays[d.getDay()];
    const dateParts = dateVal.split('-');
    const dayNum = dateParts[2] ? parseInt(dateParts[2], 10) : d.getDate();
    const isToday = (dateVal === todayStr);
    const isTomorrow = (dateVal === tomorrowStr);

    let weekdayDisplay = weekdayStr;
    if (isToday) weekdayDisplay = '今天';
    else if (isTomorrow) weekdayDisplay = '明天';

    let dayItems = filteredLogs.filter(i => i.date === dateVal);
    const pendingCount = dayItems.filter(i => !isNoteType(i.type)).length;

    const dayBlock = document.createElement('div');
    dayBlock.className = `day-block ${isToday ? 'is-today' : ''} ${isTomorrow ? 'is-tomorrow' : ''}`;
    if (isToday) dayBlock.id = 'todayBlock';

    dayBlock.innerHTML = `
      <div class="day-date-col" onclick="openAddModal('${dateVal}')" style="cursor:pointer;" title="點擊在 ${dateVal} 新增事項">
        <span class="day-weekday">${weekdayDisplay}</span>
        <span class="day-number">${dayNum}</span>
        <span style="font-size:0.65rem; color:var(--primary); margin-top:2px; font-weight:bold; opacity:0.85;">➕ 新增</span>
      </div>
      <div class="day-content-col">
        ${pendingCount > 0 ? `<div class="pending-tasks-pill">☑ ${pendingCount} pending task${pendingCount > 1 ? 's' : ''}</div>` : ''}
        <div class="day-card-list" data-date="${dateVal}" style="display:flex; flex-direction:column; gap:6px;"></div>
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

function createTaskCard(item) {
  const card = document.createElement('div');
  const tagClass = getTagClasses(item);
  card.className = `task-card type-${item.type} ${tagClass}`;
  card.dataset.id = item.id;
  card.onclick = (e) => { e.stopPropagation(); openEditModal(item); };

  let displayTitle = item.content;
  let locationBadgeHtml = '';

  const match = displayTitle.match(/@([^\s#(\[]+)(?:\((.*?)\))?/);
  if (match) {
    const locText = match[1];
    const timeText = match[2];
    displayTitle = displayTitle.replace(/@[^\s#]+(\(.*?\))?/, '').trim();
    locationBadgeHtml = `
      <span class="location-badge">
        📍 ${locText}
        ${timeText ? `<span class="loc-time">🕒 ${timeText}</span>` : ''}
      </span>
    `;
  }

  card.innerHTML = `
    <div class="task-info">
      <div class="task-title">${displayTitle}</div>
      ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
      ${locationBadgeHtml}
    </div>
    <div class="drag-handle" title="拖曳排序" onclick="event.stopPropagation()">⋮⋮</div>
  `;
  return card;
}

function refreshAllViews() {
  renderTimeline();
  updateAllBadges();
}

/* ⚡ Modal 開啟/編輯/按鈕狀態控制 */

function openAddModal(presetDate) {
  document.getElementById('modalFormTitle').textContent = '➕ 新增事項';
  document.getElementById('modalItemId').value = '';
  document.getElementById('modalDate').value = presetDate || todayStr;
  document.getElementById('modalType').value = 'Task';
  document.getElementById('modalContent').value = '';
  document.getElementById('modalRemarks').value = '';

  updateModalButtonsState();
  document.getElementById('itemModal').style.display = 'flex';
}

function openEditModal(targetOrId) {
  let target = null;
  if (typeof targetOrId === 'object' && targetOrId !== null) {
    target = targetOrId;
  } else {
    target = allLogs.find(l => String(l.id) === String(targetOrId));
  }

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

function updateModalButtonsState(targetItem) {
  const id = document.getElementById('modalItemId')?.value;
  const currentType = document.getElementById('modalType')?.value;

  const btnDelete = document.getElementById('btnDelete');
  const btnArchive = document.getElementById('btnArchive');
  const btnAssignToday = document.getElementById('btnAssignTodayModal');
  const btnToggleDone = document.getElementById('btnToggleDoneModal');

  // 若為「新增」模式，隱藏所有操作按鈕
  if (!id) {
    if (btnDelete) btnDelete.style.display = 'none';
    if (btnArchive) btnArchive.style.display = 'none';
    if (btnAssignToday) btnAssignToday.style.display = 'none';
    if (btnToggleDone) btnToggleDone.style.display = 'none';
    return;
  }

  const target = targetItem || allLogs.find(l => String(l.id) === String(id));

  // 1. 刪除按鈕
  if (btnDelete) btnDelete.style.display = 'inline-block';

  // 2. 典藏按鈕
  if (btnArchive) {
    btnArchive.style.display = 'inline-block';
    if (target && isItemArchived(target.status)) {
      btnArchive.textContent = '↺ 取消典藏';
      btnArchive.onclick = () => { unarchiveItem(id); closeItemModal(); };
    } else {
      btnArchive.textContent = '📦 典藏';
      btnArchive.onclick = () => archiveFromModal();
    }
  }

  // 3. 排至今天按鈕
  if (btnAssignToday) {
    if (target && target.date !== todayStr && !isItemDone(target.status)) {
      btnAssignToday.style.display = 'inline-block';
    } else {
      btnAssignToday.style.display = 'none';
    }
  }

  // 4. 完成 / 還原按鈕
  if (btnToggleDone) {
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
}

/* ⚡ Modal 操作按鈕觸發函式 */

function toggleDoneFromModal() {
  const id = document.getElementById('modalItemId').value;
  if (!id) return;

  const target = allLogs.find(l => String(l.id) === String(id));
  if (!target) return;

  const newStatus = isItemDone(target.status) ? 'Pending' : '完成';
  target.status = newStatus;

  closeItemModal();
  refreshAllViews();

  syncToSheet('toggleLog', { 
    id: target.id, 
    content: target.content, 
    oldContent: target.content,
    date: target.date,
    type: target.type,
    remarks: target.remarks,
    status: newStatus 
  });
}

function archiveFromModal() {
  const id = document.getElementById('modalItemId').value;
  if (!id) return;

  const target = allLogs.find(l => String(l.id) === String(id));
  if (!target) return;

  target.status = 'Archived';
  closeItemModal();
  refreshAllViews();

  syncToSheet('toggleLog', { 
    id: target.id, 
    content: target.content, 
    oldContent: target.content,
    date: target.date,
    type: target.type,
    remarks: target.remarks,
    status: 'Archived' 
  });
}

function assignToTodayFromModal() {
  const id = document.getElementById('modalItemId').value;
  if (!id) return;

  const target = allLogs.find(l => String(l.id) === String(id));
  if (!target) return;

  target.date = todayStr;
  closeItemModal();
  refreshAllViews();

  syncToSheet('editLog', { 
    id: target.id, 
    oldContent: target.content, 
    date: todayStr, 
    type: target.type, 
    content: target.content, 
    remarks: target.remarks, 
    status: target.status 
  });
}

function deleteCurrentItem() {
  const id = document.getElementById('modalItemId').value;
  if (!id || !confirm('確定要刪除這筆事項嗎？')) return;

  const idx = allLogs.findIndex(l => String(l.id) === String(id));
  if (idx !== -1) {
    const target = allLogs[idx];
    allLogs.splice(idx, 1);
    syncToSheet('deleteLog', { id: target.id, content: target.content });
  }

  closeItemModal();
  refreshAllViews();
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
    const target = allLogs.find(l => String(l.id) === String(id));
    if (target) {
      const oldContent = target.content;
      target.date = date; target.type = type; target.content = content; target.remarks = remarks;
      syncToSheet('editLog', { id, oldContent, date, type, content, remarks, status: target.status });
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

function syncToSheet(action, paramsObj) {
  const apiUrl = CONFIG.API_URLS ? CONFIG.API_URLS.DAILY : '';
  if (!apiUrl) return;

  const params = new URLSearchParams({ action, key: CONFIG.SECRET_KEY || '', ...paramsObj });
  fetch(`${apiUrl}?${params.toString()}`, { mode: 'no-cors' });
}

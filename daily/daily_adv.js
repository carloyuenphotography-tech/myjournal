/* ⚙️ 中央分類設定集 */
const CATEGORIES = [
  { id: 'all',      name: '✨ 全部事項', tag: '',           bg: '',        color: '' },
  { id: 'personal', name: '👤 個人',      tag: '#personal', bg: '#f3e8ff', color: '#581c87', isDefault: true },
  { id: 'sch',      name: '🏫 學校/學業', tag: '#sch',      bg: '#FFE06B', color: '#65B253' },
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
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('mainContainer').style.display = 'block';

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
      checkFrontendRecurring();
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

function checkFrontendRecurring() {
  const sheetId = CONFIG.DAILY_SHEET_ID;
  const recGid = CONFIG.GIDS ? CONFIG.GIDS.DAILY_RECURRING : null;
  if (!sheetId || !recGid) return;

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${recGid}&t=${new Date().getTime()}`;

  Papa.parse(csvUrl, {
    download: true, header: true, skipEmptyLines: true,
    complete: (results) => {
      if (!results.data) return;
      const today = new Date();
      let added = false;

      results.data.forEach((r, idx) => {
        const frequency = String(getProp(r, ['frequency', '頻率']) || '').trim();
        const content = String(getProp(r, ['content', '內容', '事項']) || '').trim();
        const type = String(getProp(r, ['type', '類型']) || 'Task').trim();
        const dayParam = String(getProp(r, ['dayparam', '日期參數', 'day']) || '').trim();
        const remarks = String(getProp(r, ['remarks', '備註']) || '').trim();

        if (!frequency || !content) return;

        const targetDateStr = calcTargetDate(frequency, dayParam, today);
        if (!targetDateStr) return;

        const exists = allLogs.some(log => log.content === content && log.date === targetDateStr);

        if (!exists) {
          const newId = 'L_REC_' + new Date().getTime() + '_' + idx;
          const newItem = { id: newId, date: targetDateStr, type, content, status: 'Pending', remarks };
          allLogs.push(newItem);
          added = true;

          syncToSheet('addLog', { id: newId, date: targetDateStr, type, content, status: 'Pending', remarks });
        }
      });

      if (added) {
        refreshAllViews();
      }
    }
  });
}

function calcTargetDate(frequency, dayParam, today) {
  const year = today.getFullYear();
  const month = today.getMonth();

  if (frequency === 'MONTHLY_END') {
    const d = new Date(year, month + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (frequency === 'MONTHLY_DAY') {
    const day = parseInt(dayParam || '1', 10);
    const d = new Date(year, month, day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (frequency === 'QUARTERLY_END') {
    const qEndMonths = [2, 5, 8, 11];
    let qMonth = qEndMonths.find(m => m >= month);
    let qYear = year;
    if (qMonth === undefined) { qMonth = 2; qYear = year + 1; }
    const d = new Date(qYear, qMonth + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (frequency === 'YEARLY') {
    if (!dayParam || !dayParam.includes('-')) return null;
    const [mStr, dStr] = dayParam.split('-');
    return `${year}-${String(mStr).padStart(2, '0')}-${String(dStr).padStart(2, '0')}`;
  }
  return null;
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

function toggleQuickDateInput(chk) {
  const dt = document.getElementById('quickDate');
  if (dt) {
    dt.disabled = chk.checked;
    dt.style.opacity = chk.checked ? '0.4' : '1';
  }
}

function handleQuickSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('quickType').value;
  const catId = document.getElementById('quickCategory').value;
  const isBacklog = document.getElementById('quickIsBacklog').checked;
  let content = document.getElementById('quickContent').value.trim();
  const quickDateVal = document.getElementById('quickDate').value;

  if (!content) return;

  const targetCatObj = CATEGORIES.find(c => c.id === catId);
  if (targetCatObj && targetCatObj.tag) {
    if (!content.toLowerCase().includes(targetCatObj.tag.toLowerCase())) {
      content += ` ${targetCatObj.tag}`;
    }
  }

  const newId = 'L' + new Date().getTime();
  const targetDate = isBacklog ? '' : (quickDateVal || todayStr);

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
  toggleQuickDateInput(document.getElementById('quickIsBacklog'));

  refreshAllViews();
  syncToSheet('addLog', { id: newId, date: targetDate, type, content, status: 'Pending', remarks: '' });
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
  const pastNotesCount = allLogs.filter(i => i.date && i.date < todayStr && !isItemArchived(i.status) && isNoteType(i.type)).length;
  const backlogCount = allLogs.filter(i => (!i.date || i.date.trim() === '') && !isItemDone(i.status) && !isItemArchived(i.status)).length;
  const completedCount = allLogs.filter(i => isItemDone(i.status)).length;
  const archivedCount = allLogs.filter(i => isItemArchived(i.status)).length;

  document.getElementById('overdueBadgeCount').textContent = overdueCount + pastNotesCount;
  document.getElementById('backlogBadgeCount').textContent = backlogCount;
  document.getElementById('completedBadgeCount').textContent = completedCount;
  document.getElementById('archivedBadgeCount').textContent = archivedCount;
}

/* 💾 本地記憶體排序記錄管理 */
function saveDayOrder(dateStr, cardIds) {
  try {
    const savedOrders = JSON.parse(localStorage.getItem('daily_card_orders') || '{}');
    savedOrders[dateStr] = cardIds;
    localStorage.setItem('daily_card_orders', JSON.stringify(savedOrders));
  } catch (e) {}
}

function getDayOrder(dateStr) {
  try {
    const savedOrders = JSON.parse(localStorage.getItem('daily_card_orders') || '{}');
    return savedOrders[dateStr] || null;
  } catch (e) { return null; }
}

function renderTimeline() {
  const container = document.getElementById('timelineContainer');
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

  let lastMonthYear = '';

  sortedDates.forEach(dateVal => {
    const dateParts = dateVal.split('-');
    if (dateParts.length === 3) {
      const year = dateParts[0];
      const monthNum = parseInt(dateParts[1], 10);
      const monthKey = `${year}-${monthNum}`;

      if (monthKey !== lastMonthYear) {
        lastMonthYear = monthKey;

        const dObj = new Date(year, monthNum - 1, 1);
        const monthNameEN = dObj.toLocaleString('en-US', { month: 'long' });

        const monthHeader = document.createElement('div');
        monthHeader.className = 'month-divider';
        monthHeader.innerHTML = `
          <span class="month-text">📅 ${monthNum} 月 ${monthNameEN}</span>
          <span class="year-badge">${year} 年</span>
        `;
        container.appendChild(monthHeader);
      }
    }

    const d = new Date(dateVal);
    const weekdayStr = weekdays[d.getDay()];
    const dayNum = dateParts[2] ? parseInt(dateParts[2], 10) : d.getDate();
    const isToday = (dateVal === todayStr);
    const isTomorrow = (dateVal === tomorrowStr);

    let weekdayDisplay = weekdayStr;
    if (isToday) weekdayDisplay = '今天';
    else if (isTomorrow) weekdayDisplay = '明天';

    let dayItems = filteredLogs.filter(i => i.date === dateVal);

    // 🎯 套用儲存好的自訂排序
    const savedOrder = getDayOrder(dateVal);
    if (savedOrder && Array.isArray(savedOrder)) {
      dayItems.sort((a, b) => {
        let idxA = savedOrder.indexOf(String(a.id));
        let idxB = savedOrder.indexOf(String(b.id));
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });
    }

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

  initSortable();
}

function createTaskCard(item) {
  const card = document.createElement('div');
  const tagClass = getTagClasses(item);
  card.className = `task-card type-${item.type} ${tagClass}`;
  card.dataset.id = item.id;
  card.onclick = (e) => {
    e.stopPropagation();
    openEditModal(item);
  };

  card.innerHTML = `
    <div class="task-info">
      <div class="task-title">${item.content}</div>
      ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
    </div>
    <div class="drag-handle" title="拖曳排序" onclick="event.stopPropagation()">⋮⋮</div>
  `;
  return card;
}

/* ⚡ 初始化 SortableJS 並在拖曳完畢時自動記憶順序 */
function initSortable() {
  if (typeof Sortable === 'undefined') return;

  const lists = document.querySelectorAll('.day-card-list');
  lists.forEach(list => {
    new Sortable(list, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: function (evt) {
        const dateStr = evt.from.dataset.date;
        if (!dateStr) return;

        // 擷取目前列表中所有卡片的 ID 順序並儲存
        const currentCardIds = Array.from(evt.from.children)
                                    .map(card => card.dataset.id)
                                    .filter(Boolean);
        saveDayOrder(dateStr, currentCardIds);
      }
    });
  });
}

function sortReverseChronological(items) {
  return items.sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    return String(b.id).localeCompare(String(a.id));
  });
}

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

  const overdueTasks = sortReverseChronological(
    allLogs.filter(i => i.date && i.date < todayStr && !isItemDone(i.status) && !isItemArchived(i.status) && !isNoteType(i.type))
  );

  const pastNotes = sortReverseChronological(
    allLogs.filter(i => i.date && i.date < todayStr && !isItemArchived(i.status) && isNoteType(i.type))
  );

  if (overdueTasks.length === 0 && pastNotes.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#059669; padding:20px 0; font-weight:bold;">✅ 目前沒有逾期工作或過往筆記！</div>`;
    return;
  }

  if (overdueTasks.length > 0) {
    const tEl = document.createElement('div');
    tEl.style.cssText = "font-weight:bold; font-size:0.85rem; color:#991b1b; margin-bottom:6px;";
    tEl.textContent = "⚠️ 逾期任務與事件";
    body.appendChild(tEl);

    overdueTasks.forEach(item => {
      const row = document.createElement('div');
      row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
      row.onclick = () => openEditModal(item);
      row.innerHTML = `
        <div class="task-info">
          <div style="font-size:0.72rem; opacity:0.85; font-weight:bold;">📅 日期：${item.date}</div>
          <div class="task-title">${item.content}</div>
          ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
        </div>
      `;
      body.appendChild(row);
    });
  }

  if (pastNotes.length > 0) {
    const nEl = document.createElement('div');
    nEl.style.cssText = "font-weight:bold; font-size:0.85rem; color:#475569; margin:14px 0 6px 0;";
    nEl.textContent = "📝 過往筆記 (Past Notes)";
    body.appendChild(nEl);

    pastNotes.forEach(item => {
      const row = document.createElement('div');
      row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
      row.onclick = () => openEditModal(item);
      row.innerHTML = `
        <div class="task-info">
          <div style="font-size:0.72rem; opacity:0.85; font-weight:bold;">📅 日期：${item.date}</div>
          <div class="task-title">${item.content}</div>
          ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
        </div>
      `;
      body.appendChild(row);
    });
  }
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

  const items = allLogs.filter(i => (!i.date || i.date.trim() === '') && !isItemDone(i.status) && !isItemArchived(i.status));
  const tasks = sortReverseChronological(items.filter(i => !isNoteType(i.type)));
  const notes = sortReverseChronological(items.filter(i => isNoteType(i.type)));

  if (tasks.length === 0 && notes.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">目前沒有未有日期的工作與筆記 🎉</div>`;
    return;
  }

  if (tasks.length > 0) {
    const tEl = document.createElement('div');
    tEl.style.cssText = "font-weight:bold; font-size:0.85rem; color:#7e22ce; margin-bottom:6px;";
    tEl.textContent = "☑️ 未有日期任務與事件";
    body.appendChild(tEl);

    tasks.forEach(item => {
      const row = document.createElement('div');
      row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
      row.onclick = () => openEditModal(item);
      row.innerHTML = `
        <div class="task-info">
          <div class="task-title">${item.content}</div>
          ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
        </div>
      `;
      body.appendChild(row);
    });
  }

  if (notes.length > 0) {
    const nEl = document.createElement('div');
    nEl.style.cssText = "font-weight:bold; font-size:0.85rem; color:#475569; margin:14px 0 6px 0;";
    nEl.textContent = "📝 未有日期筆記";
    body.appendChild(nEl);

    notes.forEach(item => {
      const row = document.createElement('div');
      row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
      row.onclick = () => openEditModal(item);
      row.innerHTML = `
        <div class="task-info">
          <div class="task-title">${item.content}</div>
          ${item.remarks ? `<div class="task-remarks">💬 ${item.remarks}</div>` : ''}
        </div>
      `;
      body.appendChild(row);
    });
  }
}

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

  const items = allLogs.filter(i => isItemDone(i.status));
  const tasks = sortReverseChronological(items.filter(i => !isNoteType(i.type)));
  const notes = sortReverseChronological(items.filter(i => isNoteType(i.type)));

  if (tasks.length === 0 && notes.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">尚無已完成的事項</div>`;
    return;
  }

  if (tasks.length > 0) {
    const tEl = document.createElement('div');
    tEl.style.cssText = "font-weight:bold; font-size:0.85rem; color:#166534; margin-bottom:6px;";
    tEl.textContent = "✅ 已完成任務與事件";
    body.appendChild(tEl);

    tasks.forEach(item => {
      const row = document.createElement('div');
      row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
      row.style.opacity = '0.85';
      row.onclick = () => openEditModal(item);
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

  if (notes.length > 0) {
    const nEl = document.createElement('div');
    nEl.style.cssText = "font-weight:bold; font-size:0.85rem; color:#475569; margin:14px 0 6px 0;";
    nEl.textContent = "📝 已完成筆記";
    body.appendChild(nEl);

    notes.forEach(item => {
      const row = document.createElement('div');
      row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
      row.style.opacity = '0.85';
      row.onclick = () => openEditModal(item);
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
}

function archiveItem(id) {
  const target = allLogs.find(l => String(l.id) === String(id));
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

  const items = allLogs.filter(i => isItemArchived(i.status));
  const tasks = sortReverseChronological(items.filter(i => !isNoteType(i.type)));
  const notes = sortReverseChronological(items.filter(i => isNoteType(i.type)));

  if (tasks.length === 0 && notes.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">典藏庫為空</div>`;
    return;
  }

  if (tasks.length > 0) {
    const tEl = document.createElement('div');
    tEl.style.cssText = "font-weight:bold; font-size:0.85rem; color:#475569; margin-bottom:6px;";
    tEl.textContent = "📦 典藏任務與事件";
    body.appendChild(tEl);

    tasks.forEach(item => {
      const row = document.createElement('div');
      row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
      row.style.opacity = '0.75';
      row.onclick = () => openEditModal(item);
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

  if (notes.length > 0) {
    const nEl = document.createElement('div');
    nEl.style.cssText = "font-weight:bold; font-size:0.85rem; color:#475569; margin:14px 0 6px 0;";
    nEl.textContent = "📝 典藏筆記";
    body.appendChild(nEl);

    notes.forEach(item => {
      const row = document.createElement('div');
      row.className = `task-card type-${item.type} ${getTagClasses(item)}`;
      row.style.opacity = '0.75';
      row.onclick = () => openEditModal(item);
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
}

function unarchiveItem(id) {
  const target = allLogs.find(l => String(l.id) === String(id));
  if (!target) return;

  target.status = 'Pending';
  refreshAllViews();
  syncToSheet('toggleLog', { id: target.id, content: target.content, status: 'Pending' });
}

function assignToToday(id) {
  const target = allLogs.find(l => String(l.id) === String(id));
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

function openEditModal(targetOrId) {
  let target = null;
  if (typeof targetOrId === 'object' && targetOrId !== null) {
    target = targetOrId;
  } else {
    target = allLogs.find(l => String(l.id) === String(targetOrId));
  }

  if (!target) {
    alert('⚠️ 找不到該事項資料');
    return;
  }

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

  if (!id) {
    if (btnDelete) btnDelete.style.display = 'none';
    if (btnArchive) btnArchive.style.display = 'none';
    if (btnAssignToday) btnAssignToday.style.display = 'none';
    if (btnToggleDone) btnToggleDone.style.display = 'none';
    return;
  }

  const target = targetItem || allLogs.find(l => String(l.id) === String(id));

  if (btnDelete) btnDelete.style.display = 'inline-block';

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

  if (btnAssignToday) {
    if (target && target.date !== todayStr && !isItemDone(target.status)) {
      btnAssignToday.style.display = 'inline-block';
    } else {
      btnAssignToday.style.display = 'none';
    }
  }

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

function assignToTodayFromModal() {
  const id = document.getElementById('modalItemId').value;
  if (!id) return;
  assignToToday(id);
  closeItemModal();
}

function toggleDoneFromModal() {
  const id = document.getElementById('modalItemId').value;
  if (!id) return;

  const target = allLogs.find(l => String(l.id) === String(id));
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
    const target = allLogs.find(l => String(l.id) === String(id));
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

  const idx = allLogs.findIndex(l => String(l.id) === String(id));
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

let allLogs = [];
let activeTagFilter = null;
let activeTypeFilter = 'ALL';
let activeStatusFilter = 'ALL';

let API_URL = '';
let GID = '';
let SHEET_ID = '';

let currentNavDate = new Date();
currentNavDate.setDate(1);

function initGoogleSignIn() {
  if (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_CLIENT_ID) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
      document.getElementById("googleSignInContainer"),
      { theme: "outline", size: "large", type: "standard", shape: "rectangular" }
    );
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadNavbar();
  if (typeof CONFIG !== 'undefined') {
    SHEET_ID = CONFIG.DAILY_SHEET_ID || '';
    GID = (CONFIG.GIDS && CONFIG.GIDS.DAILY_LOG) ? CONFIG.GIDS.DAILY_LOG : '1885435306';
    API_URL = CONFIG.API_URLS?.DAILY || '';
  }

  const savedEmail = sessionStorage.getItem("user_google_email") || (sessionStorage.getItem("google_user") ? JSON.parse(sessionStorage.getItem("google_user")).email : null);
      
  if (savedEmail && typeof ALLOWED_EMAILS !== 'undefined' && Array.isArray(ALLOWED_EMAILS)) {
    const cleanList = ALLOWED_EMAILS.map(e => e.toLowerCase().trim());
    if (cleanList.includes(savedEmail.toLowerCase().trim())) {
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
  loadData();
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch(e) { return null; }
}

function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  if (!payload || !payload.email) return;
  const userEmail = payload.email.toLowerCase().trim();
  
  if (typeof ALLOWED_EMAILS !== 'undefined' && Array.isArray(ALLOWED_EMAILS)) {
    const cleanList = ALLOWED_EMAILS.map(e => e.toLowerCase().trim());
    if (!cleanList.includes(userEmail)) {
      document.getElementById('loginErr').innerText = `⚠️ 存取被拒：帳號 (${userEmail}) 未獲授權。`;
      return;
    }
  }
  
  sessionStorage.setItem("user_google_email", userEmail);
  sessionStorage.setItem('google_user', JSON.stringify({ name: payload.name, email: userEmail, picture: payload.picture }));
  sessionStorage.setItem('google_token', response.credential);
  initializeApp();
}

function checkLoginStatus() {
  const userStr = sessionStorage.getItem('google_user');
  if (userStr) {
    initializeApp();
  } else {
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('mainContainer').style.display = 'none';
  }
}

function logout() {
  sessionStorage.removeItem('google_user');
  sessionStorage.removeItem('user_google_email');
  sessionStorage.removeItem('google_token');
  location.reload();
}

function loadNavbar() {
  fetch('nav.html')
    .then(res => res.text())
    .then(data => {
      const navContainer = document.getElementById('navbar');
      if (navContainer) {
        navContainer.innerHTML = data;
        const currentPath = window.location.pathname.split('/').pop() || 'daily-monthly.html';
        navContainer.querySelectorAll('.nav-btn').forEach(link => {
          if (link.getAttribute('href') === currentPath) link.classList.add('active');
        });
      }
    }).catch(e => console.log('Navbar 未發現或載入跳過'));
}

function loadData() {
  if (!SHEET_ID) {
    document.getElementById('loading').textContent = '❌ config.js 中缺少 DAILY_SHEET_ID 設定';
    return;
  }
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}&t=${new Date().getTime()}`;

  Papa.parse(csvUrl, {
    download: true, header: true, skipEmptyLines: true,
    complete: (results) => {
      allLogs = results.data.map((item, index) => {
        const v = Object.values(item);
        return {
          id: item.ID || item.id || v[0] || `L_${Date.now()}_${index}`,
          date: item.Date || item.date || v[1] || '',
          type: item.Type || item.type || v[2] || 'Task',
          content: item.Content || item.content || v[3] || '',
          status: item.Status || item.status || v[4] || 'Pending',
          remarks: item.Remarks || item.remarks || v[5] || ''
        };
      });
      
      const loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.style.display = 'none';
      
      renderMonthBoards();
    },
    error: (err) => {
      document.getElementById('loading').textContent = '❌ 載入 Daily 資料失敗，請確認 GID 或公開權限。';
      console.error(err);
    }
  });
}

function formatTextWithTags(text) {
  if (!text) return '';
  const tagRegex = /(#[^\s#]+)/g;
  return text.replace(tagRegex, (tag) => `<span class="hashtag-pill" onclick="event.stopPropagation(); filterByTag('${tag}')">${tag}</span>`);
}

function filterByTag(tag) {
  activeTagFilter = tag;
  document.getElementById('activeTagText').textContent = tag;
  document.getElementById('tagFilterIndicator').style.display = 'inline';
  renderMonthBoards();
}

function clearFilter() {
  activeTagFilter = null;
  activeTypeFilter = 'ALL';
  activeStatusFilter = 'ALL';
  
  document.getElementById('typeFilter').value = 'ALL';
  document.getElementById('statusFilter').value = 'ALL';
  document.getElementById('tagFilterIndicator').style.display = 'none';
  renderMonthBoards();
}

function onTypeFilterChange(val) {
  activeTypeFilter = val;
  renderMonthBoards();
}

function onStatusFilterChange(val) {
  activeStatusFilter = val;
  renderMonthBoards();
}

function isDoneStatus(status) {
  return status === '完成' || status === 'Done' || status === '已完成';
}

function changeNavMonth(offset) {
  currentNavDate.setMonth(currentNavDate.getMonth() + offset);
  renderMonthBoards();
}

function resetNavToToday() {
  currentNavDate = new Date();
  currentNavDate.setDate(1);
  renderMonthBoards();
}

function renderMonthBoards() {
  const container = document.getElementById('monthBoardContainer');
  if (!container) return;
  container.innerHTML = '';

  let filteredLogs = allLogs;

  if (activeTagFilter) {
    filteredLogs = filteredLogs.filter(r => (r.content && r.content.includes(activeTagFilter)) || (r.remarks && r.remarks.includes(activeTagFilter)));
  }

  if (activeTypeFilter !== 'ALL') {
    filteredLogs = filteredLogs.filter(r => r.type === activeTypeFilter);
  }

  if (activeStatusFilter !== 'ALL') {
    if (activeStatusFilter === 'TODO') {
      filteredLogs = filteredLogs.filter(r => !isDoneStatus(r.status));
    } else if (activeStatusFilter === 'DONE') {
      filteredLogs = filteredLogs.filter(r => isDoneStatus(r.status));
    }
  }

  const now = new Date();
  const realCurrentYear = now.getFullYear();
  const realCurrentMonth = now.getMonth() + 1;

  const navYear = currentNavDate.getFullYear();
  const navMonth = currentNavDate.getMonth() + 1;
  document.getElementById('navMonthLabel').textContent = `${navYear} 年 ${navMonth} 月視圖`;

  // 1. Backlog (無日期)
  const backlogItems = filteredLogs.filter(r => !r.date || r.date.trim() === '');
  createBoardElement('📥 Backlog (備忘庫 / 無日期)', backlogItems, false, container, 'backlog');

  // 2. 上個月
  const prevDate = new Date(navYear, navMonth - 2, 1);
  const prevY = prevDate.getFullYear();
  const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
  const prevKey = `${prevY}-${prevM}`;
  const prevItems = filteredLogs.filter(r => r.date && r.date.startsWith(prevKey)).sort((a, b) => a.date.localeCompare(b.date));
  createCollapsibleBoardElement(`📁 上個月：${prevY}年${Number(prevM)}月`, prevItems, container, 'prev-month', true);

  // 3. 12 個月看板
  for (let i = 0; i < 12; i++) {
    const d = new Date(navYear, (navMonth - 1) + i, 1);
    const y = d.getFullYear();
    const monthNumber = d.getMonth() + 1;
    const m = String(monthNumber).padStart(2, '0');
    
    const monthKey = `${y}-${m}`;
    const monthLabel = `${y}年 ${monthNumber}月`;
    const isCurrentMonth = (y === realCurrentYear && monthNumber === realCurrentMonth);

    // 支援完整日期（YYYY-MM-DD）或僅月份（YYYY-MM）的歸類
    const monthItems = filteredLogs
      .filter(r => r.date && (r.date.startsWith(monthKey)))
      .sort((a, b) => a.date.localeCompare(b.date));

    createBoardElement(`${isCurrentMonth ? '⭐' : '🗓️'} ${monthLabel} ${isCurrentMonth ? '(本月)' : ''}`, monthItems, isCurrentMonth, container, monthKey);
  }

  // 4. 一年以後
  const futureLimitDate = new Date(navYear, (navMonth - 1) + 12, 1);
  const futureLimitStr = `${futureLimitDate.getFullYear()}-${String(futureLimitDate.getMonth() + 1).padStart(2, '0')}`;
  
  const distantFutureItems = filteredLogs.filter(r => r.date && r.date >= futureLimitStr).sort((a, b) => a.date.localeCompare(b.date));
  createCollapsibleBoardElement(`🔭 一年以後的遠期項目`, distantFutureItems, container, 'distant-future', true);
}

function createBoardElement(title, items, isCurrentMonth, container, boardKey) {
  const board = document.createElement('div');
  board.className = `month-board ${isCurrentMonth ? 'current-month' : ''}`;
  
  let headerHtml = `
    <div class="month-header">
      <span>${title}</span>
      <span class="item-count">${items.length} 項</span>
    </div>
  `;

  let bodyHtml = `<div class="month-body" id="board_body_${boardKey}">`;
  
  if (items.length === 0) {
    bodyHtml += `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin-top:20px;">無事項記錄</div>`;
  } else {
    const savedOrder = JSON.parse(localStorage.getItem(`monthly_order_${boardKey}`) || '[]');
    if (savedOrder.length > 0) {
      items.sort((a, b) => {
        let idxA = savedOrder.indexOf(String(a.id));
        let idxB = savedOrder.indexOf(String(b.id));
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });
    }

    items.forEach(item => {
      const isDone = isDoneStatus(item.status);
      const safeId = String(item.id).replace(/'/g, "\\'");
      const displayDate = item.date ? item.date : '📌 無日期';
      const formattedRemarks = item.remarks ? formatTextWithTags(item.remarks.replace(/\n/g, '<br>')) : '';

      bodyHtml += `
        <div class="mini-log-card ${isDone ? 'done' : ''}" data-id="${item.id}" onclick="openPreviewModal('${safeId}')">
          <div style="font-size:0.75rem; color:#64748b; display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>${displayDate}</span>
            <span class="type-badge ${item.type}">${item.type}</span>
          </div>
          <div style="font-size:0.88rem; font-weight:bold; margin-bottom:4px; line-height:1.4;">
            ${formatTextWithTags(item.content)}
          </div>
          ${formattedRemarks ? `<div style="font-size:0.78rem; color:#475569; margin-bottom:6px; line-height:1.3;">💬 ${formattedRemarks}</div>` : ''}
          <div style="display:flex; justify-content:flex-end; border-top: 1px dashed var(--border-color); padding-top:4px;">
            <button class="status-btn ${isDone ? 'done' : 'todo'}" onclick="event.stopPropagation(); toggleStatus('${safeId}')">
              ${isDone ? '✅ 已完成' : '⏳ 待辦'}
            </button>
          </div>
        </div>
      `;
    });
  }
  bodyHtml += `</div>`;
  
  board.innerHTML = headerHtml + bodyHtml;
  container.appendChild(board);

  const bodyEl = document.getElementById(`board_body_${boardKey}`);
  if (bodyEl && typeof Sortable !== 'undefined' && items.length > 0) {
    Sortable.create(bodyEl, {
      animation: 150,
      onEnd: function () {
        const cards = bodyEl.querySelectorAll('.mini-log-card');
        const newOrder = Array.from(cards).map(card => card.getAttribute('data-id'));
        localStorage.setItem(`monthly_order_${boardKey}`, JSON.stringify(newOrder));
      }
    });
  }
}

function createCollapsibleBoardElement(title, items, container, boardKey, defaultCollapsed = true) {
  const board = document.createElement('div');
  board.className = `month-board collapsible-board`;
  
  let headerHtml = `
    <div class="month-header collapsible-header" onclick="toggleCollapsibleBoard('${boardKey}')" style="cursor:pointer;">
      <span>${title} <span id="arrow_${boardKey}">${defaultCollapsed ? '▶' : '▼'}</span></span>
      <span class="item-count">${items.length} 項</span>
    </div>
  `;

  let bodyHtml = `<div class="month-body collapsible-body" id="board_body_${boardKey}" style="display: ${defaultCollapsed ? 'none' : 'flex'};">`;
  
  if (items.length === 0) {
    bodyHtml += `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin-top:20px;">無事項記錄</div>`;
  } else {
    items.forEach(item => {
      const isDone = isDoneStatus(item.status);
      const safeId = String(item.id).replace(/'/g, "\\'");
      const displayDate = item.date ? item.date : '📌 無日期';
      const formattedRemarks = item.remarks ? formatTextWithTags(item.remarks.replace(/\n/g, '<br>')) : '';

      bodyHtml += `
        <div class="mini-log-card ${isDone ? 'done' : ''}" data-id="${item.id}" onclick="openPreviewModal('${safeId}')">
          <div style="font-size:0.75rem; color:#64748b; display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>${displayDate}</span>
            <span class="type-badge ${item.type}">${item.type}</span>
          </div>
          <div style="font-size:0.88rem; font-weight:bold; margin-bottom:4px; line-height:1.4;">
            ${formatTextWithTags(item.content)}
          </div>
          ${formattedRemarks ? `<div style="font-size:0.78rem; color:#475569; margin-bottom:6px; line-height:1.3;">💬 ${formattedRemarks}</div>` : ''}
          <div style="display:flex; justify-content:flex-end; border-top: 1px dashed var(--border-color); padding-top:4px;">
            <button class="status-btn ${isDone ? 'done' : 'todo'}" onclick="event.stopPropagation(); toggleStatus('${safeId}')">
              ${isDone ? '✅ 已完成' : '⏳ 待辦'}
            </button>
          </div>
        </div>
      `;
    });
  }
  bodyHtml += `</div>`;
  
  board.innerHTML = headerHtml + bodyHtml;
  container.appendChild(board);
}

function toggleCollapsibleBoard(boardKey) {
  const body = document.getElementById(`board_body_${boardKey}`);
  const arrow = document.getElementById(`arrow_${boardKey}`);
  if (body.style.display === 'none' || body.style.display === '') {
    body.style.display = 'flex';
    arrow.textContent = '▼';
  } else {
    body.style.display = 'none';
    arrow.textContent = '▶';
  }
}

function openPreviewModal(id) {
  const item = allLogs.find(r => String(r.id) === String(id));
  if (!item) return;

  document.getElementById('previewRowId').value = item.id;
  document.getElementById('previewDate').textContent = item.date || '無日期 (Backlog)';
  document.getElementById('previewType').textContent = item.type;
  document.getElementById('previewContent').innerHTML = formatTextWithTags(item.content);
  document.getElementById('previewRemarks').innerHTML = item.remarks ? formatTextWithTags(item.remarks.replace(/\n/g, '<br>')) : '<span style="color:#94a3b8">無備註</span>';
  
  document.getElementById('previewModal').style.display = 'flex';
}

function closePreviewModal() { 
  document.getElementById('previewModal').style.display = 'none'; 
}

function deleteItem() {
  const itemId = document.getElementById('previewRowId').value;
  const target = allLogs.find(r => String(r.id) === String(itemId));
  if (!target || !confirm("確定要刪除這筆事項嗎？")) return;

  allLogs = allLogs.filter(r => String(r.id) !== String(itemId));
  renderMonthBoards();
  closePreviewModal();

  if (API_URL) {
    const secret = CONFIG.SECRET_KEY || '';
    const params = new URLSearchParams({
      action: 'deleteLog',
      key: secret,
      id: itemId,
      content: target.content
    });
    fetch(`${API_URL}?${params.toString()}`, { mode: 'no-cors' });
  }
}

function openEditMode() {
  const itemId = document.getElementById('previewRowId').value;
  const item = allLogs.find(r => String(r.id) === String(itemId));
  if (!item) return;

  closePreviewModal();

  document.getElementById('modalTitle').innerHTML = '✏️ 修改 Daily 事項';
  document.getElementById('editRowId').value = item.id;
  document.getElementById('newDate').value = item.date || '';
  document.getElementById('newType').value = item.type;
  document.getElementById('newContent').value = item.content;
  document.getElementById('newRemarks').value = item.remarks || '';

  document.getElementById('modal').style.display = 'flex';
}

function toggleStatus(id) {
  const target = allLogs.find(r => String(r.id) === String(id));
  if (!target) return;

  const isDone = isDoneStatus(target.status);
  const newStatus = isDone ? 'Pending' : '完成';
  target.status = newStatus;
  
  renderMonthBoards();

  if (API_URL) {
    const params = new URLSearchParams({
      action: 'toggleLog',
      key: CONFIG.SECRET_KEY || '',
      id: target.id,
      content: target.content,
      status: newStatus
    });
    fetch(`${API_URL}?${params.toString()}`, { mode: 'no-cors' });
  }
}

function openModal() {
  document.getElementById('modalTitle').innerHTML = '📝 新增 Daily 事項';
  document.getElementById('editRowId').value = '';
  document.getElementById('addForm').reset();
  document.getElementById('modal').style.display = 'flex';
}

function closeModal() { 
  document.getElementById('modal').style.display = 'none'; 
}

function handleSubmit(e) {
  e.preventDefault();
  
  const existingId = document.getElementById('editRowId').value;
  const isEdit = (existingId !== '');
  const itemId = isEdit ? existingId : `L_${Date.now()}`;

  const dateVal = document.getElementById('newDate').value;
  const typeVal = document.getElementById('newType').value;
  const contentVal = document.getElementById('newContent').value.trim();
  const remarksVal = document.getElementById('newRemarks').value.trim();

  if (!contentVal) return;

  if (isEdit) {
    const target = allLogs.find(r => String(r.id) === String(itemId));
    if (target) {
      target.date = dateVal;
      target.type = typeVal;
      target.content = contentVal;
      target.remarks = remarksVal;
    }
  } else {
    allLogs.push({
      id: itemId,
      date: dateVal,
      type: typeVal,
      content: contentVal,
      remarks: remarksVal,
      status: 'Pending'
    });
  }
  
  renderMonthBoards();
  closeModal();

  if (API_URL) {
    const params = new URLSearchParams({
      action: isEdit ? 'editLog' : 'addLog',
      key: CONFIG.SECRET_KEY || '',
      id: itemId,
      date: dateVal,
      type: typeVal,
      content: contentVal,
      remarks: remarksVal,
      status: 'Pending'
    });
    fetch(`${API_URL}?${params.toString()}`, { mode: 'no-cors' });
  }
}
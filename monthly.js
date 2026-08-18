let logs = [];
let activeTagFilter = null;
let activeCategoryFilter = 'ALL';
let activeStatusFilter = 'ALL';

let API_URL = '';
let GID = '';
let SHEET_ID = '';

// 初始化 Google 登入
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

window.onload = () => {
  loadNavbar();
  if (typeof CONFIG !== 'undefined') {
    SHEET_ID = CONFIG.MONTHLY_SHEET_ID || CONFIG.FT_SHEET_ID || '';
    GID = (CONFIG.GIDS && CONFIG.GIDS.MONTHLY) ? CONFIG.GIDS.MONTHLY : ((CONFIG.GIDS && CONFIG.GIDS.FT) ? CONFIG.GIDS.FT : '782306667');
    API_URL = CONFIG.API_URLS?.MONTHLY || CONFIG.API_URLS?.FT || CONFIG.GAS_URL || '';
  }
  checkLoginStatus();
};

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
    if (!ALLOWED_EMAILS.map(e => e.toLowerCase().trim()).includes(userEmail)) {
      document.getElementById('loginErr').innerText = `⚠️ 存取被拒：未獲授權。`;
      return;
    }
  }
  sessionStorage.setItem('google_user', JSON.stringify({ name: payload.name, email: userEmail, picture: payload.picture }));
  sessionStorage.setItem('google_token', response.credential);
  checkLoginStatus();
}

function checkLoginStatus() {
  const userStr = sessionStorage.getItem('google_user');
  if (userStr) {
    if (window.google?.accounts?.id) window.google.accounts.id.cancel();
    const user = JSON.parse(userStr);
    document.getElementById('userInfo').textContent = `👤 ${user.name || user.email}`;
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'block';
    loadData();
  } else {
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('mainContainer').style.display = 'none';
  }
}

function logout() {
  sessionStorage.removeItem('google_user');
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
        const currentPath = window.location.pathname.split('/').pop() || 'monthly.html';
        navContainer.querySelectorAll('.nav-btn').forEach(link => {
          if (link.getAttribute('href') === currentPath) link.classList.add('active');
        });
      }
    });
}

// 動態切換日期/月份選擇器類型
function toggleDateInputType(isMonth) {
  const dateInput = document.getElementById('newDate');
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  if (isMonth) {
    dateInput.type = 'month';
    dateInput.value = `${yyyy}-${mm}`;
  } else {
    dateInput.type = 'date';
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }
}

// 動態產生分類下拉選項
function updateCategoryDropdown() {
  const select = document.getElementById('categoryFilter');
  if (!select) return;
  const categories = Array.from(new Set(logs.map(r => r.category).filter(Boolean)));
  
  let html = '<option value="ALL">全部分類</option>';
  categories.forEach(cat => {
    html += `<option value="${cat}">${cat}</option>`;
  });
  select.innerHTML = html;
  select.value = activeCategoryFilter;
}

function onCategoryFilterChange(val) {
  activeCategoryFilter = val;
  renderMonthBoards();
}

function onStatusFilterChange(val) {
  activeStatusFilter = val;
  renderMonthBoards();
}

// 從 Google Sheets CSV 讀取資料 (清理 Signifier 前綴符號)
function loadData() {
  if (!SHEET_ID) {
    document.getElementById('loading').textContent = '❌ config.js 中缺少 Sheet ID 設定';
    return;
  }
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}&t=${new Date().getTime()}`;

  Papa.parse(csvUrl, {
    download: true, header: true, skipEmptyLines: true,
    complete: (results) => {
      logs = results.data.map((item, index) => {
        const v = Object.values(item);
        
        // 移除前綴符號 (如 •, ◦, - 等)
        let rawSignifier = item.Signifier || v[4] || 'Task';
        let cleanSignifier = rawSignifier.replace(/^[•◦\-\s]+/, '').trim();
        if (!cleanSignifier) cleanSignifier = 'Task';

        return {
          id: item.ID || item.id || v[0] || `ID_${Date.now()}_${index}`,
          date: item['Date/Month'] || item.Date || v[1] || '',
          category: item.Category || v[2] || '',
          task: item['Task/Event'] || item.Task || v[3] || '',
          signifier: cleanSignifier,
          status: item.Status || v[5] || '未完成',
          remarks: item.Remarks || v[6] || ''
        };
      });
      
      const loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.style.display = 'none';
      
      updateCategoryDropdown();
      renderMonthBoards();
    },
    error: (err) => {
      document.getElementById('loading').textContent = '❌ 載入 Monthly 資料失敗，請確認 GID 或公開權限。';
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
  activeCategoryFilter = 'ALL';
  activeStatusFilter = 'ALL';
  
  document.getElementById('categoryFilter').value = 'ALL';
  document.getElementById('statusFilter').value = 'ALL';
  document.getElementById('tagFilterIndicator').style.display = 'none';
  renderMonthBoards();
}

// 渲染 12 個月看板 (全月事項自動置頂 + 圓角 Signifier)
function renderMonthBoards() {
  const container = document.getElementById('monthBoardContainer');
  if (!container) return;
  container.innerHTML = '';

  let filteredLogs = logs;

  if (activeTagFilter) {
    filteredLogs = filteredLogs.filter(r => (r.task && r.task.includes(activeTagFilter)) || (r.remarks && r.remarks.includes(activeTagFilter)));
  }

  if (activeCategoryFilter !== 'ALL') {
    filteredLogs = filteredLogs.filter(r => r.category === activeCategoryFilter);
  }

  if (activeStatusFilter !== 'ALL') {
    if (activeStatusFilter === 'TODO') {
      filteredLogs = filteredLogs.filter(r => r.status !== '已完成' && r.status !== 'Done');
    } else if (activeStatusFilter === 'DONE') {
      filteredLogs = filteredLogs.filter(r => r.status === '已完成' || r.status === 'Done');
    }
  }

  const now = new Date();
  let startYear = now.getFullYear();
  let startMonth = now.getMonth() - 1; 

  const realCurrentYear = now.getFullYear();
  const realCurrentMonth = now.getMonth() + 1; 

  for (let i = 0; i < 12; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    const y = d.getFullYear();
    const monthNumber = d.getMonth() + 1;
    const m = String(monthNumber).padStart(2, '0');
    
    const monthKey = `${y}-${m}`;
    const monthLabel = `${y}年 ${monthNumber}月`;
    const isCurrentMonth = (y === realCurrentYear && monthNumber === realCurrentMonth);

    // 篩選當月資料，並進行排序：全月事項 (長度7: YYYY-MM) 排在最上方，之後按日期序排序
    const monthItems = filteredLogs
      .filter(r => r.date.startsWith(monthKey))
      .sort((a, b) => {
        const aIsMonth = a.date.length === 7;
        const bIsMonth = b.date.length === 7;
        if (aIsMonth && !bIsMonth) return -1;
        if (!aIsMonth && bIsMonth) return 1;
        return a.date.localeCompare(b.date);
      });

    const board = document.createElement('div');
    board.className = `month-board ${isCurrentMonth ? 'current-month' : ''}`;
    
    let headerHtml = `
      <div class="month-header">
        <span>${isCurrentMonth ? '⭐' : '🗓️'} ${monthLabel} ${isCurrentMonth ? '(本月)' : ''}</span>
        <span class="item-count">${monthItems.length} 項</span>
      </div>
    `;

    let bodyHtml = `<div class="month-body">`;
    
    if (monthItems.length === 0) {
      bodyHtml += `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin-top:20px;">無事項記錄</div>`;
    } else {
      monthItems.forEach(item => {
        const isDone = (item.status === '已完成' || item.status === 'Done');
        const safeId = String(item.id).replace(/'/g, "\\'");
        
        // 全月事項在卡片上顯示為 「📌 全月」
        const displayDate = (item.date.length === 7) ? '📌 全月' : item.date;

        bodyHtml += `
          <div class="mini-log-card ${isDone ? 'done' : ''}" onclick="openPreviewModal('${safeId}')">
            <div style="font-size:0.75rem; color:#64748b; display:flex; justify-content:space-between; margin-bottom:6px;">
              <span style="font-weight:${item.date.length === 7 ? 'bold' : 'normal'}; color:${item.date.length === 7 ? '#d97706' : '#64748b'};">${displayDate}</span>
              <span style="color:#0d9488; font-weight:bold;">${item.category}</span>
            </div>
            <div style="font-size:0.9rem; font-weight:bold; margin-bottom:8px; line-height:1.4; display:flex; align-items:center;">
              <span class="signifier-pill">${item.signifier || 'Task'}</span>
              <span>${formatTextWithTags(item.task)}</span>
            </div>
            <div style="display:flex; justify-content:flex-end; border-top: 1px dashed var(--border-color); padding-top:6px;">
              <button class="status-btn ${isDone ? 'done' : 'todo'}" onclick="event.stopPropagation(); toggleStatus('${safeId}', '${item.status}')">
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
}

function openPreviewModal(id) {
  const item = logs.find(r => String(r.id) === String(id));
  if (!item) return;

  document.getElementById('previewRowIndex').value = item.id;
  document.getElementById('previewDate').textContent = item.date.length === 7 ? `${item.date} (全月事項)` : item.date;
  document.getElementById('previewCategory').textContent = item.category;
  document.getElementById('previewTask').innerHTML = formatTextWithTags(item.task);
  document.getElementById('previewRemarks').innerHTML = item.remarks ? formatTextWithTags(item.remarks.replace(/\n/g, '<br>')) : '<span style="color:#94a3b8">無備註</span>';
  
  document.getElementById('previewModal').style.display = 'flex';
}

function closePreviewModal() { 
  document.getElementById('previewModal').style.display = 'none'; 
}

function deleteItem() {
  const itemId = document.getElementById('previewRowIndex').value;
  if (!confirm("確定要刪除這筆事項嗎？")) return;

  logs = logs.filter(r => String(r.id) !== String(itemId));
  updateCategoryDropdown();
  renderMonthBoards();
  closePreviewModal();

  if (API_URL) {
    const secret = CONFIG.SECRET_KEY || '';
    const url = `${API_URL}?gid=${GID}&action=delete&id=${encodeURIComponent(itemId)}&key=${encodeURIComponent(secret)}&SECRET_KEY=${encodeURIComponent(secret)}`;
    fetch(url, { mode: 'no-cors' });
  }
}

function openEditMode() {
  const itemId = document.getElementById('previewRowIndex').value;
  const item = logs.find(r => String(r.id) === String(itemId));
  if (!item) return;

  closePreviewModal();

  document.getElementById('modalTitle').innerHTML = '✏️ 修改 Monthly 事項';
  document.getElementById('editRowIndex').value = item.id;

  const isWholeMonth = (item.date.length === 7);
  const checkbox = document.getElementById('isWholeMonth');
  checkbox.checked = isWholeMonth;

  toggleDateInputType(isWholeMonth);
  document.getElementById('newDate').value = item.date;

  document.getElementById('newCategory').value = item.category;
  document.getElementById('newSignifier').value = item.signifier;
  document.getElementById('newTask').value = item.task;
  document.getElementById('newRemarks').value = item.remarks;

  document.getElementById('modal').style.display = 'flex';
}

function toggleStatus(id, currentStatus) {
  const newStatus = (currentStatus === '已完成' || currentStatus === 'Done') ? '未完成' : '已完成';
  const target = logs.find(r => String(r.id) === String(id));
  
  if (target) { 
    target.status = newStatus; 
    renderMonthBoards(); 
  }
  
  if (API_URL) {
    const secret = CONFIG.SECRET_KEY || '';
    const url = `${API_URL}?gid=${GID}&action=toggleStatus&id=${encodeURIComponent(id)}&newStatus=${encodeURIComponent(newStatus)}&key=${encodeURIComponent(secret)}&SECRET_KEY=${encodeURIComponent(secret)}`;
    fetch(url, { mode: 'no-cors' });
  }
}

function openModal() {
  document.getElementById('modalTitle').innerHTML = '📝 新增 Monthly 事項';
  document.getElementById('editRowIndex').value = '';
  document.getElementById('addForm').reset();
  
  const checkbox = document.getElementById('isWholeMonth');
  checkbox.checked = false;
  toggleDateInputType(false);

  document.getElementById('modal').style.display = 'flex';
}

function closeModal() { 
  document.getElementById('modal').style.display = 'none'; 
}

function handleSubmit(e) {
  e.preventDefault();
  
  const existingId = document.getElementById('editRowIndex').value;
  const isEdit = (existingId !== '');
  const itemId = isEdit ? existingId : `ID_${Date.now()}`;

  const dateVal = document.getElementById('newDate').value;
  const catVal = document.getElementById('newCategory').value.trim();
  const sigVal = document.getElementById('newSignifier').value;
  const taskVal = document.getElementById('newTask').value.trim();
  const remarksVal = document.getElementById('newRemarks').value.trim();

  const params = new URLSearchParams({
    gid: GID, 
    action: isEdit ? 'edit' : 'add',
    id: itemId,
    key: CONFIG.SECRET_KEY || '',
    SECRET_KEY: CONFIG.SECRET_KEY || '',
    Date: dateVal,
    Category: catVal,
    Signifier: sigVal,
    Task: taskVal,
    'Task/Event': taskVal,
    Remarks: remarksVal,
    Status: '未完成'
  });

  if (isEdit) {
    const target = logs.find(r => String(r.id) === String(itemId));
    if (target) {
      params.set('Status', target.status);
      target.date = dateVal;
      target.category = catVal;
      target.signifier = sigVal;
      target.task = taskVal;
      target.remarks = remarksVal;
    }
  } else {
    logs.push({
      id: itemId,
      date: dateVal, category: catVal, signifier: sigVal,
      task: taskVal, remarks: remarksVal, status: '未完成'
    });
  }
  
  updateCategoryDropdown();
  renderMonthBoards();
  closeModal();

  if (API_URL) {
    fetch(`${API_URL}?${params.toString()}`, { mode: 'no-cors' });
  }
}
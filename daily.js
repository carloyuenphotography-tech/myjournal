let allLogs = [];
let selectedTag = 'all';

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let currentDateStr = getTodayString();

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
  document.getElementById('currentDate').value = currentDateStr;

  if (typeof CONFIG === 'undefined') {
    showStatus('❌ 找不到 config.js 設定', '#ef4444');
    return;
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
  loadLogsData();
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch(e) {
    return null;
  }
}

function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  if (payload && payload.email) {
    const userEmail = payload.email.toLowerCase().trim();
    if (typeof ALLOWED_EMAILS !== 'undefined' && Array.isArray(ALLOWED_EMAILS)) {
      const cleanList = ALLOWED_EMAILS.map(e => e.toLowerCase().trim());
      if (!cleanList.includes(userEmail)) {
        alert(`⚠️ 存取被拒：帳號 (${userEmail}) 未獲授權使用此系統。`);
        return;
      }
    }

    sessionStorage.setItem("user_google_email", userEmail);
    sessionStorage.setItem('google_user', JSON.stringify({
      name: payload.name,
      email: userEmail,
      picture: payload.picture
    }));
    sessionStorage.setItem('google_token', response.credential);
    initializeApp();
  }
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

function showStatus(text, color = '#6366f1') {
  const msg = document.getElementById('statusMessage');
  if (msg) {
    msg.style.color = color;
    msg.textContent = text;
  }
}

function loadNavbar() {
  fetch('nav.html')
    .then(res => res.text())
    .then(data => {
      const navContainer = document.getElementById('navbar');
      if (navContainer) {
        navContainer.innerHTML = data;
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        navContainer.querySelectorAll('.nav-btn').forEach(link => {
          if (link.getAttribute('href') === currentPath) link.classList.add('active');
        });
      }
    })
    .catch(err => console.log('導覽列載入失敗', err));
}

function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#([\u4e00-\u9fa5\w_]+)/g);
  return matches ? matches.map(tag => tag.substring(1)) : [];
}

function formatContentWithTags(text) {
  if (!text) return '';
  return text.replace(/#([\u4e00-\u9fa5\w_]+)/g, '<span class="hashtag-link" onclick="filterByTag(\'$1\')">#$1</span>');
}

function loadLogsData() {
  const sheetId = CONFIG.DAILY_SHEET_ID;
  const gid = CONFIG.GIDS ? CONFIG.GIDS.DAILY_LOG : '0';

  if (!sheetId) {
    showStatus('❌ config.js 中缺少 DAILY_SHEET_ID', '#ef4444');
    return;
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}&t=${new Date().getTime()}`;

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      allLogs = parseLogs(results.data);
      showStatus('');
      renderHashtagBar();
      renderAll();
    },
    error: () => {
      showStatus('❌ 讀取失敗，請確認 Google Sheet 已設定公開權限', '#ef4444');
    }
  });
}

function parseLogs(rows) {
  if (!rows) return [];
  return rows.map((r, i) => {
    const v = Object.values(r);
    const content = r.Content || r.content || v[3] || '';
    const remarks = r.Remarks || r.remarks || v[5] || '';
    const combinedText = content + ' ' + remarks;

    return {
      id: r.ID || r.id || v[0] || `L_${i}`,
      date: r.Date || r.date || v[1] || '',
      type: r.Type || r.type || v[2] || 'Task',
      content: content,
      status: r.Status || r.status || v[4] || 'Pending',
      remarks: remarks,
      tags: extractHashtags(combinedText)
    };
  });
}

function toggleHashtagBar() {
  const bar = document.getElementById('hashtagBar');
  const arrow = document.getElementById('hashtagArrow');
  if (bar.style.display === 'none' || bar.style.display === '') {
    bar.style.display = 'flex';
    arrow.textContent = '▼';
  } else {
    bar.style.display = 'none';
    arrow.textContent = '▶';
  }
}

function renderHashtagBar() {
  const tagContainer = document.getElementById('tagContainer');
  const wrapperBox = document.getElementById('hashtagWrapperBox');
  const indicator = document.getElementById('activeTagIndicator');
  if (!tagContainer) return;

  const tagMap = {};
  allLogs.forEach(r => {
    if (r.tags) {
      r.tags.forEach(t => tagMap[t] = (tagMap[t] || 0) + 1);
    }
  });

  const uniqueTags = Object.keys(tagMap);
  if (uniqueTags.length === 0) {
    wrapperBox.style.display = 'none';
    return;
  }

  wrapperBox.style.display = 'block';
  if (selectedTag === 'all') {
    indicator.textContent = '';
  } else {
    indicator.textContent = `(目前: #${selectedTag})`;
  }

  let html = `<button class="tag-btn ${selectedTag === 'all' ? 'active' : ''}" onclick="filterByTag('all')">全部</button>`;
  uniqueTags.forEach(t => {
    html += `<button class="tag-btn ${selectedTag === t ? 'active' : ''}" onclick="filterByTag('${t}')">#${t} (${tagMap[t]})</button>`;
  });
  tagContainer.innerHTML = html;
}

function filterByTag(tag) {
  selectedTag = tag;
  renderHashtagBar();
  renderAll();
}

function jumpToToday() {
  currentDateStr = getTodayString();
  document.getElementById('currentDate').value = currentDateStr;
  renderAll();
}

function changeDate(days) {
  const d = new Date(currentDateStr);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  currentDateStr = `${year}-${month}-${day}`;
  document.getElementById('currentDate').value = currentDateStr;
  renderAll();
}

function handleDateChange() {
  currentDateStr = document.getElementById('currentDate').value;
  renderAll();
}

function renderAll() {
  renderDailyLogs();
  renderOverdue();
  renderFuture();
  renderBacklog();
}

function isItemDone(status) {
  return status === '完成' || status === 'Done';
}

function passesTagFilter(item) {
  if (selectedTag === 'all') return true;
  return item.tags && item.tags.includes(selectedTag);
}

function toggleSection(contentId, arrowId) {
  const content = document.getElementById(contentId);
  const arrow = document.getElementById(arrowId);
  if (content.style.display === 'none' || content.style.display === '') {
    content.style.display = 'block';
    arrow.textContent = '▼';
  } else {
    content.style.display = 'none';
    arrow.textContent = '▶';
  }
}

function renderDailyLogs() {
  const container = document.getElementById('dailyList');
  container.innerHTML = '';

  const showCompleted = document.getElementById('showCompleted').checked;
  let currentLogs = allLogs.filter(item => {
    if (item.date !== currentDateStr) return false;
    if (!showCompleted && isItemDone(item.status)) return false;
    if (!passesTagFilter(item)) return false;
    return true;
  });

  // 從 localStorage 讀取該日期的自訂次序
  const savedOrder = JSON.parse(localStorage.getItem(`daily_order_${currentDateStr}`) || '[]');
  if (savedOrder.length > 0) {
    currentLogs.sort((a, b) => {
      let indexA = savedOrder.indexOf(a.id);
      let indexB = savedOrder.indexOf(b.id);
      if (indexA === -1) indexA = 9999;
      if (indexB === -1) indexB = 9999;
      return indexA - indexB;
    });
  }

  if (currentLogs.length === 0) {
    container.innerHTML = '<div style="color:#64748b; font-size:0.82rem; text-align:center; padding:6px;">當日無任何紀錄項目</div>';
    return;
  }

  currentLogs.forEach(item => {
    container.appendChild(createLogElement(item, false));
  });

  // 啟用 SortableJS 並儲存次序至 localStorage
  if (typeof Sortable !== 'undefined') {
    Sortable.create(container, {
      animation: 150,
      onEnd: function (evt) {
        const movedItem = currentLogs[evt.oldIndex];
        currentLogs.splice(evt.oldIndex, 1);
        currentLogs.splice(evt.newIndex, 0, movedItem);

        // 儲存新次序的 ID 陣列
        const newOrderIds = currentLogs.map(item => item.id);
        localStorage.setItem(`daily_order_${currentDateStr}`, JSON.stringify(newOrderIds));
      }
    });
  }
}

function renderOverdue() {
  const container = document.getElementById('overdueList');
  container.innerHTML = '';
  const todayStr = getTodayString();

  const overdueItems = allLogs.filter(item => {
    if (!item.date || item.date >= todayStr || isItemDone(item.status)) return false;
    if (!passesTagFilter(item)) return false;
    return true;
  });

  if (overdueItems.length === 0) {
    container.innerHTML = '<div style="color:#059669; font-size:0.82rem;">✅ 目前沒有逾期的待辦事項</div>';
    return;
  }

  overdueItems.forEach(item => {
    container.appendChild(createLogElement(item, true));
  });
}

function renderFuture() {
  const container = document.getElementById('futureList');
  container.innerHTML = '';
  const todayStr = getTodayString();

  const showCompleted = document.getElementById('showCompleted').checked;
  const futureItems = allLogs.filter(item => {
    if (!item.date || item.date <= todayStr) return false;
    if (!showCompleted && isItemDone(item.status)) return false;
    if (!passesTagFilter(item)) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (futureItems.length === 0) {
    container.innerHTML = '<div style="color:#0284c7; font-size:0.82rem;">📅 目前沒有將來預定事項</div>';
    return;
  }

  futureItems.forEach(item => {
    container.appendChild(createLogElement(item, true));
  });
}

function renderBacklog() {
  const container = document.getElementById('backlogList');
  container.innerHTML = '';

  const showCompleted = document.getElementById('showCompleted').checked;
  const backlogItems = allLogs.filter(item => {
    if (item.date && item.date.trim() !== '') return false;
    if (!showCompleted && isItemDone(item.status)) return false;
    if (!passesTagFilter(item)) return false;
    return true;
  });

  if (backlogItems.length === 0) {
    container.innerHTML = '<div style="color:#7e22ce; font-size:0.82rem;">📥 備忘庫空空如也</div>';
    return;
  }

  backlogItems.forEach(item => {
    container.appendChild(createLogElement(item, false));
  });
}
function createLogElement(item, showDateTag) {
  const isDone = isItemDone(item.status);
  
  // 🔍 檢查是否包含重要 hashtag 或 emoji (如 #important, #urgent, #重要, 🔥, ⚠️)
  const combinedText = (item.content || '') + ' ' + (item.remarks || '');
  const isImportant = combinedText.includes('#important') || 
                      combinedText.includes('#urgent') || 
                      combinedText.includes('#重要') || 
                      combinedText.includes('🔥') || 
                      combinedText.includes('⚠️');

  const div = document.createElement('div');
  div.className = `log-item ${isDone ? 'done' : ''} ${isImportant ? 'important-log' : ''}`;
  div.setAttribute('data-id', item.id);

  let badgeClass = 'task';
  if (item.type === '事件' || item.type === 'Event') badgeClass = 'event';
  if (item.type === '筆記' || item.type === 'Note') badgeClass = 'note';

  const formattedContent = formatContentWithTags(item.content);
  const formattedRemarks = formatContentWithTags(item.remarks);

  div.innerHTML = `
    <div class="log-main">
      <div class="log-header-line">
        <span class="badge ${badgeClass}">${item.type}</span>
        ${showDateTag && item.date ? `<span class="date-tag">(${item.date})</span>` : ''}
      </div>
      <div class="content-text">${formattedContent}</div>
      ${item.remarks ? `<div class="remarks-text">💬 ${formattedRemarks}</div>` : ''}
    </div>
    <div class="action-btns-stacked">
      <button class="btn-icon-only" onclick="openModal('${item.id}')" title="編輯">✏️</button>
      <button class="btn-icon-only ${isDone ? 'done' : 'todo'}" onclick="toggleStatus('${item.id}')">
        ${isDone ? '✓' : '⏳'}
      </button>
    </div>
  `;
  return div;
}

function openModal(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  document.getElementById('modalTargetId').value = target.id;
  document.getElementById('modalOldContent').value = target.content;
  document.getElementById('modalDate').value = target.date || '';
  document.getElementById('modalType').value = target.type;
  document.getElementById('modalContent').value = target.content;
  document.getElementById('modalRemarks').value = target.remarks || '';

  document.getElementById('editModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('editModal').style.display = 'none';
}

function saveModalEdit() {
  const id = document.getElementById('modalTargetId').value;
  const oldContent = document.getElementById('modalOldContent').value;
  const newDate = document.getElementById('modalDate').value;
  const newType = document.getElementById('modalType').value;
  const newContent = document.getElementById('modalContent').value.trim();
  const newRemarks = document.getElementById('modalRemarks').value.trim();

  if (!newContent) return;

  const target = allLogs.find(l => l.id === id || l.content === oldContent);
  if (target) {
    target.date = newDate;
    target.type = newType;
    target.content = newContent;
    target.remarks = newRemarks;
    target.tags = extractHashtags(newContent + ' ' + newRemarks);
  }

  closeModal();
  renderHashtagBar();
  renderAll();

  showStatus('⏳ 正在同步更新至 Google Sheet...');
  const apiUrl = CONFIG.API_URLS ? CONFIG.API_URLS.DAILY : '';
  if (apiUrl) {
    const params = new URLSearchParams({
      action: 'editLog',
      key: CONFIG.SECRET_KEY || '',
      id: id,
      oldContent: oldContent,
      date: newDate,
      type: newType,
      content: newContent,
      remarks: newRemarks
    });

    fetch(`${apiUrl}?${params.toString()}`, { mode: 'no-cors' })
      .then(() => showStatus(''))
      .catch(() => showStatus('❌ 更新寫入失敗', '#ef4444'));
  }
}

function deleteFromModal() {
  const id = document.getElementById('modalTargetId').value;
  if (!id) return;

  if (!confirm('確定要刪除這筆事項嗎？')) return;

  const targetIndex = allLogs.findIndex(l => l.id === id);
  if (targetIndex === -1) return;

  const target = allLogs[targetIndex];
  allLogs.splice(targetIndex, 1);

  closeModal();
  renderHashtagBar();
  renderAll();

  showStatus('⏳ 正在從 Google Sheet 刪除...');
  const apiUrl = CONFIG.API_URLS ? CONFIG.API_URLS.DAILY : '';
  if (apiUrl) {
    const params = new URLSearchParams({
      action: 'deleteLog',
      key: CONFIG.SECRET_KEY || '',
      id: id,
      content: target.content
    });
    fetch(`${apiUrl}?${params.toString()}`, { mode: 'no-cors' })
      .then(() => showStatus(''))
      .catch(() => showStatus('❌ 刪除寫入失敗', '#ef4444'));
  }
}

function toggleStatus(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  const isDone = isItemDone(target.status);
  const newStatus = isDone ? 'Pending' : '完成';
  
  target.status = newStatus;
  renderAll();

  const apiUrl = CONFIG.API_URLS ? CONFIG.API_URLS.DAILY : '';
  if (apiUrl) {
    const params = new URLSearchParams({
      action: 'toggleLog',
      key: CONFIG.SECRET_KEY || '',
      id: target.id,
      content: target.content,
      status: newStatus
    });
    fetch(`${apiUrl}?${params.toString()}`, { mode: 'no-cors' });
  }
}

function handleLogSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('logType').value;
  const emoji = document.getElementById('logEmoji').value;
  const isBacklog = document.getElementById('isBacklog').checked;
  let rawContent = document.getElementById('logContent').value.trim();

  if (!rawContent) return;

  const finalContent = emoji ? `${emoji} ${rawContent}` : rawContent;
  const targetDate = isBacklog ? "" : currentDateStr;
  const newId = 'L' + new Date().getTime();

  allLogs.push({
    id: newId,
    date: targetDate,
    type: type,
    content: finalContent,
    status: 'Pending',
    remarks: '',
    tags: extractHashtags(finalContent)
  });

  document.getElementById('logContent').value = '';
  document.getElementById('isBacklog').checked = false;
  
  renderHashtagBar();
  renderAll();

  const apiUrl = CONFIG.API_URLS ? CONFIG.API_URLS.DAILY : '';
  if (apiUrl) {
    const params = new URLSearchParams({
      action: 'addLog',
      key: CONFIG.SECRET_KEY || '',
      id: newId,
      date: targetDate,
      type: type,
      content: finalContent,
      status: 'Pending',
      remarks: ''
    });
    fetch(`${apiUrl}?${params.toString()}`, { mode: 'no-cors' });
  }
}
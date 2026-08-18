let allProcedures = [];
let activeTagFilter = null;
let activeProjectFilter = 'ALL';

let API_URL = '';
let GID = '';
let SHEET_ID = '';

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
    // 您可以在 config.js 擴充 PROCEDURES_SHEET_ID 與 GIDS.PROCEDURES，若無則共用 DAILY 或 FT 設定
    SHEET_ID = CONFIG.PROCEDURES_SHEET_ID || CONFIG.DAILY_SHEET_ID || '';
    GID = (CONFIG.GIDS && CONFIG.GIDS.PROCEDURES) ? CONFIG.GIDS.PROCEDURES : '0';
    API_URL = CONFIG.API_URLS?.PROCEDURES || CONFIG.API_URLS?.DAILY || '';
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
        const currentPath = window.location.pathname.split('/').pop() || 'procedures.html';
        navContainer.querySelectorAll('.nav-btn').forEach(link => {
          if (link.getAttribute('href') === currentPath) link.classList.add('active');
        });
      }
    }).catch(e => console.log('Navbar 未發現或載入跳過'));
}

function loadData() {
  if (!SHEET_ID) {
    document.getElementById('loading').textContent = '❌ config.js 中缺少 Sheet ID 設定';
    return;
  }
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}&t=${new Date().getTime()}`;

  Papa.parse(csvUrl, {
    download: true, header: true, skipEmptyLines: true,
    complete: (results) => {
      allProcedures = results.data.map((item, index) => {
        const v = Object.values(item);
        return {
          id: item.ID || item.id || v[0] || `P_${Date.now()}_${index}`,
          project: item.Project || item.project || v[1] || '未分類專案',
          content: item.Content || item.content || v[2] || '',
          remarks: item.Remarks || item.remarks || v[3] || ''
        };
      });
      
      const loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.style.display = 'none';
      
      updateProjectDropdown();
      renderProjectBoards();
    },
    error: (err) => {
      document.getElementById('loading').textContent = '❌ 載入 Procedures 資料失敗，請確認 GID 或公開權限。';
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
  renderProjectBoards();
}

function clearFilter() {
  activeTagFilter = null;
  activeProjectFilter = 'ALL';
  
  document.getElementById('projectFilter').value = 'ALL';
  document.getElementById('tagFilterIndicator').style.display = 'none';
  renderProjectBoards();
}

function onProjectFilterChange(val) {
  activeProjectFilter = val;
  renderProjectBoards();
}

function updateProjectDropdown() {
  const select = document.getElementById('projectFilter');
  if (!select) return;
  const projects = Array.from(new Set(allProcedures.map(r => r.project).filter(Boolean)));
  
  let html = '<option value="ALL">全部專案</option>';
  projects.forEach(proj => {
    html += `<option value="${proj}">${proj}</option>`;
  });
  select.innerHTML = html;
  select.value = activeProjectFilter;
}

// 渲染專案看板
function renderProjectBoards() {
  const container = document.getElementById('projectBoardContainer');
  if (!container) return;
  container.innerHTML = '';

  let filteredLogs = allProcedures;

  if (activeTagFilter) {
    filteredLogs = filteredLogs.filter(r => (r.content && r.content.includes(activeTagFilter)) || (r.remarks && r.remarks.includes(activeTagFilter)));
  }

  if (activeProjectFilter !== 'ALL') {
    filteredLogs = filteredLogs.filter(r => r.project === activeProjectFilter);
  }

  // 取得所有不重複的專案名稱
  const projects = Array.from(new Set(filteredLogs.map(r => r.project)));

  if (projects.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#94a3b8; padding: 40px;">目前尚無專案程序記錄，點擊上方按鈕新增！</div>`;
    return;
  }

  projects.forEach(projectName => {
    const projectItems = filteredLogs.filter(r => r.project === projectName);
    const boardKey = `proj_${projectName.replace(/\s+/g, '_')}`;

    const board = document.createElement('div');
    board.className = `project-board`;
    
let headerHtml = `
      <div class="project-header">
        <span>📁 ${projectName}</span>
        <button onclick="openModalForProject('${projectName.replace(/'/g, "\\'")}')" style="background:rgba(255,255,255,0.2); border:none; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.9rem;" title="在此專案下新增項目">＋</button>
      </div>
    `;

    let bodyHtml = `<div class="project-body" id="board_body_${boardKey}">`;
    
    if (projectItems.length === 0) {
      bodyHtml += `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin-top:20px;">無步驟記錄</div>`;
    } else {
      // 讀取 localStorage 記憶次序
      const savedOrder = JSON.parse(localStorage.getItem(`procedure_order_${boardKey}`) || '[]');
      if (savedOrder.length > 0) {
        projectItems.sort((a, b) => {
          let idxA = savedOrder.indexOf(String(a.id));
          let idxB = savedOrder.indexOf(String(b.id));
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });
      }

      // 帶入 index 產生動態排序數字
      projectItems.forEach((item, index) => {
        const safeId = String(item.id).replace(/'/g, "\\'");
        const formattedRemarks = item.remarks ? formatTextWithTags(item.remarks.replace(/\n/g, '<br>')) : '';

        bodyHtml += `
          <div class="mini-procedure-card" data-id="${item.id}" onclick="openPreviewModal('${safeId}')">
            <div style="font-size:0.9rem; font-weight:bold; margin-bottom:6px; line-height:1.4; display:flex; gap:6px;">
              <span style="color:#0284c7; flex-shrink:0;">${index + 1}.</span>
              <span>${formatTextWithTags(item.content)}</span>
            </div>
            ${formattedRemarks ? `<div style="font-size:0.78rem; color:#475569; line-height:1.3; margin-left:18px;">💬 ${formattedRemarks}</div>` : ''}
          </div>
        `;
      });
    }
    bodyHtml += `</div>`;
    
    board.innerHTML = headerHtml + bodyHtml;
    container.appendChild(board);

    // 啟用 SortableJS 拖曳排序並儲存至 localStorage，並即時更新畫面上顯示的數字
    const bodyEl = document.getElementById(`board_body_${boardKey}`);
    if (bodyEl && typeof Sortable !== 'undefined' && projectItems.length > 0) {
      Sortable.create(bodyEl, {
        animation: 150,
        onEnd: function () {
          const cards = bodyEl.querySelectorAll('.mini-procedure-card');
          const newOrder = Array.from(cards).map(card => card.getAttribute('data-id'));
          localStorage.setItem(`procedure_order_${boardKey}`, JSON.stringify(newOrder));
          
          // 拖曳結束後即時重新整理數字編號，確保數字跟隨當前排序
          renderProjectBoards();
        }
      });
    }
  });
}

function openPreviewModal(id) {
  const item = allProcedures.find(r => String(r.id) === String(id));
  if (!item) return;

  document.getElementById('previewRowId').value = item.id;
  document.getElementById('previewProject').textContent = item.project;
  document.getElementById('previewContent').innerHTML = formatTextWithTags(item.content);
  document.getElementById('previewRemarks').innerHTML = item.remarks ? formatTextWithTags(item.remarks.replace(/\n/g, '<br>')) : '<span style="color:#94a3b8">無反思心得</span>';
  
  document.getElementById('previewModal').style.display = 'flex';
}

function closePreviewModal() { 
  document.getElementById('previewModal').style.display = 'none'; 
}

function deleteItem() {
  const itemId = document.getElementById('previewRowId').value;
  const target = allProcedures.find(r => String(r.id) === String(itemId));
  if (!target || !confirm("確定要刪除這筆步驟記錄嗎？")) return;

  allProcedures = allProcedures.filter(r => String(r.id) !== String(itemId));
  updateProjectDropdown();
  renderProjectBoards();
  closePreviewModal();

  if (API_URL) {
    const secret = CONFIG.SECRET_KEY || '';
    const params = new URLSearchParams({
      action: 'deleteProcedure', // 可依據您的 GAS 後端微調
      key: secret,
      id: itemId
    });
    fetch(`${API_URL}?${params.toString()}`, { mode: 'no-cors' });
  }
}

function openEditMode() {
  const itemId = document.getElementById('previewRowId').value;
  const item = allProcedures.find(r => String(r.id) === String(itemId));
  if (!item) return;

  closePreviewModal();

  document.getElementById('modalTitle').innerHTML = '✏️ 修改專案步驟';
  document.getElementById('editRowId').value = item.id;
  document.getElementById('newProject').value = item.project;
  document.getElementById('newContent').value = item.content;
  document.getElementById('newRemarks').value = item.remarks || '';

  document.getElementById('modal').style.display = 'flex';
}

function openModal() {
  document.getElementById('modalTitle').innerHTML = '📝 新增專案步驟';
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
  const itemId = isEdit ? existingId : `P_${Date.now()}`;

  const projVal = document.getElementById('newProject').value.trim();
  const contentVal = document.getElementById('newContent').value.trim();
  const remarksVal = document.getElementById('newRemarks').value.trim();

  if (!contentVal || !projVal) return;

  if (isEdit) {
    const target = allProcedures.find(r => String(r.id) === String(itemId));
    if (target) {
      target.project = projVal;
      target.content = contentVal;
      target.remarks = remarksVal;
    }
  } else {
    allProcedures.push({
      id: itemId,
      project: projVal,
      content: contentVal,
      remarks: remarksVal
    });
  }
  
  updateProjectDropdown();
  renderProjectBoards();
  closeModal();

  if (API_URL) {
    const params = new URLSearchParams({
      action: isEdit ? 'editProcedure' : 'addProcedure',
      key: CONFIG.SECRET_KEY || '',
      id: itemId,
      project: projVal,
      content: contentVal,
      remarks: remarksVal
    });
    fetch(`${API_URL}?${params.toString()}`, { mode: 'no-cors' });
  }
}
// 點擊專案標題的 ＋ 按鈕時觸發，自動帶入專案名稱
function openModalForProject(projectName) {
  document.getElementById('modalTitle').innerHTML = `📝 新增步驟至：${projectName}`;
  document.getElementById('editRowId').value = '';
  document.getElementById('addForm').reset();
  
  // 自動填入該專案名稱並將輸入框唯讀（或可修改）
  const projectInput = document.getElementById('newProject');
  projectInput.value = projectName;
  
  document.getElementById('modal').style.display = 'flex';
}
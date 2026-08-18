let allScenes = [];
let activeTagFilter = null;
let activeChapterFilter = 'ALL';
let openChaptersState = {}; 

let API_URL = '';
let GID = '';
let SHEET_ID = '';

function initGoogleSignIn() {
  if (typeof BOOK_CONFIG !== 'undefined' && BOOK_CONFIG.GOOGLE_CLIENT_ID) {
    google.accounts.id.initialize({
      client_id: BOOK_CONFIG.GOOGLE_CLIENT_ID,
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
  if (typeof BOOK_CONFIG !== 'undefined') {
    SHEET_ID = BOOK_CONFIG.BOOK_WRITER_SHEET_ID || '';
    GID = (BOOK_CONFIG.GIDS && BOOK_CONFIG.GIDS.BOOK_WRITER) ? BOOK_CONFIG.GIDS.BOOK_WRITER : '0';
    API_URL = BOOK_CONFIG.API_URLS?.BOOK_WRITER || '';
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
        const currentPath = window.location.pathname.split('/').pop() || 'book-writer.html';
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
      allScenes = results.data.map((item, index) => {
        const v = Object.values(item);
        return {
          id: item.ID || item.id || v[0] || `S_${Date.now()}_${index}`,
          sectionNum: item['節'] || v[1] || '',
          chapter: item['章'] || item.Chapter || v[2] || '第一章',
          landscape: item['天氣現象/風景'] || item['天氣現象 / 風景'] || v[3] || '',
          outline: item['內容大綱'] || item.Outline || v[4] || '',
          category: item['分類'] || v[5] || '',
          photo: item['相片'] || item.Photo || v[6] || '',
          desc: item['描述'] || item.Description || v[7] || ''
        };
      });
      
      const loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.style.display = 'none';
      
      updateChapterDropdown();
      renderChapterBoards();
    },
    error: (err) => {
      document.getElementById('loading').textContent = '❌ 載入寫作大綱資料失敗，請確認 GID 或公開權限。';
      console.error(err);
    }
  });
}

function getPastelColor(str) {
  const pastelColors = [
    { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' }, 
    { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' }, 
    { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' }, 
    { bg: '#fefce8', text: '#854d0e', border: '#fde047' }, 
    { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' }, 
    { bg: '#f0fdfa', text: '#115e59', border: '#99f6e4' }, 
    { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' }, 
    { bg: '#f5f3ff', text: '#4338ca', border: '#c7d2fe' }  
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % pastelColors.length;
  return pastelColors[index];
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
  renderChapterBoards();
}

function clearFilter() {
  activeTagFilter = null;
  activeChapterFilter = 'ALL';
  
  document.getElementById('chapterFilter').value = 'ALL';
  document.getElementById('tagFilterIndicator').style.display = 'none';
  renderChapterBoards();
}

function onChapterFilterChange(val) {
  activeChapterFilter = val;
  renderChapterBoards();
}

function updateChapterDropdown() {
  const select = document.getElementById('chapterFilter');
  if (!select) return;
  const chapters = Array.from(new Set(allScenes.map(r => r.chapter).filter(Boolean)));
  
  let html = '<option value="ALL">全部章節</option>';
  chapters.forEach(chap => {
    html += `<option value="${chap}">${chap}</option>`;
  });
  select.innerHTML = html;
  select.value = activeChapterFilter;
}

function renderChapterBoards() {
  const container = document.getElementById('chapterBoardContainer');
  if (!container) return;
  container.innerHTML = '';

  let filteredScenes = allScenes;

  if (activeTagFilter) {
    filteredScenes = filteredScenes.filter(r => (r.outline && r.outline.includes(activeTagFilter)) || (r.landscape && r.landscape.includes(activeTagFilter)));
  }

  if (activeChapterFilter !== 'ALL') {
    filteredScenes = filteredScenes.filter(r => r.chapter === activeChapterFilter);
  }

  const chapters = Array.from(new Set(filteredScenes.map(r => r.chapter)));

  if (chapters.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#94a3b8; padding: 40px;">目前尚無寫作大綱記錄，點擊上方按鈕新增！</div>`;
    return;
  }

  chapters.forEach(chapterName => {
    const chapterItems = filteredScenes.filter(r => r.chapter === chapterName);
    const boardKey = `chap_${chapterName.replace(/\s+/g, '_')}`;
    const isOpen = !!openChaptersState[chapterName];
    const theme = getPastelColor(chapterName);

    const board = document.createElement('div');
    board.className = `chapter-board`;
    board.style.border = `1px solid ${theme.border}`;
    
    let headerHtml = `
      <div class="chapter-header" onclick="toggleChapter('${chapterName.replace(/'/g, "\\'")}')" style="background-color: ${theme.bg}; color: ${theme.text};">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${isOpen ? '▼' : '▶'}</span>
          <span>📚 ${chapterName}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="item-count" style="background: rgba(0,0,0,0.06);">${chapterItems.length}</span>
          <button onclick="event.stopPropagation(); openModalForChapter('${chapterName.replace(/'/g, "\\'")}')" style="background: rgba(0,0,0,0.1); border:none; color:${theme.text}; padding:2px 8px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.9rem;" title="在此章節新增風景段落">＋</button>
        </div>
      </div>
    `;

    let bodyHtml = `<div class="chapter-body" id="board_body_${boardKey}" style="display: ${isOpen ? 'flex' : 'none'};">`;
    
    if (chapterItems.length === 0) {
      bodyHtml += `<div style="text-align:center; color:#94a3b8; font-size:0.85rem; margin-top:10px;">無段落記錄</div>`;
    } else {
      const savedOrder = JSON.parse(localStorage.getItem(`writer_order_${boardKey}`) || '[]');
      if (savedOrder.length > 0) {
        chapterItems.sort((a, b) => {
          let idxA = savedOrder.indexOf(String(a.id));
          let idxB = savedOrder.indexOf(String(b.id));
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });
      }

      chapterItems.forEach((item, index) => {
        const safeId = String(item.id).replace(/'/g, "\\'");
        const outlineSnippet = item.outline ? formatTextWithTags(item.outline.replace(/\n/g, '<br>')) : '<span style="color:#94a3b8">尚無大綱內容...</span>';

        bodyHtml += `
          <div class="mini-scene-card" data-id="${item.id}" onclick="openPreviewModal('${safeId}')" style="border-left: 4px solid ${theme.border};">
            <div style="font-size:0.75rem; color:#64748b; margin-bottom:2px;">第 ${index + 1} 節</div>
            <div style="font-size:0.95rem; font-weight:bold; color:#0f172a; margin-bottom:4px;">
              ${item.landscape}
            </div>
            <div style="font-size:0.82rem; color:#475569; line-height:1.3; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
              ${outlineSnippet}
            </div>
          </div>
        `;
      });
    }
    bodyHtml += `</div>`;
    
    board.innerHTML = headerHtml + bodyHtml;
    container.appendChild(board);

    const bodyEl = document.getElementById(`board_body_${boardKey}`);
    if (bodyEl && typeof Sortable !== 'undefined' && chapterItems.length > 0 && isOpen) {
      Sortable.create(bodyEl, {
        animation: 150,
        onEnd: function () {
          const cards = bodyEl.querySelectorAll('.mini-scene-card');
          const newOrder = Array.from(cards).map(card => card.getAttribute('data-id'));
          localStorage.setItem(`writer_order_${boardKey}`, JSON.stringify(newOrder));
          renderChapterBoards();
        }
      });
    }
  });
}

function toggleChapter(chapterName) {
  openChaptersState[chapterName] = !openChaptersState[chapterName];
  renderChapterBoards();
}

function openModalForChapter(chapterName) {
  openChaptersState[chapterName] = true;
  document.getElementById('modalTitle').innerHTML = `📝 新增段落至：${chapterName}`;
  document.getElementById('editRowId').value = '';
  document.getElementById('addForm').reset();
  
  document.getElementById('newChapter').value = chapterName;
  document.getElementById('modal').style.display = 'flex';
}

function openPreviewModal(id) {
  const item = allScenes.find(r => String(r.id) === String(id));
  if (!item) return;

  document.getElementById('previewRowId').value = item.id;
  document.getElementById('previewChapter').textContent = item.chapter;
  document.getElementById('previewLandscape').textContent = item.landscape;
  document.getElementById('previewOutline').innerHTML = item.outline ? formatTextWithTags(item.outline.replace(/\n/g, '<br>')) : '<span style="color:#94a3b8">無大綱內容</span>';
  document.getElementById('previewPhoto').textContent = `相片: ${item.photo || '無'} | 描述: ${item.desc || '無'}`;
  
  document.getElementById('previewModal').style.display = 'flex';
}

function closePreviewModal() { 
  document.getElementById('previewModal').style.display = 'none'; 
}

function deleteItem() {
  const itemId = document.getElementById('previewRowId').value;
  const target = allScenes.find(r => String(r.id) === String(itemId));
  if (!target || !confirm("確定要刪除這筆寫作段落嗎？")) return;

  allScenes = allScenes.filter(r => String(r.id) !== String(itemId));
  updateChapterDropdown();
  renderChapterBoards();
  closePreviewModal();

  if (API_URL) {
    const secret = BOOK_CONFIG.SECRET_KEY || '';
    const params = new URLSearchParams({
      action: 'deleteWriter',
      key: secret,
      id: itemId
    });
    fetch(`${API_URL}?${params.toString()}`, { mode: 'no-cors' });
  }
}

function openEditMode() {
  const itemId = document.getElementById('previewRowId').value;
  const item = allScenes.find(r => String(r.id) === String(itemId));
  if (!item) return;

  closePreviewModal();

  document.getElementById('modalTitle').innerHTML = '✏️ 修改寫作段落';
  document.getElementById('editRowId').value = item.id;
  document.getElementById('newChapter').value = item.chapter;
  document.getElementById('newLandscape').value = item.landscape;
  document.getElementById('newOutline').value = item.outline || '';
  document.getElementById('newPhoto').value = item.photo || '';

  document.getElementById('modal').style.display = 'flex';
}

function openModal() {
  document.getElementById('modalTitle').innerHTML = '📝 新增寫作段落';
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
  const itemId = isEdit ? existingId : `S_${Date.now()}`;

  const chapVal = document.getElementById('newChapter').value.trim();
  const landVal = document.getElementById('newLandscape').value.trim();
  const outlineVal = document.getElementById('newOutline').value.trim();
  const photoVal = document.getElementById('newPhoto').value.trim();

  if (!landVal || !chapVal) return;

  openChaptersState[chapVal] = true;

  if (isEdit) {
    const target = allScenes.find(r => String(r.id) === String(itemId));
    if (target) {
      target.chapter = chapVal;
      target.landscape = landVal;
      target.outline = outlineVal;
      target.photo = photoVal;
    }
  } else {
    allScenes.push({
      id: itemId,
      chapter: chapVal,
      landscape: landVal,
      outline: outlineVal,
      photo: photoVal,
      desc: ''
    });
  }
  
  updateChapterDropdown();
  renderChapterBoards();
  closeModal();

  if (API_URL) {
    const params = new URLSearchParams({
      action: isEdit ? 'editWriter' : 'addWriter',
      key: BOOK_CONFIG.SECRET_KEY || '',
      id: itemId,
      chapter: chapVal,
      landscape: landVal,
      outline: outlineVal,
      photo: photoVal
    });
    fetch(`${API_URL}?${params.toString()}`, { mode: 'no-cors' });
  }
}
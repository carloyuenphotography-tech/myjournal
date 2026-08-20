// ct_memo.js - 2A 班主任 Memo 控制邏輯
let rawMemos = [];
let currentCategory = 'ALL';
let showArchived = false;

window.onload = () => {
  fetchMemos();
};

async function fetchMemos() {
  const listContainer = document.getElementById('memoList');
  if (typeof CT_MEMO_CONFIG === 'undefined' || !CT_MEMO_CONFIG.GAS_API_URL) {
    listContainer.innerHTML = '<p style="color:red;">❌ 錯誤：找不到 ct_memo_gas.js 設定。</p>';
    return;
  }

  try {
    const response = await fetch(`${CT_MEMO_CONFIG.GAS_API_URL}?action=getAll`);
    const result = await response.json();
    if (result.status === 'success') {
      rawMemos = result.data || [];
      rawMemos.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      renderMemos();
    } else {
      listContainer.innerHTML = `<p style="color:red;">❌ 讀取失敗：${result.message || ''}</p>`;
    }
  } catch (err) {
    listContainer.innerHTML = `<p style="color:red;">❌ 資料載入失敗：${err.message}</p>`;
  }
}

function renderMemos() {
  const searchKeyword = document.getElementById('searchInput').value.toLowerCase();
  const listContainer = document.getElementById('memoList');
  listContainer.innerHTML = '';

  const filtered = rawMemos.filter(item => {
    const matchCategory = (currentCategory === 'ALL') || (item.category === currentCategory);
    const matchArchive = Boolean(item.is_archived) === showArchived;
    const contentStr = `${item.topic} ${item.content} ${item.reminders} ${item.hashtags} ${item.category}`.toLowerCase();
    const matchSearch = contentStr.includes(searchKeyword);

    return matchCategory && matchArchive && matchSearch;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = '<p style="color:#64748b;">目前沒有符合條件的 Memo。</p>';
    return;
  }

  filtered.forEach(memo => {
    const card = document.createElement('div');
    card.className = `memo-card ${memo.is_favorite ? 'favorite' : ''}`;
    card.id = `card-${memo.id}`;

    const tagsHtml = (memo.hashtags || '').split(',')
      .filter(t => t.trim())
      .map(t => `<span class="tag" onclick="searchTag('${t.trim()}', event)">${t.trim()}</span>`)
      .join('');

    let hwHtml = '';
    if (memo.homework_list && memo.homework_list.length > 0) {
      hwHtml = `
        <div class="hw-container">
          <div class="hw-header-title">📋 收集進度追蹤</div>
          ${memo.homework_list.map(hw => `
            <div class="hw-item">
              <div class="hw-item-top">
                <span class="hw-item-title">${hw.title || '-'}</span>
                <span style="cursor:pointer; font-size:14px;" title="修改狀態" onclick="openQuickHwModal('${hw.homework_id}')">✏️</span>
              </div>
              <div class="hw-badges">
                <span class="pill pill-collect-${hw.collect_status || '未收齊'}">${hw.collect_status || '未收齊'}</span>
                ${hw.missing_students ? `<span class="pill pill-missing">⚠️ 未交: ${hw.missing_students}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>`;
    }

    card.innerHTML = `
      <div class="memo-header">
        <div>
          <div class="badge-group">
            <span class="badge">2A 班</span>
            <span class="badge category">${memo.category || '行政'}</span>
          </div>
          <div class="memo-date">${memo.date ? memo.date.substring(0,10) : ''}</div>
          <div class="memo-title">${memo.topic || '(無主題)'}</div>
        </div>
        <div style="white-space:nowrap;">
          <span class="action-btn" title="修改Memo" onclick="openEditModal('${memo.id}', event)">✏️</span>
          <span class="action-btn" title="收藏" onclick="toggleFavorite('${memo.id}', event)">
            ${memo.is_favorite ? '⭐' : '☆'}
          </span>
          <span class="action-btn" title="典藏" onclick="toggleArchive('${memo.id}', event)">
            ${memo.is_archived ? '📂' : '📦'}
          </span>
        </div>
      </div>
      
      <div style="margin-top:6px;">${tagsHtml}</div>

      <div class="memo-body">
        <div class="teaching-content">${memo.content || '<span style="color:#94a3b8; font-size:14px;">(暫無跟進內容)</span>'}</div>
        ${memo.reminders ? `<div class="reminder-box">🔔 ${memo.reminders}</div>` : ''}
        ${hwHtml}
      </div>
    `;

    listContainer.appendChild(card);
  });
}

function filterCategory(categoryName, btn) {
  currentCategory = categoryName;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMemos();
}

function searchTag(tagName, event) {
  event.stopPropagation();
  document.getElementById('searchInput').value = tagName;
  renderMemos();
}

function toggleArchiveView(btn) {
  showArchived = !showArchived;
  btn.innerText = showArchived ? "查看一般 Memo" : "📦 典藏";
  renderMemos();
}

function openQuickHwModal(hwId) {
  let targetHw = null;
  for (let memo of rawMemos) {
    if (memo.homework_list) {
      let found = memo.homework_list.find(h => h.homework_id === hwId);
      if (found) { targetHw = found; break; }
    }
  }

  if (!targetHw) return;

  document.getElementById('quickHwId').value = hwId;
  document.getElementById('quickHwTitle').innerText = `✏️ 修改：${targetHw.title}`;
  document.getElementById('quickCollect').value = targetHw.collect_status || '未收齊';
  document.getElementById('quickMissing').value = targetHw.missing_students || '';

  document.getElementById('hwQuickEditModal').style.display = 'flex';
}

function closeQuickHwModal() {
  document.getElementById('hwQuickEditModal').style.display = 'none';
}

async function submitQuickHwEdit() {
  const hwId = document.getElementById('quickHwId').value;
  const saveBtn = document.getElementById('quickSaveBtn');
  saveBtn.innerText = '⏳ 儲存中...';

  const payload = {
    action: 'updateHomeworkInline',
    data: {
      homework_id: hwId,
      collect_status: document.getElementById('quickCollect').value,
      missing_students: document.getElementById('quickMissing').value
    }
  };

  await fetch(CT_MEMO_CONFIG.GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  saveBtn.innerText = '儲存更新';
  closeQuickHwModal();
  fetchMemos();
}

function addHomeworkRow(data = {}) {
  const container = document.getElementById('homeworkFormContainer');
  const rowId = 'hwRow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  const html = `
    <div class="hw-form-row" id="${rowId}">
      <input type="hidden" class="hw-id" value="${data.homework_id || ''}">
      
      <div class="hw-form-row-header">
        <span style="font-size:12px; font-weight:bold; color:#475569;">收集項目</span>
        <button type="button" class="btn-del-hw" onclick="document.getElementById('${rowId}').remove()" title="刪除">✕</button>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
        <input type="text" class="hw-title" placeholder="項目名稱 (例: 回條 #01)" value="${data.title || ''}" style="grid-column: span 2;">
        
        <select class="hw-collect">
          <option value="未收齊" ${data.collect_status === '未收齊' ? 'selected' : ''}>未收齊</option>
          <option value="收集中" ${data.collect_status === '收集中' ? 'selected' : ''}>收集中</option>
          <option value="已收齊" ${data.collect_status === '已收齊' ? 'selected' : ''}>已收齊</option>
        </select>

        <input type="text" class="hw-missing" placeholder="欠交號碼 (#03, #15)" value="${data.missing_students || ''}">
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

function openModal() {
  document.getElementById('modalTitle').innerText = '新增班主任 Memo';
  document.getElementById('formMemoId').value = '';
  document.getElementById('formDate').valueAsDate = new Date();
  document.getElementById('formCategory').value = '螢亮手冊';
  document.getElementById('formTopic').value = '';
  document.getElementById('formContent').value = '';
  document.getElementById('formReminders').value = '';
  document.getElementById('formHashtags').value = '';
  document.getElementById('homeworkFormContainer').innerHTML = '';
  
  addHomeworkRow();
  document.getElementById('memoModal').style.display = 'flex';
}

function openEditModal(memoId, event) {
  event.stopPropagation();
  const memo = rawMemos.find(m => m.id === memoId);
  if (!memo) return;

  document.getElementById('modalTitle').innerText = '修改班主任 Memo';
  document.getElementById('formMemoId').value = memo.id;
  document.getElementById('formDate').value = memo.date ? memo.date.substring(0, 10) : '';
  document.getElementById('formCategory').value = memo.category || '螢亮手冊';
  document.getElementById('formTopic').value = memo.topic || '';
  document.getElementById('formContent').value = memo.content || '';
  document.getElementById('formReminders').value = memo.reminders || '';
  document.getElementById('formHashtags').value = memo.hashtags || '';

  const container = document.getElementById('homeworkFormContainer');
  container.innerHTML = '';

  if (memo.homework_list && memo.homework_list.length > 0) {
    memo.homework_list.forEach(hw => addHomeworkRow(hw));
  } else {
    addHomeworkRow();
  }

  document.getElementById('memoModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('memoModal').style.display = 'none';
}

async function saveMemo() {
  const memoId = document.getElementById('formMemoId').value;
  
  const hwRows = document.querySelectorAll('.hw-form-row');
  const homeworkList = [];
  hwRows.forEach(row => {
    const title = row.querySelector('.hw-title').value;
    if (title.trim()) {
      homeworkList.push({
        homework_id: row.querySelector('.hw-id').value,
        title: title,
        collect_status: row.querySelector('.hw-collect').value,
        missing_students: row.querySelector('.hw-missing').value
      });
    }
  });

  const isEdit = Boolean(memoId);
  const payload = {
    action: isEdit ? 'updateMemo' : 'createMemo',
    data: {
      id: memoId,
      date: document.getElementById('formDate').value,
      category: document.getElementById('formCategory').value,
      topic: document.getElementById('formTopic').value,
      content: document.getElementById('formContent').value,
      reminders: document.getElementById('formReminders').value,
      hashtags: document.getElementById('formHashtags').value,
      homework_list: homeworkList
    }
  };

  closeModal();
  document.getElementById('memoList').innerHTML = '<p>儲存中...</p>';

  await fetch(CT_MEMO_CONFIG.GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  fetchMemos();
}

async function toggleFavorite(id, event) {
  event.stopPropagation();
  const memo = rawMemos.find(m => m.id === id);
  if (!memo) return;
  memo.is_favorite = !memo.is_favorite;
  renderMemos();

  await fetch(CT_MEMO_CONFIG.GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'updateMemo', data: { id: id, is_favorite: memo.is_favorite } })
  });
}

async function toggleArchive(id, event) {
  event.stopPropagation();
  const memo = rawMemos.find(m => m.id === id);
  if (!memo) return;
  memo.is_archived = !memo.is_archived;
  renderMemos();

  await fetch(CT_MEMO_CONFIG.GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'updateMemo', data: { id: id, is_archived: memo.is_archived } })
  });
}
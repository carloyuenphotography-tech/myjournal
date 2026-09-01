// ct_memo.js - 2A 班主任 Memo 控制邏輯 (已修正時區與日期跳動問題)
let rawMemos = [];
let currentCategory = 'ALL';
let showArchived = false;

window.onload = () => {
  fetchMemos();
};

// 輔助函數：將日期安全轉換為 YYYY-MM-DD (避免 UTC 時區導致日期偏了一天)
function formatDateStr(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    // 如果是 ISO 格式 (例如: 2026-09-01T00:00:00.000Z)
    if (dateVal.includes('T')) {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal.substring(0, 10);
      const localD = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
      return localD.toISOString().split('T')[0];
    }
    return dateVal.substring(0, 10);
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const localD = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
  return localD.toISOString().split('T')[0];
}

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
          <div class="hw-header-title">📋 收集進度追蹤 (點擊標籤直接切換)</div>
          ${memo.homework_list.map(hw => `
            <div class="hw-item">
              <div class="hw-item-top">
                <span class="hw-item-title">${hw.title || '-'}</span>
              </div>
              <div class="hw-badges">
                <span class="pill pill-collect-${hw.collect_status || '未收齊'}" style="cursor:pointer;" title="點擊切換收集狀態" onclick="cycleCollectStatus('${hw.homework_id}')">${hw.collect_status || '未收齊'}</span>
                <span class="pill ${hw.missing_students ? 'pill-missing' : 'pill-collect-已收齊'}" style="cursor:pointer;" title="點擊修改未交學生" onclick="editMissingStudents('${hw.homework_id}')">
                  ${hw.missing_students ? `⚠️ 未交: ${hw.missing_students}` : '+ 記錄未交'}
                </span>
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
          <div class="memo-date">${formatDateStr(memo.date)}</div>
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

// 輔助工具：尋找特定 homework 並回傳該 hw 與其 memo
function findHomeworkAndMemo(hwId) {
  for (let memo of rawMemos) {
    if (memo.homework_list) {
      let hw = memo.homework_list.find(h => h.homework_id === hwId);
      if (hw) return { memo, hw };
    }
  }
  return null;
}

// 快速更新並同步到後端
async function updateHwAndSync(hwId, updatedFields) {
  const target = findHomeworkAndMemo(hwId);
  if (!target) return;

  // 局部更新前端資料並立即重新渲染
  Object.assign(target.hw, updatedFields);
  renderMemos();

  // 背景發送 API 更新 Google Sheet
  const payload = {
    action: 'updateHomeworkInline',
    data: {
      homework_id: hwId,
      collect_status: target.hw.collect_status,
      missing_students: target.hw.missing_students
    }
  };

  await fetch(CT_MEMO_CONFIG.GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
}

// 1. 循環切換收集狀態
function cycleCollectStatus(hwId) {
  const target = findHomeworkAndMemo(hwId);
  if (!target) return;
  const sequence = ['未收齊', '收集中', '已收齊'];
  const currentIndex = sequence.indexOf(target.hw.collect_status || '未收齊');
  const nextStatus = sequence[(currentIndex + 1) % sequence.length];
  updateHwAndSync(hwId, { collect_status: nextStatus });
}

// 2. 點擊修改未交學生號碼
function editMissingStudents(hwId) {
  const target = findHomeworkAndMemo(hwId);
  if (!target) return;
  const currentVal = target.hw.missing_students || '';
  const newVal = prompt(`請輸入 ${target.hw.title} 的未交學生號碼（例如: 03, 15）：`, currentVal);
  if (newVal !== null) {
    updateHwAndSync(hwId, { missing_students: newVal.trim() });
  }
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

  // 修正：使用本地時區計算今日 YYYY-MM-DD，避免 valueAsDate 產生的 UTC 日期偏差
  const today = new Date();
  const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
                      .toISOString().split('T')[0];
  document.getElementById('formDate').value = localDate;

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
  
  // 修正：使用 formatDateStr 轉換日期，確保編輯時日期正確不跳動
  document.getElementById('formDate').value = formatDateStr(memo.date);

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

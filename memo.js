// memo.js - 數學科 Memo 控制邏輯 (已同步防護 ISO 時間字串問題)
let rawMemos = [];
let currentClass = 'ALL';
let showArchived = false;

window.onload = () => {
  fetchMemos();
};

// 輔助函數 1：將日期安全轉換為 YYYY-MM-DD (避免 UTC 時區導致日期偏了一天)
function formatDateStr(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
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

// 輔助函數 2：防止標題/主題/內文被 Google Sheet / GAS 當成 Date 物件並格式化成 ISO 時間字串
function formatTextStr(textVal) {
  if (!textVal) return '';
  const str = String(textVal).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
    return formatDateStr(str);
  }
  return str;
}

async function fetchMemos() {
  try {
    const response = await fetch(`${CONFIG.GAS_API_URL}?action=getAll`);
    const result = await response.json();
    if (result.status === 'success') {
      rawMemos = result.data || [];
      
      rawMemos.sort((a, b) => {
        const dateA = new Date(a.date || a.created_at || 0);
        const dateB = new Date(b.date || b.created_at || 0);
        return dateB - dateA;
      });

      renderMemos();
    }
  } catch (err) {
    document.getElementById('memoList').innerHTML = '<p style="color:red;">❌ 資料載入失敗，請檢查 API 設定。</p>';
  }
}

function renderMemos() {
  const searchKeyword = document.getElementById('searchInput').value.toLowerCase();
  const selectedLocation = document.getElementById('locationFilter').value;
  const listContainer = document.getElementById('memoList');
  listContainer.innerHTML = '';

  const filtered = rawMemos.filter(item => {
    const matchClass = (currentClass === 'ALL') || (item.class_name === currentClass);
    const matchArchive = Boolean(item.is_archived) === showArchived;
    
    const contentStr = `${item.topic} ${item.content} ${item.reminders} ${item.hashtags} ${item.cycle_day}`.toLowerCase();
    const matchSearch = contentStr.includes(searchKeyword);

    let matchLocation = true;
    if (selectedLocation !== 'ALL') {
      matchLocation = item.homework_list && item.homework_list.some(hw => hw.storage_location === selectedLocation);
    }

    return matchClass && matchArchive && matchSearch && matchLocation;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = '<p style="color:#64748b;">目前沒有符合條件的 Memo。</p>';
    return;
  }

  filtered.forEach(memo => {
    const card = document.createElement('div');
    const className = memo.class_name || '';
    card.className = `memo-card class-${className} ${memo.is_favorite ? 'favorite' : ''}`;
    card.id = `card-${memo.id}`;

    const tagsHtml = (memo.hashtags || '').split(',')
      .filter(t => t.trim())
      .map(t => `<span class="tag" onclick="searchTag('${t.trim()}', event)">${t.trim()}</span>`)
      .join('');

    let hwHtml = '';
    if (memo.homework_list && memo.homework_list.length > 0) {
      hwHtml = `
        <div class="hw-container">
          <div class="hw-header-title">
            <span>📚 功課進度追蹤 (點擊標籤直接切換狀態)</span>
          </div>
          ${memo.homework_list.map(hw => `
            <div class="hw-item">
              <div class="hw-item-top">
                <span class="hw-item-title">${formatTextStr(hw.title) || '-'}</span>
              </div>
              <div class="hw-badges">
                <span class="pill pill-collect-${hw.collect_status || '未收齊'}" style="cursor:pointer;" title="點擊切換收繳狀態" onclick="cycleCollectStatus('${hw.homework_id}')">${hw.collect_status || '未收齊'}</span>
                <span class="pill pill-marking-${hw.marking_status || '未批改'}" style="cursor:pointer;" title="點擊切換批改狀態" onclick="cycleMarkingStatus('${hw.homework_id}')">${hw.marking_status || '未批改'}</span>
                <span class="pill pill-location" style="cursor:pointer;" title="點擊切換存放位置" onclick="cycleLocation('${hw.homework_id}')">📍 ${hw.storage_location || '教員室'}</span>
                <span class="pill ${hw.missing_students ? 'pill-missing' : 'pill-collect-收齊'}" style="cursor:pointer;" title="點擊修改欠交學生" onclick="editMissingStudents('${hw.homework_id}')">
                  ${hw.missing_students ? `⚠️ 欠交: ${hw.missing_students}` : '+ 記錄欠交'}
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
            <span class="badge class-${className}">${className || '未指定'}</span>
            ${memo.cycle_day ? `<span class="badge cycle-day">${memo.cycle_day}</span>` : ''}
          </div>
          <div class="memo-date">${formatDateStr(memo.date)}</div>
          <div class="memo-title">${formatTextStr(memo.topic) || '(無課題名稱)'}</div>
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
        <div class="teaching-content">${formatTextStr(memo.content) || '<span style="color:#999; font-size:15px;">(暫無教學內容)</span>'}</div>
        ${memo.reminders ? `<div class="reminder-box">🔔 ${formatTextStr(memo.reminders)}</div>` : ''}
        ${hwHtml}
      </div>
    `;

    listContainer.appendChild(card);
  });
}

function findHomeworkAndMemo(hwId) {
  for (let memo of rawMemos) {
    if (memo.homework_list) {
      let hw = memo.homework_list.find(h => h.homework_id === hwId);
      if (hw) return { memo, hw };
    }
  }
  return null;
}

async function updateHwAndSync(hwId, updatedFields) {
  const target = findHomeworkAndMemo(hwId);
  if (!target) return;

  Object.assign(target.hw, updatedFields);
  renderMemos();

  const payload = {
    action: 'updateHomeworkInline',
    data: {
      homework_id: hwId,
      collect_status: target.hw.collect_status,
      marking_status: target.hw.marking_status,
      missing_students: target.hw.missing_students,
      storage_location: target.hw.storage_location
    }
  };

  await fetch(CONFIG.GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
}

function cycleCollectStatus(hwId) {
  const target = findHomeworkAndMemo(hwId);
  if (!target) return;
  const sequence = ['未收齊', '收集中', '收齊'];
  const currentIndex = sequence.indexOf(target.hw.collect_status || '未收齊');
  const nextStatus = sequence[(currentIndex + 1) % sequence.length];
  updateHwAndSync(hwId, { collect_status: nextStatus });
}

function cycleMarkingStatus(hwId) {
  const target = findHomeworkAndMemo(hwId);
  if (!target) return;
  const sequence = ['未批改', '批改中', '完成批改'];
  const currentIndex = sequence.indexOf(target.hw.marking_status || '未批改');
  const nextStatus = sequence[(currentIndex + 1) % sequence.length];
  updateHwAndSync(hwId, { marking_status: nextStatus });
}

function cycleLocation(hwId) {
  const target = findHomeworkAndMemo(hwId);
  if (!target) return;
  const sequence = ['教員室', '7/F簿櫃', '課室外', '課室內', '學生'];
  const currentIndex = sequence.indexOf(target.hw.storage_location || '教員室');
  const nextStatus = sequence[(currentIndex + 1) % sequence.length];
  updateHwAndSync(hwId, { storage_location: nextStatus });
}

function editMissingStudents(hwId) {
  const target = findHomeworkAndMemo(hwId);
  if (!target) return;
  const currentVal = target.hw.missing_students || '';
  const newVal = prompt(`請輸入 ${formatTextStr(target.hw.title)} 的欠交學生號碼（例如: 10, 12, 15）：`, currentVal);
  if (newVal !== null) {
    updateHwAndSync(hwId, { missing_students: newVal.trim() });
  }
}

function filterClass(className, btn) {
  currentClass = className;
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
  btn.innerText = showArchived ? "查看一般 Memo" : "查看典藏";
  renderMemos();
}

function addHomeworkRow(data = {}) {
  const container = document.getElementById('homeworkFormContainer');
  const rowId = 'hwRow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  const html = `
    <div class="hw-form-row" id="${rowId}">
      <input type="hidden" class="hw-id" value="${data.homework_id || ''}">
      <div style="display:flex; gap:8px; margin-bottom:5px;">
        <input type="text" class="hw-title" placeholder="功課名稱 (例: 工作紙 3.1)" value="${formatTextStr(data.title) || ''}" style="flex:2;">
        <select class="hw-location" style="flex:1;">
          <option value="教員室" ${data.storage_location === '教員室' ? 'selected' : ''}>教員室</option>
          <option value="7/F簿櫃" ${data.storage_location === '7/F簿櫃' ? 'selected' : ''}>7/F簿櫃</option>
          <option value="課室外" ${data.storage_location === '課室外' ? 'selected' : ''}>課室外</option>
          <option value="課室內" ${data.storage_location === '課室內' ? 'selected' : ''}>課室內</option>
          <option value="學生" ${data.storage_location === '學生' ? 'selected' : ''}>學生</option>
        </select>
        <button type="button" onclick="document.getElementById('${rowId}').remove()" style="background:#d9534f; color:white; border:none; padding:2px 8px; border-radius:3px; cursor:pointer;">✕</button>
      </div>
      <div style="display:flex; gap:8px;">
        <select class="hw-collect" style="flex:1;">
          <option value="未收齊" ${data.collect_status === '未收齊' ? 'selected' : ''}>未收齊</option>
          <option value="收集中" ${data.collect_status === '收集中' ? 'selected' : ''}>收集中</option>
          <option value="收齊" ${data.collect_status === '收齊' ? 'selected' : ''}>收齊</option>
        </select>
        <select class="hw-marking" style="flex:1;">
          <option value="未批改" ${data.marking_status === '未批改' ? 'selected' : ''}>未批改</option>
          <option value="批改中" ${data.marking_status === '批改中' ? 'selected' : ''}>批改中</option>
          <option value="完成批改" ${data.marking_status === '完成批改' ? 'selected' : ''}>完成批改</option>
        </select>
        <input type="text" class="hw-missing" placeholder="欠交號碼" value="${data.missing_students || ''}" style="flex:1.5;">
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

function openModal() {
  document.getElementById('modalTitle').innerText = '新增教學 Memo';
  document.getElementById('formMemoId').value = '';

  const today = new Date();
  const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
                      .toISOString().split('T')[0];
  document.getElementById('formDate').value = localDate;

  document.getElementById('formCycleDay').value = 'Day A';
  document.getElementById('formClass').value = '2A';
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

  document.getElementById('modalTitle').innerText = '修改教學 Memo';
  document.getElementById('formMemoId').value = memo.id;
  document.getElementById('formDate').value = formatDateStr(memo.date);
  document.getElementById('formCycleDay').value = memo.cycle_day || 'Day A';
  document.getElementById('formClass').value = memo.class_name || '2A';
  document.getElementById('formTopic').value = formatTextStr(memo.topic);
  document.getElementById('formContent').value = formatTextStr(memo.content);
  document.getElementById('formReminders').value = formatTextStr(memo.reminders);
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
        storage_location: row.querySelector('.hw-location').value,
        collect_status: row.querySelector('.hw-collect').value,
        marking_status: row.querySelector('.hw-marking').value,
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
      cycle_day: document.getElementById('formCycleDay').value,
      class_name: document.getElementById('formClass').value,
      topic: document.getElementById('formTopic').value,
      content: document.getElementById('formContent').value,
      reminders: document.getElementById('formReminders').value,
      hashtags: document.getElementById('formHashtags').value,
      homework_list: homeworkList
    }
  };

  closeModal();
  document.getElementById('memoList').innerHTML = '<p>儲存中...</p>';

  await fetch(CONFIG.GAS_API_URL, {
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

  await fetch(CONFIG.GAS_API_URL, {
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

  await fetch(CONFIG.GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'updateMemo', data: { id: id, is_archived: memo.is_archived } })
  });
}

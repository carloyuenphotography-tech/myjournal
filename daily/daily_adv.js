// 判斷狀態的輔助函式
function isItemDone(status) {
  return status === '完成' || status === 'Done';
}

function isItemArchived(status) {
  return status === 'Archived' || status === '已典藏';
}

// 1. 更新頂部 Bubbles 氣泡數字 (過濾掉已典藏項目)
function updateAllBadges() {
  const overdueCount = allLogs.filter(i => i.date && i.date < todayStr && !isItemDone(i.status) && !isItemArchived(i.status)).length;
  const backlogCount = allLogs.filter(i => (!i.date || i.date.trim() === '') && !isItemDone(i.status) && !isItemArchived(i.status)).length;
  const completedCount = allLogs.filter(i => isItemDone(i.status)).length;
  const archivedCount = allLogs.filter(i => isItemArchived(i.status)).length;

  document.getElementById('overdueBadgeCount').textContent = overdueCount;
  document.getElementById('backlogBadgeCount').textContent = backlogCount;
  document.getElementById('completedBadgeCount').textContent = completedCount;
  document.getElementById('archivedBadgeCount').textContent = archivedCount;
}

// 2. 渲染 已完成工作 Modal (加入「📦 典藏」按鈕)
function renderCompletedModal() {
  const body = document.getElementById('completedModalBody');
  body.innerHTML = '';

  const items = allLogs.filter(i => isItemDone(i.status))
                       .sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  if (items.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">尚無已完成的事項</div>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = `background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; gap:8px; opacity:0.85;`;
    row.innerHTML = `
      <div style="flex:1; min-width:0;">
        ${item.date ? `<div style="font-size:0.72rem; color:#166534;">📅 ${item.date}</div>` : `<div style="font-size:0.72rem; color:#7e22ce;">📥 無日期</div>`}
        <div style="font-weight:bold; font-size:0.85rem; text-decoration:line-through; color:#334155;">${item.content}</div>
        ${item.remarks ? `<div style="font-size:0.75rem; color:#64748b;">${item.remarks}</div>` : ''}
      </div>
      <div style="display:flex; gap:4px; align-items:center;">
        <button onclick="toggleStatus('${item.id}')" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:bold;">↺ 還原待辦</button>
        <button onclick="archiveItem('${item.id}')" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:bold;">📦 典藏</button>
        <button onclick="openEditModal('${item.id}')" style="background:none; border:none; cursor:pointer; font-size:0.85rem;">✏️</button>
      </div>
    `;
    body.appendChild(row);
  });
}

// 3. 🆕 典藏與典藏庫控制邏輯
function archiveItem(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  target.status = 'Archived'; // 將 Status 改為 Archived
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

  const items = allLogs.filter(i => isItemArchived(i.status))
                       .sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  if (items.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:#64748b; padding:20px 0;">典藏庫為空</div>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = `background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; gap:8px; opacity:0.75;`;
    row.innerHTML = `
      <div style="flex:1; min-width:0;">
        ${item.date ? `<div style="font-size:0.72rem; color:#64748b;">📅 ${item.date}</div>` : `<div style="font-size:0.72rem; color:#7e22ce;">📥 無日期</div>`}
        <div style="font-weight:bold; font-size:0.85rem; color:#475569;">${item.content}</div>
        ${item.remarks ? `<div style="font-size:0.75rem; color:#94a3b8;">${item.remarks}</div>` : ''}
      </div>
      <div style="display:flex; gap:4px; align-items:center;">
        <button onclick="unarchiveItem('${item.id}')" style="background:#e0f2fe; color:#0284c7; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:bold;">↺ 取消典藏</button>
        <button onclick="openEditModal('${item.id}')" style="background:none; border:none; cursor:pointer; font-size:0.85rem;">✏️</button>
      </div>
    `;
    body.appendChild(row);
  });
}

function unarchiveItem(id) {
  const target = allLogs.find(l => l.id === id);
  if (!target) return;

  target.status = '完成'; // 還原為已完成狀態
  refreshAllViews();
  syncToSheet('toggleLog', { id: target.id, content: target.content, status: '完成' });
}

// 4. 更新 refreshAllViews()
function refreshAllViews() {
  renderTimeline();
  updateAllBadges();
  if (document.getElementById('overdueModal').style.display === 'flex') renderOverdueModal();
  if (document.getElementById('backlogModal').style.display === 'flex') renderBacklogModal();
  if (document.getElementById('completedModal').style.display === 'flex') renderCompletedModal();
  if (document.getElementById('archivedModal').style.display === 'flex') renderArchivedModal();
}

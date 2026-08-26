// ... [前面保留] ...

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

// ... [其餘部分保持不變] ...

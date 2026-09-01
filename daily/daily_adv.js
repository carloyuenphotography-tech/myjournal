/* ⚡ 修正版：超強容錯的欄位讀取函數 (自動忽略大小寫與 UTF-8 BOM 隱藏字元) */
function getProp(obj, keyNames) {
  if (!obj) return '';
  
  // 取得 CSV 讀進來的所有 key，並清除隱藏字元與多餘空格
  const keys = Object.keys(obj);
  
  for (let targetKey of keyNames) {
    const targetClean = targetKey.toLowerCase().trim();
    for (let rawKey of keys) {
      const keyClean = rawKey.replace(/^\ufeff/, '').toLowerCase().trim();
      if (keyClean === targetClean) {
        return String(obj[rawKey]).trim();
      }
    }
  }
  return '';
}

/* ⚡ 修正版：日誌解析函數 */
function parseLogs(rows) {
  if (!rows || !Array.isArray(rows)) return [];
  return rows.map((r, i) => {
    // 完整涵蓋各種常見的英文/中文欄位標題名稱
    const idVal = getProp(r, ['id', 'ID', '編號']);
    const dateVal = getProp(r, ['date', 'Date', 'DATE', '日期', 'start date', 'startdate']);
    const typeVal = getProp(r, ['type', 'Type', 'TYPE', '類型', '類別']);
    const contentVal = getProp(r, ['content', 'Content', 'CONTENT', '內容', '事項']);
    const statusVal = getProp(r, ['status', 'Status', 'STATUS', '狀態']);
    const remarksVal = getProp(r, ['remarks', 'Remarks', 'REMARKS', '備註']);

    const finalId = (idVal && idVal !== '') 
      ? idVal 
      : `L_${i}_${Math.random().toString(36).substr(2, 5)}`;

    // 格式化日期：將 2026/09/01 或 2026.09.01 統一格式化為 2026-09-01
    let cleanDate = dateVal;
    if (cleanDate) {
      cleanDate = cleanDate.replace(/[\/.]/g, '-');
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        cleanDate = `${y}-${m}-${d}`;
      }
    }

    return {
      id: finalId,
      date: cleanDate,
      type: typeVal || 'Task',
      content: contentVal || '',
      status: statusVal || 'Pending',
      remarks: remarksVal || ''
    };
  });
}

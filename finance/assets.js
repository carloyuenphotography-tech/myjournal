// finance/assets.js - 處理資產紀錄與 Google Sheets 同步

let currentAccount = 'HSBC';
let assetRecords = JSON.parse(localStorage.getItem('family_assets') || '[]');

window.addEventListener('DOMContentLoaded', () => {
    // 預設日期為今天
    const assetDateInput = document.getElementById('asset-date');
    if (assetDateInput) assetDateInput.valueAsDate = new Date();
    renderAssetRecords();
});

// 選擇帳戶標籤
function selectAccount(accountName, element) {
    currentAccount = accountName;
    document.querySelectorAll('#account-pills .pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
}

// 新增資產紀錄
async function addAssetRecord() {
    const amountInput = document.getElementById('asset-amount');
    const noteInput = document.getElementById('asset-note');
    const dateInput = document.getElementById('asset-date');

    const amount = parseFloat(amountInput.value);
    const note = noteInput.value.trim() || '結餘更新';
    const date = dateInput.value;

    if (!amount || isNaN(amount)) {
        alert('請輸入有效的資產金額！');
        return;
    }

    const record = {
        id: Date.now(),
        dataType: 'asset', // 告知 GAS 這是資產資料
        account: currentAccount,
        amount: amount,
        date: date,
        note: note,
        synced: false
    };

    // 1. 寫入本地 LocalStorage
    assetRecords.unshift(record);
    saveAssetRecords();
    renderAssetRecords();

    // 清空輸入框
    amountInput.value = '';
    noteInput.value = '';

    // 2. 背景同步至 Google Sheets
    syncAssetToGoogleSheet(record);
}

// 背景同步資產至 GAS
async function syncAssetToGoogleSheet(record) {
    if (typeof CONFIG === 'undefined' || !CONFIG.gasUrl) return;

    try {
        await fetch(CONFIG.gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });

        // 標記為已同步
        const target = assetRecords.find(r => r.id === record.id);
        if (target) {
            target.synced = true;
            saveAssetRecords();
            renderAssetRecords();
        }
    } catch (err) {
        console.error('資產同步失敗:', err);
    }
}

function saveAssetRecords() {
    localStorage.setItem('family_assets', JSON.stringify(assetRecords));
}

function deleteAssetRecord(id) {
    assetRecords = assetRecords.filter(r => r.id !== id);
    saveAssetRecords();
    renderAssetRecords();
}

// 渲染資產列表與最新總資產概況
function renderAssetRecords() {
    const listEl = document.getElementById('asset-records-list');
    const overviewEl = document.getElementById('asset-overview');
    if (!listEl) return;

    listEl.innerHTML = '';

    // 計算每個帳戶最新的結餘，並加總最新總資產
    const latestAccountBalances = {};
    
    assetRecords.forEach(r => {
        // 因資料按時間倒序排列，第一個遇到的帳戶紀錄即為該帳戶最新結餘
        if (!latestAccountBalances[r.account]) {
            latestAccountBalances[r.account] = r.amount;
        }
    });

    let netWorth = Object.values(latestAccountBalances).reduce((a, b) => a + b, 0);
    document.getElementById('total-net-worth').innerText = `$${netWorth.toLocaleString()}`;

    // 顯示各帳戶最新結餘
    if (Object.keys(latestAccountBalances).length === 0) {
        overviewEl.innerText = '尚無帳戶結餘資料';
    } else {
        let overviewHtml = '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;">';
        for (const [acc, val] of Object.entries(latestAccountBalances)) {
            overviewHtml += `<div style="background:#EEF2FF; padding: 6px 10px; border-radius: 6px; font-size: 0.85rem;">${acc}: <b>$${val.toLocaleString()}</b></div>`;
        }
        overviewHtml += '</div>';
        overviewEl.innerHTML = overviewHtml;
    }

    // 渲染歷史紀錄列表
    if (assetRecords.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">尚無資產紀錄</div>';
        return;
    }

    assetRecords.forEach(r => {
        const item = document.createElement('div');
        item.className = 'record-item';
        const syncTag = r.synced ? '🟢 已同步' : '⏳ 本機儲存';

        item.innerHTML = `
            <div class="record-info">
                <div class="record-title">🏦 ${r.account} - ${escapeHtml(r.note)}</div>
                <div class="record-tags">
                    <span class="tag">${r.date}</span>
                    <span class="sync-tag">${syncTag}</span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="record-amount" style="color: var(--primary);">$${r.amount.toLocaleString()}</span>
                <button class="delete-btn" onclick="deleteAssetRecord(${r.id})">🗑️</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

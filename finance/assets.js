// finance/assets.js - 雙層戶口選擇版

let currentBank = 'HSBC';
let currentAccountType = '儲蓄 Saving';
let assetRecords = JSON.parse(localStorage.getItem('family_assets') || '[]');

window.addEventListener('DOMContentLoaded', () => {
    const assetDateInput = document.getElementById('asset-date');
    if (assetDateInput) assetDateInput.valueAsDate = new Date();
    renderAssetRecords();
});

// 選擇銀行
function selectBank(bankName, element) {
    currentBank = bankName;
    document.querySelectorAll('#bank-pills .pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
}

// 選擇戶口類別
function selectAccountType(typeName, element) {
    currentAccountType = typeName;
    document.querySelectorAll('#account-type-pills .pill').forEach(p => p.classList.remove('active'));
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

    if (!amount && amount !== 0 || isNaN(amount)) {
        alert('請輸入有效的資產金額！');
        return;
    }

    const record = {
        id: Date.now(),
        dataType: 'asset',
        bank: currentBank,
        accountType: currentAccountType,
        accountFull: `${currentBank} (${currentAccountType})`,
        amount: amount,
        date: date,
        note: note,
        synced: false
    };

    assetRecords.unshift(record);
    saveAssetRecords();
    renderAssetRecords();

    amountInput.value = '';
    noteInput.value = '';

    syncAssetToGoogleSheet(record);
}

async function syncAssetToGoogleSheet(record) {
    if (typeof CONFIG === 'undefined' || !CONFIG.gasUrl) return;

    try {
        await fetch(CONFIG.gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });

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

function renderAssetRecords() {
    const listEl = document.getElementById('asset-records-list');
    const overviewEl = document.getElementById('asset-overview');
    if (!listEl) return;

    listEl.innerHTML = '';

    // 計算每個獨特戶口 (Bank + Type) 的最新結餘
    const latestAccountBalances = {};
    
    assetRecords.forEach(r => {
        const key = r.accountFull || `${r.bank} (${r.accountType})`;
        if (latestAccountBalances[key] === undefined) {
            latestAccountBalances[key] = r.amount;
        }
    });

    let netWorth = Object.values(latestAccountBalances).reduce((a, b) => a + b, 0);
    document.getElementById('total-net-worth').innerText = `$${netWorth.toLocaleString()}`;

    if (Object.keys(latestAccountBalances).length === 0) {
        overviewEl.innerText = '尚無戶口結餘數據';
    } else {
        let overviewHtml = '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;">';
        for (const [acc, val] of Object.entries(latestAccountBalances)) {
            overviewHtml += `<div style="background:#EEF2FF; padding: 6px 10px; border-radius: 6px; font-size: 0.85rem;">${acc}: <b>$${val.toLocaleString()}</b></div>`;
        }
        overviewHtml += '</div>';
        overviewEl.innerHTML = overviewHtml;
    }

    if (assetRecords.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">尚無資產紀錄</div>';
        return;
    }

    assetRecords.forEach(r => {
        const item = document.createElement('div');
        item.className = 'record-item';
        const syncTag = r.synced ? '🟢 已同步' : '⏳ 本機儲存';
        const accName = r.accountFull || `${r.bank} (${r.accountType})`;

        item.innerHTML = `
            <div class="record-info">
                <div class="record-title">🏦 ${accName} - ${escapeHtml(r.note)}</div>
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

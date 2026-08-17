const presetCategories = [
    { name: "專注工作", icon: "💻" },
    { name: "靜觀放鬆", icon: "🧘" },
    { name: "搭乘交通", icon: "🚇" },
    { name: "閱讀進修", icon: "📚" },
    { name: "戶外散步", icon: "🚶" },
    { name: "運動健身", icon: "⚡" }
];

let state = {
    isRunning: false,
    startTime: null,
    timerInterval: null,
    currentActivity: "",
    currentLocation: "",
    currentNotes: "",
    currentCoords: null,
    history: [],
    config: {
        webhookUrl: "https://script.google.com/macros/s/你的AppsScript網址/exec",
        spreadsheetId: "你的GoogleSheet試算表ID",
        gid: "0"
    }
};

window.onload = function() {
    const savedHistory = localStorage.getItem('activity_tracker_history');
    if (savedHistory) {
        try { state.history = JSON.parse(savedHistory); } catch(e) { state.history = []; }
    }

    renderCategoryChips();
    updateHistoryFilterOptions();
    updateStats();
    renderHistory();
};

function renderCategoryChips() {
    const container = document.getElementById('category-chips');
    if (!container) return;
    container.innerHTML = presetCategories.map(cat => `
        <button type="button" onclick="selectPresetCategory('${cat.name}')" class="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-[11px] font-medium text-slate-700 transition flex items-center space-x-1 bg-white shadow-xs">
            <span>${cat.icon}</span>
            <span>${cat.name}</span>
        </button>
    `).join('');
}

function selectPresetCategory(name) {
    if (state.isRunning) {
        showToast("計時進行中，無法更改活動名稱");
        return;
    }
    document.getElementById('activity-name').value = name;
}

function switchTab(tab) {
    const timerView = document.getElementById('view-timer');
    const historyView = document.getElementById('view-history');
    const btnTimer = document.getElementById('btn-tab-timer');
    const btnHistory = document.getElementById('btn-tab-history');

    if (tab === 'timer') {
        timerView.classList.remove('hidden');
        historyView.classList.add('hidden');
        btnTimer.className = "px-2.5 py-1 text-[11px] font-medium rounded-md bg-white text-indigo-700 shadow-xs transition";
        btnHistory.className = "px-2.5 py-1 text-[11px] font-medium rounded-md text-slate-600 hover:text-slate-900 transition";
    } else {
        timerView.classList.add('hidden');
        historyView.classList.remove('hidden');
        btnHistory.className = "px-2.5 py-1 text-[11px] font-medium rounded-md bg-white text-indigo-700 shadow-xs transition";
        btnTimer.className = "px-2.5 py-1 text-[11px] font-medium rounded-md text-slate-600 hover:text-slate-900 transition";
        renderHistory();
        updateStats();
    }
}

function fetchGPSLocation() {
    const locationInput = document.getElementById('location-input');
    if (!navigator.geolocation) {
        showToast("您的瀏覽器不支援自動定位");
        return;
    }
    showToast("正在獲取 GPS 定位...");
    locationInput.placeholder = "定位中...";

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            state.currentCoords = { lat, lon };
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
                    headers: { 'Accept-Language': 'zh-HK,zh' }
                });
                const data = await res.json();
                if (data && data.display_name) {
                    const addr = data.address;
                    const placeName = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || "";
                    const road = addr.road || "";
                    const formatted = road ? `${road}${placeName ? ', ' + placeName : ''}` : data.display_name.split(',')[0];
                    locationInput.value = formatted;
                    showToast("成功獲取大約地點！");
                } else {
                    locationInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                    showToast("已獲取經緯度座標");
                }
            } catch (err) {
                locationInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                showToast("已獲取座標");
            }
        },
        (error) => {
            locationInput.placeholder = "起點/地點（可自動抓取或自訂）";
            showToast("無法獲取精確GPS位置");
        },
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
}

function startTimer() {
    const nameInput = document.getElementById('activity-name');
    const activityName = nameInput.value.trim();
    if (!activityName) {
        showToast("請先輸入或選取活動名稱！");
        nameInput.focus();
        return;
    }

    state.currentActivity = activityName;
    state.currentLocation = document.getElementById('location-input').value.trim() || "未記錄地點";
    state.currentNotes = document.getElementById('activity-notes').value.trim();
    state.startTime = new Date(); // 記錄真實開始時間點
    state.isRunning = true;

    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-start').className = "flex-1 bg-slate-200 text-slate-400 cursor-not-allowed font-semibold py-2.5 px-3 rounded-lg transition text-xs";
    
    const stopBtn = document.getElementById('btn-stop');
    stopBtn.disabled = false;
    stopBtn.className = "flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 px-3 rounded-lg shadow-xs transition transform active:scale-95 text-xs";

    document.getElementById('active-indicator').classList.remove('hidden');
    document.getElementById('current-active-label').innerText = "計時進行中...";
    
    nameInput.disabled = true;
    document.getElementById('location-input').disabled = true;
    document.getElementById('activity-notes').disabled = true;

    document.getElementById('live-meta-panel').classList.remove('hidden');
    document.getElementById('live-activity-name').innerText = state.currentActivity;
    document.getElementById('live-location-text').innerText = state.currentLocation;
    document.getElementById('live-start-time').innerText = formatTimeOnly(state.startTime);

    // 每秒透過真實時間差更新顯示，即使畫面背景化後回來也會自動跳到正確秒數
    state.timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 1000);

    showToast(`開始記錄：「${state.currentActivity}」`);
}

function stopTimer() {
    if (!state.isRunning) return;

    clearInterval(state.timerInterval);
    state.isRunning = false;

    const endTime = new Date();
    // 關鍵：直接用結束時間減去開始時間計算總秒數（即使中途關閉畫面也完全準確）
    const durationSeconds = Math.max(1, Math.floor((endTime - state.startTime) / 1000));

    const record = {
        id: Date.now(),
        activity: state.currentActivity,
        location: state.currentLocation,
        notes: state.currentNotes,
        coords: state.currentCoords,
        startTime: state.startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: durationSeconds
    };

    state.history.unshift(record);
    saveHistoryToStorage();
    sendToGoogleSheet(record);

    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-start').className = "flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-3 rounded-lg shadow-xs transition transform active:scale-95 text-xs";
    
    const stopBtn = document.getElementById('btn-stop');
    stopBtn.disabled = true;
    stopBtn.className = "flex-1 bg-slate-200 text-slate-400 cursor-not-allowed font-semibold py-2.5 px-3 rounded-lg transition text-xs";

    document.getElementById('active-indicator').classList.add('hidden');
    document.getElementById('current-active-label').innerText = "準備開始";
    document.getElementById('timer-display').innerText = "00:00:00";

    const nameInput = document.getElementById('activity-name');
    nameInput.disabled = false;
    nameInput.value = "";
    document.getElementById('location-input').disabled = false;
    document.getElementById('location-input').value = "";
    document.getElementById('activity-notes').disabled = false;
    document.getElementById('activity-notes').value = "";
    state.currentCoords = null;

    document.getElementById('live-meta-panel').classList.add('hidden');

    showToast("活動完成，已儲存並同步雲端！");
    updateHistoryFilterOptions();
    renderHistory();
}

async function sendToGoogleSheet(record) {
    const url = state.config.webhookUrl;
    if (!url || url.includes("你的AppsScript網址")) return;
    try {
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
    } catch (e) {
        console.error("同步至 Google Sheet 失敗", e);
    }
}

async function loadGoogleSheetData() {
    const sheetId = state.config.spreadsheetId;
    const gid = state.config.gid || "0";
    if (!sheetId || sheetId.includes("你的GoogleSheet試算表ID")) {
        showToast("請先在 tracker.js 內填入正確的 Spreadsheet ID");
        return;
    }

    showToast("正在從 Google Sheet 讀取資料...");
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

    try {
        const res = await fetch(url);
        const text = await res.text();
        const json = JSON.parse(text.substring(47).slice(0, -2));
        
        const rows = json.table.rows;
        const container = document.getElementById('history-list');
        document.getElementById('history-list-title').innerText = "Google Sheet 雲端資料檢視";
        document.getElementById('history-count-badge').innerText = `共 ${rows.length} 筆`;

        if (rows.length === 0) {
            container.innerHTML = `<div class="p-4 text-center text-slate-400">雲端試算表目前無資料</div>`;
            return;
        }

        container.innerHTML = rows.map(r => {
            const cells = r.c;
            const act = cells[0] ? cells[0].v : '';
            const loc = cells[1] ? cells[1].v : '';
            const note = cells[2] ? cells[2].v : '';
            const start = cells[3] ? cells[3].v : '';
            const duration = cells[5] ? cells[5].v : '';

            return `
                <div class="p-3 hover:bg-slate-50 transition flex flex-col space-y-1">
                    <div class="flex items-center justify-between">
                        <span class="font-semibold text-slate-800">${act}</span>
                        <span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-full">${formatDuration(Number(duration))}</span>
                    </div>
                    <div class="text-slate-500 text-[10px] flex flex-wrap gap-x-2">
                        <span>開始: ${start.substring(11, 19)}</span>
                        <span class="text-indigo-600">地點: ${loc}</span>
                    </div>
                    ${note ? `<div class="text-slate-600 bg-slate-100 p-1 rounded text-[10px]">備忘: ${note}</div>` : ''}
                </div>
            `;
        }).join('');
        showToast("成功載入雲端資料！");
    } catch (err) {
        console.error(err);
        showToast("讀取失敗，請確認 ID 正確且已發佈到網路");
    }
}

function openEditModal(id) {
    const record = state.history.find(item => item.id === id);
    if (!record) return;

    document.getElementById('edit-id').value = record.id;
    document.getElementById('edit-activity').value = record.activity;
    document.getElementById('edit-location').value = record.location;
    document.getElementById('edit-notes').value = record.notes || "";
    
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function saveEditedRecord() {
    const id = Number(document.getElementById('edit-id').value);
    const record = state.history.find(item => item.id === id);
    if (!record) return;

    record.activity = document.getElementById('edit-activity').value.trim();
    record.location = document.getElementById('edit-location').value.trim();
    record.notes = document.getElementById('edit-notes').value.trim();

    saveHistoryToStorage();
    sendToGoogleSheet(record);

    closeEditModal();
    renderHistory();
    updateStats();
    showToast("已成功修改記錄，並同步至雲端！");
}

function updateTimerDisplay() {
    if (!state.isRunning || !state.startTime) return;
    const now = new Date();
    const diffSeconds = Math.floor((now - state.startTime) / 1000);
    
    const hrs = Math.floor(diffSeconds / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    const secs = diffSeconds % 60;
    
    document.getElementById('timer-display').innerText = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTimeOnly(date) {
    return date.toTimeString().split(' ')[0].substring(0, 5);
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}小時 ${mins}分`;
    if (mins > 0) return `${mins}分 ${secs}秒`;
    return `${secs}秒`;
}

function saveHistoryToStorage() {
    localStorage.setItem('activity_tracker_history', JSON.stringify(state.history));
}

function updateStats() {
    const totalCount = state.history.length;
    document.getElementById('stat-total-count').innerText = totalCount;
    const totalSecs = state.history.reduce((acc, curr) => acc + curr.durationSeconds, 0);
    document.getElementById('stat-total-time').innerText = `${Math.round(totalSecs / 60)} 分`;

    if (totalCount > 0) {
        const counts = {};
        state.history.forEach(item => counts[item.activity] = (counts[item.activity] || 0) + 1);
        document.getElementById('stat-top-activity').innerText = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    } else {
        document.getElementById('stat-top-activity').innerText = "無";
    }
}

function updateHistoryFilterOptions() {
    const select = document.getElementById('filter-category');
    if (!select) return;
    const categories = [...new Set(state.history.map(item => item.activity))];
    const currentVal = select.value;
    select.innerHTML = `<option value="">所有類別</option>` + categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    select.value = currentVal;
}

function renderHistory() {
    const titleElem = document.getElementById('history-list-title');
    if (titleElem) titleElem.innerText = "本機歷史足跡 (點擊編輯)";
    
    const container = document.getElementById('history-list');
    if (!container) return;
    
    const filterCat = document.getElementById('filter-category').value;
    let filtered = filterCat ? state.history.filter(item => item.activity === filterCat) : state.history;

    document.getElementById('history-count-badge').innerText = `共 ${filtered.length} 筆`;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">尚無本機記錄資料</div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const start = new Date(item.startTime);
        const end = new Date(item.endTime);
        const dateStr = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
        
        return `
            <div class="p-3 hover:bg-slate-50 transition flex items-center justify-between gap-2 cursor-pointer" onclick="openEditModal(${item.id})">
                <div class="space-y-0.5 truncate">
                    <div class="flex items-center space-x-1.5">
                        <span class="font-semibold text-slate-800">${item.activity}</span>
                        <span class="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-medium rounded-full">${formatDuration(item.durationSeconds)}</span>
                    </div>
                    <div class="text-[10px] text-slate-500 flex flex-wrap gap-x-2">
                        <span>${dateStr} ${formatTimeOnly(start)} - ${formatTimeOnly(end)}</span>
                        <span class="text-rose-500 truncate">📍 ${item.location}</span>
                    </div>
                    ${item.notes ? `<p class="text-[10px] text-slate-600 bg-slate-100 p-1 rounded">備忘: ${item.notes}</p>` : ''}
                </div>
                <div class="flex items-center space-x-1 shrink-0" onclick="event.stopPropagation()">
                    <button onclick="openEditModal(${item.id})" class="px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-[11px] rounded-md transition">編輯</button>
                    <button onclick="deleteRecord(${item.id})" class="p-1.5 text-slate-300 hover:text-rose-600 transition" title="刪除">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function deleteRecord(id) {
    state.history = state.history.filter(item => item.id !== id);
    saveHistoryToStorage();
    updateHistoryFilterOptions();
    updateStats();
    renderHistory();
    showToast("已刪除該筆記錄");
}

function clearAllHistory() {
    if (state.history.length === 0) {
        showToast("目前沒有本機記錄");
        return;
    }
    if (confirm("確定要清除所有本機記錄嗎？")) {
        state.history = [];
        saveHistoryToStorage();
        updateHistoryFilterOptions();
        updateStats();
        renderHistory();
        showToast("已清空本機記錄");
    }
}

let toastTimeout = null;
function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

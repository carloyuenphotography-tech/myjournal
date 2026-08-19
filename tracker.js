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
    waypoints: [], // 暫存中途經過的地點清單
    history: [],
    config: {
        webhookUrl: "https://script.google.com/macros/s/AKfycbwElm39rImTWUrUdSF4UwL99Gpf9tFVLd-igvZbIaE6A5-s-KV_f4FmKys1yE2nkVr7/exec",
        spreadsheetId: "1T7uT5umFZJLmVV3I4s7JXeNLqweoz7GwmClKzszFCt0",
        gid: "1093062333"
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

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && state.isRunning) {
            updateTimerDisplay();
        }
    });
};

function renderCategoryChips() {
    const container = document.getElementById('category-chips');
    if (!container) return;
    container.innerHTML = presetCategories.map(cat => `
        <button type="button" onclick="selectPresetCategory('${cat.name}')" class="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-xs font-medium text-slate-700 transition flex items-center space-x-1 bg-white shadow-xs">
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
        btnTimer.className = "px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-white text-indigo-700 shadow-xs transition";
        btnHistory.className = "px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 transition";
    } else {
        timerView.classList.add('hidden');
        historyView.classList.remove('hidden');
        btnHistory.className = "px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-white text-indigo-700 shadow-xs transition";
        btnTimer.className = "px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 transition";
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
            locationInput.placeholder = "起點/地點（自動抓取或自訂）";
            showToast("無法獲取精確GPS位置");
        },
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
}

// 核心新功能：中途隨時點擊記錄當前 GPS 地點
async function addWayPoint() {
    if (!state.isRunning) return;
    if (!navigator.geolocation) {
        showToast("您的瀏覽器不支援自動定位");
        return;
    }
    showToast("正在記錄中途點 GPS...");
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
                    headers: { 'Accept-Language': 'zh-HK,zh' }
                });
                const data = await res.json();
                let placeName = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                if (data && data.display_name) {
                    const addr = data.address;
                    const suburb = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || "";
                    const road = addr.road || "";
                    placeName = road ? `${road}${suburb ? ', ' + suburb : ''}` : data.display_name.split(',')[0];
                }
                
                // 避免連續按到重複的地點
                if (state.waypoints.length === 0 || state.waypoints[state.waypoints.length - 1] !== placeName) {
                    state.waypoints.push(placeName);
                    document.getElementById('waypoint-list-preview').innerText = `足跡路徑：${state.waypoints.join(' -> ')}`;
                    showToast(`📍 已成功記錄中途點：${placeName}`);
                } else {
                    showToast("與上一站地點相同，未重複記錄");
                }
            } catch (err) {
                const coordStr = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                state.waypoints.push(coordStr);
                document.getElementById('waypoint-list-preview').innerText = `足跡路徑：${state.waypoints.join(' -> ')}`;
                showToast(`📍 已記錄座標點：${coordStr}`);
            }
        },
        (error) => {
            showToast("無法獲取GPS中途點位置");
        },
        { timeout: 8000, maximumAge: 0, enableHighAccuracy: true }
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
    state.startTime = new Date();
    state.isRunning = true;
    
    // 初始化起點進入中途點清單
    state.waypoints = [state.currentLocation];
    document.getElementById('waypoint-list-preview').innerText = `足跡路徑：${state.waypoints[0]}`;
    document.getElementById('waypoint-container').classList.remove('hidden');

    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-start').className = "flex-1 bg-slate-200 text-slate-400 cursor-not-allowed font-semibold py-3 px-4 rounded-xl transition text-xs sm:text-sm";
    
    const stopBtn = document.getElementById('btn-stop');
    stopBtn.disabled = false;
    stopBtn.className = "flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 px-4 rounded-xl shadow-xs transition transform active:scale-95 text-xs sm:text-sm";

    document.getElementById('active-indicator').classList.remove('hidden');
    document.getElementById('current-active-label').innerText = "計時進行中...";
    
    nameInput.disabled = true;
    document.getElementById('location-input').disabled = true;
    document.getElementById('activity-notes').disabled = true;

    document.getElementById('live-meta-panel').classList.remove('hidden');
    document.getElementById('live-activity-name').innerText = state.currentActivity;
    document.getElementById('live-location-text').innerText = state.currentLocation;
    document.getElementById('live-start-time').innerText = formatTimeOnly(state.startTime);

    state.timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 1000);

    showToast(`開始記錄：「${state.currentActivity}」`);
}

function confirmStopTimer() {
    if (!state.isRunning) return;
    const now = new Date();
    const diffSecs = Math.floor((now - state.startTime) / 1000);
    document.getElementById('confirm-stop-desc').innerText = `活動：${state.currentActivity}\n經過點數：${state.waypoints.length} 個\n已進行：${formatDuration(diffSecs)}，確定要完成並同步至雲端嗎？`;
    document.getElementById('confirm-stop-modal').classList.remove('hidden');
}

function closeConfirmStopModal() {
    document.getElementById('confirm-stop-modal').classList.add('hidden');
}

async function stopTimer() {
    closeConfirmStopModal();
    if (!state.isRunning) return;

    clearInterval(state.timerInterval);
    state.isRunning = false;

    const endTime = new Date();
    const durationSeconds = Math.max(1, Math.floor((endTime - state.startTime) / 1000));

    // 結束時自動抓取最後一個終點位置
    let finalCoords = state.currentCoords;
    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000, maximumAge: 0, enableHighAccuracy: true });
            });
            finalCoords = { lat: position.coords.latitude, lon: position.coords.longitude };
            
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${finalCoords.lat}&lon=${finalCoords.lon}&zoom=18&addressdetails=1`, {
                headers: { 'Accept-Language': 'zh-HK,zh' }
            });
            const data = await res.json();
            if (data && data.display_name) {
                const addr = data.address;
                const placeName = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || "";
                const road = addr.road || "";
                const finalPlace = road ? `${road}${placeName ? ', ' + placeName : ''}` : data.display_name.split(',')[0];
                
                // 如果最後一個點跟目前清單不一樣，自動加入終點
                if (state.waypoints[state.waypoints.length - 1] !== finalPlace) {
                    state.waypoints.push(finalPlace);
                }
            }
        } catch (e) {
            console.log("終點定位略過");
        }
    }

    // 將所有中途點用 " -> " 串連成一條完整的足跡字串
    const finalLocationString = state.waypoints.join(' -> ');

    const record = {
        id: Date.now(),
        activity: state.currentActivity,
        location: finalLocationString, // 串連後的完整足跡
        notes: state.currentNotes,
        coords: finalCoords,
        startTime: state.startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: durationSeconds
    };

    state.history.unshift(record);
    saveHistoryToStorage();
    sendToGoogleSheet(record);

    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-start').className = "flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl shadow-xs transition transform active:scale-95 text-xs sm:text-sm";
    
    const stopBtn = document.getElementById('btn-stop');
    stopBtn.disabled = true;
    stopBtn.className = "flex-1 bg-slate-200 text-slate-400 cursor-not-allowed font-semibold py-3 px-4 rounded-xl transition text-xs sm:text-sm";

    document.getElementById('active-indicator').classList.add('hidden');
    document.getElementById('current-active-label').innerText = "準備開始";
    document.getElementById('timer-display').innerText = "00:00:00";
    document.getElementById('waypoint-container').classList.add('hidden');
    state.waypoints = [];

    const nameInput = document.getElementById('activity-name');
    nameInput.disabled = false;
    nameInput.value = "";
    document.getElementById('location-input').disabled = false;
    document.getElementById('location-input').value = "";
    document.getElementById('activity-notes').disabled = false;
    document.getElementById('activity-notes').value = "";
    state.currentCoords = null;

    document.getElementById('live-meta-panel').classList.add('hidden');

    showToast("✨ 記錄完成！多點足跡路線已儲存並同步至雲端。");
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
        if (rows.length === 0) {
            showToast("雲端試算表目前無資料");
            return;
        }

        state.history = rows.map((r, index) => {
            const cells = r.c;
            return {
                id: Date.now() + index,
                activity: cells[0] ? cells[0].v : '未命名活動',
                location: cells[1] ? cells[1].v : '未記錄地點',
                notes: cells[2] ? cells[2].v : '',
                startTime: cells[3] ? cells[3].v : new Date().toISOString(),
                endTime: cells[4] ? cells[4].v : new Date().toISOString(),
                durationSeconds: cells[5] ? Number(cells[5].v) : 0,
                coords: null
            };
        });

        saveHistoryToStorage();
        updateHistoryFilterOptions();
        updateStats();
        renderHistory();
        showToast("成功從雲端載入資料！");
    } catch (err) {
        console.error(err);
        showToast("讀取失敗，請確認 ID 正確且已發佈到網路");
    }
}

function openEditModal(id) {
    const record = state.history.find(item => Number(item.id) === Number(id));
    if (!record) return;

    document.getElementById('edit-id').value = record.id;
    document.getElementById('edit-activity').value = record.activity;
    document.getElementById('edit-location').value = record.location;
    document.getElementById('edit-notes').value = record.notes || "";
    
    const startObj = new Date(record.startTime);
    document.getElementById('edit-time-info').innerText = `開始時間：${isNaN(startObj) ? record.startTime : startObj.toLocaleString()}`;
    document.getElementById('edit-duration-info').innerText = `持續時間：${formatDuration(record.durationSeconds)}`;
    
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function saveEditedRecord() {
    const id = Number(document.getElementById('edit-id').value);
    const record = state.history.find(item => Number(item.id) === id);
    if (!record) return;

    record.activity = document.getElementById('edit-activity').value.trim();
    record.location = document.getElementById('edit-location').value.trim();
    record.notes = document.getElementById('edit-notes').value.trim();

    saveHistoryToStorage();
    sendToGoogleSheet(record);

    closeEditModal();
    renderHistory();
    updateStats();
    showToast("✨ 已成功更新記錄與修改內容！");
}

function deleteRecord(id) {
    const targetId = Number(id);
    const recordToDelete = state.history.find(item => Number(item.id) === targetId);
    
    if (!recordToDelete) return;

    if (confirm("確定要刪除這筆記錄嗎？這將會同步從本機及 Google Sheet 中移除。")) {
        state.history = state.history.filter(item => Number(item.id) !== targetId);
        saveHistoryToStorage();
        updateHistoryFilterOptions();
        updateStats();
        renderHistory();

        sendDeleteToGoogleSheet(recordToDelete);
        showToast("已從本機與雲端刪除記錄");
    }
}

async function sendDeleteToGoogleSheet(record) {
    const url = state.config.webhookUrl;
    if (!url || url.includes("你的AppsScript網址")) return;
    try {
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: "delete",
                startTime: record.startTime
            })
        });
    } catch (e) {
        console.error("雲端同步刪除失敗", e);
    }
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
    const totalSecs = state.history.reduce((acc, curr) => acc + Number(curr.durationSeconds || 0), 0);
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
    if (titleElem) titleElem.innerText = "本機歷史足跡 (點擊閱讀詳情與修改)";
    
    const container = document.getElementById('history-list');
    if (!container) return;
    
    const filterCat = document.getElementById('filter-category').value;
    let filtered = filterCat ? state.history.filter(item => item.activity === filterCat) : state.history;

    document.getElementById('history-count-badge').innerText = `共 ${filtered.length} 筆`;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs sm:text-sm">尚無記錄資料</div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        let startTimeStr = item.startTime;
        let timeDisplay = startTimeStr;
        try {
            const d = new Date(startTimeStr);
            if (!isNaN(d)) {
                const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                timeDisplay = `${dateStr} ${d.toTimeString().split(' ')[0].substring(0, 5)}`;
            }
        } catch(e) {}
        
        return `
            <div class="p-3.5 sm:p-4 hover:bg-slate-50 transition flex items-center justify-between gap-2">
                <div class="space-y-1 truncate flex-grow cursor-pointer" onclick="openEditModal(${item.id})">
                    <div class="flex items-center space-x-2">
                        <span class="font-semibold text-slate-800 text-sm sm:text-base">${item.activity}</span>
                        <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">${formatDuration(item.durationSeconds)}</span>
                    </div>
                    <div class="text-xs text-slate-500 flex flex-wrap gap-x-3">
                        <span>開始: ${timeDisplay}</span>
                        <span class="text-rose-500 truncate">📍 ${item.location}</span>
                    </div>
                    ${item.notes ? `<p class="text-xs text-slate-600 bg-slate-100 p-1.5 rounded truncate">備忘: ${item.notes}</p>` : ''}
                </div>
                <div class="flex items-center space-x-1 shrink-0">
                    <button type="button" onclick="openEditModal(${item.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs rounded-xl transition">詳情</button>
                    <button type="button" onclick="deleteRecord(${item.id})" class="p-2 text-slate-400 hover:text-rose-600 transition bg-slate-50 hover:bg-rose-50 rounded-xl" title="刪除">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

let toastTimeout = null;
function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3500);
}
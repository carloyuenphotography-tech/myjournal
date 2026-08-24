let API_URL = localStorage.getItem("gas_api_url") || (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.GAS_URL : "");

let notes = [];
let currentFilterTag = "all";
let currentEditingId = null;

document.addEventListener("DOMContentLoaded", () => {
    loadNotes();

    document.getElementById("addNoteBtn").addEventListener("click", handleAddNote);
    document.getElementById("searchInput").addEventListener("input", handleSearch);

    const settingsModal = document.getElementById("settingsModal");
    document.getElementById("openSettingsBtn").addEventListener("click", () => {
        document.getElementById("gasUrlInput").value = API_URL;
        settingsModal.classList.remove("hidden");
    });
    document.getElementById("closeSettingsBtn").addEventListener("click", () => settingsModal.classList.add("hidden"));
    document.getElementById("saveSettingsBtn").addEventListener("click", () => {
        const newUrl = document.getElementById("gasUrlInput").value.trim();
        localStorage.setItem("gas_api_url", newUrl);
        API_URL = newUrl;
        settingsModal.classList.add("hidden");
        alert("GAS 網址已儲存！");
        loadNotes();
    });

    const editModal = document.getElementById("editModal");
    document.getElementById("closeEditModalBtn").addEventListener("click", () => editModal.classList.add("hidden"));
    document.getElementById("saveEditBtn").addEventListener("click", handleSaveEdit);

    const detailModal = document.getElementById("detailModal");
    document.getElementById("closeDetailModalBtn").addEventListener("click", () => detailModal.classList.add("hidden"));
    detailModal.addEventListener("click", (e) => {
        if (e.target === detailModal) detailModal.classList.add("hidden");
    });

    initSortable();
});

function initSortable() {
    const container = document.getElementById("notesContainer");
    if (typeof Sortable === 'undefined') return;

    Sortable.create(container, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'opacity-30',
        onEnd: function (evt) {
            const cardElements = container.querySelectorAll('[data-id]');
            const newOrderIds = Array.from(cardElements).map(el => el.getAttribute('data-id'));

            let reorderedNotes = [];
            newOrderIds.forEach(id => {
                const note = notes.find(n => n.id === id);
                if (note) reorderedNotes.push(note);
            });

            notes.forEach(note => {
                if (!reorderedNotes.some(n => n.id === note.id)) {
                    reorderedNotes.push(note);
                }
            });

            notes = reorderedNotes;
            saveNotesToCloud();
        }
    });
}

async function loadNotes() {
    try {
        if (!API_URL) throw new Error("未設定 GAS 網址");
        const response = await fetch(API_URL);
        const result = await response.json();
        notes = result.notes || [];
        renderNotes();
        renderTagFilters();
    } catch (error) {
        console.log("使用本地測試資料模式。");
        notes = [
            { id: "1", title: "阿明", content: "喜歡看這篇文章 https://github.com \n壓力大時看看 #工作 #推薦", pinned: true, updatedAt: new Date().toISOString() },
            { id: "2", title: "小美", content: "最近在準備轉職，壓力大 #工作 #朋友", pinned: false, updatedAt: new Date().toISOString() }
        ];
        renderNotes();
        renderTagFilters();
    }
}

async function saveNotesToCloud() {
    if (!API_URL) return;
    try {
        await fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ notes })
        });
    } catch (error) {
        console.error("同步失敗", error);
    }
}

function handleAddNote() {
    const titleInput = document.getElementById("noteTitle");
    const contentInput = document.getElementById("noteContent");

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title && !content) return;

    const tags = content.match(/#[^\s#]+/g) || [];

    const newNote = {
        id: Date.now().toString(),
        title,
        content,
        tags,
        pinned: false,
        updatedAt: new Date().toISOString()
    };

    notes.unshift(newNote);
    titleInput.value = "";
    contentInput.value = "";

    renderNotes();
    renderTagFilters();
    saveNotesToCloud();
}

function openEditModal(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    currentEditingId = id;
    document.getElementById("editNoteTitle").value = note.title;
    document.getElementById("editNoteContent").value = note.content;
    document.getElementById("editModal").classList.remove("hidden");
}

function openDetailModal(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    document.getElementById("detailNoteTitle").innerHTML = `<i class="fa-solid fa-user-tag text-yellow-500"></i> ${escapeHtml(note.title)}`;
    
    let processedContent = escapeHtml(note.content);
    processedContent = processedContent.replace(/(https?:\/\/[^\s]+)/g, (url) => {
        let domain = "";
        try { domain = new URL(url).hostname; } catch(e) { domain = url; }
        return `<a href="${url}" target="_blank" class="inline-flex items-center gap-1 my-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-yellow-600 hover:bg-yellow-50 transition max-w-full truncate"><i class="fa-solid fa-link text-yellow-500"></i><span class="truncate">${domain}</span></a>`;
    });
    // 讓詳細對話框裏面的 hashtag 也可以點擊篩選
    processedContent = processedContent.replace(/(#[^\s#]+)/g, '<span onclick="filterByTag(\'$1\')" class="text-yellow-600 font-semibold bg-yellow-50 px-1.5 py-0.5 rounded cursor-pointer hover:bg-yellow-100 transition inline-block my-0.5">$1</span>');

    document.getElementById("detailNoteContent").innerHTML = processedContent;

    let formattedDate = "";
    if (note.updatedAt) {
        const dateObj = new Date(note.updatedAt);
        formattedDate = `最後修改於：${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
    }
    document.getElementById("detailNoteDate").textContent = formattedDate;

    document.getElementById("detailModal").classList.remove("hidden");
}

function handleSaveEdit() {
    const title = document.getElementById("editNoteTitle").value.trim();
    const content = document.getElementById("editNoteContent").value.trim();

    if (!title && !content) return;

    const note = notes.find(n => n.id === currentEditingId);
    if (note) {
        note.title = title;
        note.content = content;
        note.tags = content.match(/#[^\s#]+/g) || [];
        note.updatedAt = new Date().toISOString();
    }

    document.getElementById("editModal").classList.add("hidden");
    renderNotes();
    renderTagFilters();
    saveNotesToCloud();
}

function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.pinned = !note.pinned;
        renderNotes();
        saveNotesToCloud();
    }
}

function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    renderNotes();
    renderTagFilters();
    saveNotesToCloud();
}

function handleSearch(e) {
    renderNotes(e.target.value.toLowerCase());
}

// 點擊 hashtag 進行篩選
function filterByTag(tag) {
    currentFilterTag = tag;
    renderNotes();
    renderTagFilters();
}

// 取消篩選，恢復全體顯示
function clearFilter() {
    currentFilterTag = "all";
    renderNotes();
    renderTagFilters();
}

// 動態渲染篩選狀態提示列（沒篩選時隱藏，有篩選時出現）
function renderTagFilters() {
    const bar = document.getElementById("tagFilterBar");
    if (currentFilterTag === "all") {
        bar.innerHTML = "";
        bar.classList.add("hidden");
        return;
    }
    bar.classList.remove("hidden");
    bar.innerHTML = `
        <div class="flex items-center justify-between bg-yellow-50 border border-yellow-200 px-4 py-2.5 rounded-xl text-sm shadow-2xs">
            <div class="flex items-center gap-2 text-yellow-800">
                <i class="fa-solid fa-filter text-yellow-500"></i>
                <span>目前篩選標籤：<strong class="font-bold">${currentFilterTag}</strong></span>
            </div>
            <button onclick="clearFilter()" class="text-xs bg-white border border-yellow-300 text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition font-medium shadow-2xs flex items-center gap-1 cursor-pointer">
                取消篩選 <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;
}

// 異步取得連結預覽資料（已加入 Google Photos 專屬卡片支援）
async function fetchLinkPreview(url, placeholderId) {
    const el = document.getElementById(placeholderId);
    if (!el) return;

    // 1. 針對 Google Photos 連結直接客製化顯示（繞過無法抓取預覽的限制）
    if (url.includes('photos.app.goo.gl') || url.includes('photos.google.com')) {
        el.innerHTML = `
            <a href="${url}" target="_blank" class="flex items-center gap-3 my-2.5 p-3 bg-white border border-yellow-200 rounded-xl hover:border-yellow-400 hover:shadow-md transition group overflow-hidden">
                <div class="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0 text-yellow-600 text-base">
                    <i class="fa-solid fa-photo-film"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1 text-[10px] text-yellow-600 font-medium mb-0.5">
                        <i class="fa-solid fa-images"></i>
                        <span>Google Photos 相簿</span>
                    </div>
                    <div class="font-bold text-gray-800 text-xs truncate group-hover:text-yellow-600 transition">點擊開啟相簿檢視相片</div>
                </div>
            </a>
        `;
        return;
    }

    // 2. 一般網址維持原有的 Microlink API 預覽抓取
    try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const data = result.data;
            let domain = "";
            try { domain = new URL(url).hostname; } catch(e) { domain = url; }
            const imageUrl = data.image?.url || data.image || "";

            el.innerHTML = `
                <a href="${url}" target="_blank" class="flex items-center gap-3 my-2.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-yellow-400 hover:shadow-md transition group overflow-hidden">
                    ${imageUrl ? `<img src="${imageUrl}" class="w-14 h-14 object-cover rounded-lg shrink-0 bg-gray-100" onerror="this.style.display='none'">` : ''}
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                            <i class="fa-solid fa-globe text-yellow-500"></i>
                            <span class="truncate">${domain}</span>
                        </div>
                        <div class="font-bold text-gray-800 text-xs line-clamp-1 group-hover:text-yellow-600 transition">${escapeHtml(data.title || domain)}</div>
                        ${data.description ? `<div class="text-[10px] text-gray-500 line-clamp-1 mt-0.5">${escapeHtml(data.description)}</div>` : ''}
                    </div>
                </a>
            `;
        } else {
            throw new Error("API 沒回傳成功資料");
        }
    } catch (e) {
        let domain = "";
        try { domain = new URL(url).hostname; } catch(e) { domain = url; }
        el.innerHTML = `
            <a href="${url}" target="_blank" class="inline-flex items-center gap-1.5 my-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs hover:border-yellow-400 transition max-w-full shadow-2xs">
                <i class="fa-solid fa-link text-yellow-500 shrink-0 text-[10px]"></i>
                <span class="text-gray-700 font-medium truncate">${domain}</span>
            </a>
        `;
    }
}

function renderNotes(searchQuery = "") {
    const container = document.getElementById("notesContainer");
    container.innerHTML = "";

    const sortedNotes = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    const filtered = sortedNotes.filter(note => {
        const matchesSearch = note.title.toLowerCase().includes(searchQuery) || 
                              note.content.toLowerCase().includes(searchQuery);
        const matchesTag = currentFilterTag === "all" || (note.tags && note.tags.includes(currentFilterTag));
        return matchesSearch && matchesTag;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center text-gray-400 py-10 text-sm">沒有找到相關筆記</p>`;
        return;
    }

    filtered.forEach(note => {
        const card = document.createElement("div");
        card.setAttribute("data-id", note.id);
        card.className = `bg-white rounded-xl shadow-sm hover:shadow-md transition p-4 border ${note.pinned ? 'border-yellow-400 bg-yellow-50/20' : 'border-gray-200'} flex flex-col justify-between`;

        let processedContent = escapeHtml(note.content);
        
        let linkCounter = 0;
        processedContent = processedContent.replace(/(https?:\/\/[^\s]+)/g, (url) => {
            linkCounter++;
            const placeholderId = `preview-${note.id}-${linkCounter}`;
            setTimeout(() => fetchLinkPreview(url, placeholderId), 50);
            return `<div id="${placeholderId}"><div class="inline-flex items-center gap-1.5 my-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-400"><i class="fa-solid fa-spinner fa-spin text-yellow-500"></i> 載入連結預覽中...</div></div>`;
        });

        // 讓筆記卡片內的 hashtag 變成可點擊的按鈕
        processedContent = processedContent.replace(/(#[^\s#]+)/g, '<span onclick="filterByTag(\'$1\')" class="text-yellow-600 font-semibold bg-yellow-50 px-1.5 py-0.5 rounded cursor-pointer hover:bg-yellow-100 transition inline-block my-0.5">$1</span>');

        let formattedDate = "";
        if (note.updatedAt) {
            const dateObj = new Date(note.updatedAt);
            formattedDate = `修改於：${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        }

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-2">
                    <h3 onclick="openDetailModal('${note.id}')" class="font-bold text-gray-800 text-base flex items-center gap-1 cursor-pointer hover:text-yellow-600 transition" title="點擊詳細閱讀">
                        <i class="fa-solid fa-user-tag text-yellow-500 text-xs"></i> ${escapeHtml(note.title)}
                    </h3>
                    <div class="flex items-center gap-1.5">
                        <button onclick="openEditModal('${note.id}')" class="text-gray-400 hover:text-yellow-500 p-1 transition" title="編輯">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onclick="togglePin('${note.id}')" class="text-gray-400 hover:text-yellow-500 p-1 transition" title="釘選">
                            <i class="fa-solid fa-thumbtack text-xs ${note.pinned ? 'text-yellow-500 rotate-45' : ''}"></i>
                        </button>
                        <button onclick="deleteNote('${note.id}')" class="text-gray-400 hover:text-red-500 p-1 transition" title="刪除">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                        <i class="fa-solid fa-grip-vertical text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing drag-handle p-1 ml-1" title="按住拖拉排序"></i>
                    </div>
                </div>
                <div class="text-gray-600 text-sm whitespace-pre-wrap mb-4 line-clamp-5">${processedContent}</div>
            </div>
            <div class="text-[10px] text-gray-400 text-right">
                ${formattedDate}
            </div>
        `;
        container.appendChild(card);
    });
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

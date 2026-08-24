let API_URL = localStorage.getItem("gas_api_url") || (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.GAS_URL : "");

let notes = [];
let currentFilterTag = "all";
let currentEditingId = null;

document.addEventListener("DOMContentLoaded", () => {
    loadNotes();

    document.getElementById("addNoteBtn").addEventListener("click", handleAddNote);
    document.getElementById("searchInput").addEventListener("input", handleSearch);
    
    document.querySelector(".tag-filter-all").addEventListener("click", () => {
        currentFilterTag = "all";
        renderNotes();
    });

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
    processedContent = processedContent.replace(/(#[^\s#]+)/g, '<span class="text-yellow-600 font-semibold bg-yellow-50 px-1 rounded">$1</span>');

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

function renderTagFilters() {
    const bar = document.getElementById("tagFilterBar");
    const allBtn = bar.querySelector(".tag-filter-all");
    bar.innerHTML = "";
    bar.appendChild(allBtn);

    const allTags = new Set();
    notes.forEach(n => {
        if (n.tags) n.tags.forEach(t => allTags.add(t));
    });

    allTags.forEach(tag => {
        const btn = document.createElement("button");
        btn.className = `px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${currentFilterTag === tag ? 'bg-yellow-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`;
        btn.textContent = tag;
        btn.addEventListener("click", () => {
            currentFilterTag = tag;
            renderNotes();
            renderTagFilters();
        });
    });
}

// 異步取得連結預覽資料
async function fetchLinkPreview(url, placeholderId) {
    const el = document.getElementById(placeholderId);
    if (!el) return;

    try {
        // 使用免費的 Microlink API 抓取網站 metadata (Title, Description, Image)
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const data = result.data;
            let domain = "";
            try { domain = new URL(url).hostname; } catch(e) { domain = url; }

            el.innerHTML = `
                <a href="${url}" target="_blank" class="block my-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-yellow-50/40 transition group">
                    <div class="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
                        <i class="fa-solid fa-globe text-yellow-500"></i>
                        <span class="truncate">${domain}</span>
                    </div>
                    <div class="font-bold text-gray-800 text-xs line-clamp-1 group-hover:text-yellow-600 transition">${escapeHtml(data.title || domain)}</div>
                    ${data.description ? `<div class="text-[11px] text-gray-500 line-clamp-1 mt-0.5">${escapeHtml(data.description)}</div>` : ''}
                </a>
            `;
        } else {
            throw new Error("API 沒回傳成功資料");
        }
    } catch (e) {
        // 失敗時自動降級為精簡按鈕
        let domain = "";
        try { domain = new URL(url).hostname; } catch(e) { domain = url; }
        el.innerHTML = `
            <a href="${url}" target="_blank" class="inline-flex items-center gap-1.5 my-1 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs hover:bg-yellow-50/60 transition max-w-full">
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
        
        // 將網址替換為動態載入預覽的佔位區塊 (Placeholder)
        let linkCounter = 0;
        processedContent = processedContent.replace(/(https?:\/\/[^\s]+)/g, (url) => {
            linkCounter++;
            const placeholderId = `preview-${note.id}-${linkCounter}`;
            // 非同步在背景呼叫 API 填入預覽
            setTimeout(() => fetchLinkPreview(url, placeholderId), 50);
            return `<div id="${placeholderId}"><div class="inline-flex items-center gap-1.5 my-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-400"><i class="fa-solid fa-spinner fa-spin text-yellow-500"></i> 載入連結預覽中...</div></div>`;
        });

        processedContent = processedContent.replace(/(#[^\s#]+)/g, '<span class="text-yellow-600 font-semibold bg-yellow-50 px-1 rounded">$1</span>');

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

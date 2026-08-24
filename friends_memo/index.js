let API_URL = localStorage.getItem("gas_api_url") || "";
let notes = [];
let currentFilterTag = "all";
let currentEditingId = null; // 紀錄目前正在編輯的筆記 ID

document.addEventListener("DOMContentLoaded", () => {
    loadNotes();

    document.getElementById("addNoteBtn").addEventListener("click", handleAddNote);
    document.getElementById("searchInput").addEventListener("input", handleSearch);
    
    document.querySelector(".tag-filter-all").addEventListener("click", () => {
        currentFilterTag = "all";
        renderNotes();
    });

    // 設定視窗開關
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

    // 編輯視窗關閉與儲存
    const editModal = document.getElementById("editModal");
    document.getElementById("closeEditModalBtn").addEventListener("click", () => editModal.classList.add("hidden"));
    document.getElementById("saveEditBtn").addEventListener("click", handleSaveEdit);
});

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
            { id: "1", title: "阿明", content: "喜歡手沖咖啡 https://example.com #咖啡 #生日5月", pinned: true, updatedAt: new Date().toISOString() },
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes })
        });
    } catch (error) {
        console.error("同步失敗", error);
    }
}

// 新增筆記
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

// 開啟編輯視窗
function openEditModal(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    currentEditingId = id;
    document.getElementById("editNoteTitle").value = note.title;
    document.getElementById("editNoteContent").value = note.content;
    document.getElementById("editModal").classList.remove("hidden");
}

// 儲存編輯結果
function handleSaveEdit() {
    const title = document.getElementById("editNoteTitle").value.trim();
    const content = document.getElementById("editNoteContent").value.trim();

    if (!title && !content) return;

    const note = notes.find(n => n.id === currentEditingId);
    if (note) {
        note.title = title;
        note.content = content;
        note.tags = content.match(/#[^\s#]+/g) || [];
        note.updatedAt = new Date().toISOString(); // 更新修改日期時間
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
        card.className = `bg-white rounded-xl shadow-sm hover:shadow-md transition p-4 border ${note.pinned ? 'border-yellow-400 bg-yellow-50/20' : 'border-gray-200'} flex flex-col justify-between`;

        let processedContent = escapeHtml(note.content);
        
        processedContent = processedContent.replace(/(https?:\/\/[^\s]+)/g, (url) => {
            let domain = "";
            try { domain = new URL(url).hostname; } catch(e) { domain = url; }
            return `
                <a href="${url}" target="_blank" class="block my-2 p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-yellow-50/50 transition group">
                    <div class="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <i class="fa-solid fa-link text-yellow-500"></i>
                        <span class="font-medium text-gray-700 truncate">${domain}</span>
                    </div>
                    <div class="text-xs text-yellow-600 truncate underline">${url}</div>
                </a>
            `;
        });

        processedContent = processedContent.replace(/(#[^\s#]+)/g, '<span class="text-yellow-600 font-semibold bg-yellow-50 px-1 rounded">$1</span>');

        // 格式化最後修改日期時間
        let formattedDate = "";
        if (note.updatedAt) {
            const dateObj = new Date(note.updatedAt);
            formattedDate = `修改於：${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        }

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-gray-800 text-base flex items-center gap-1">
                        <i class="fa-solid fa-user-tag text-yellow-500 text-xs"></i> ${escapeHtml(note.title)}
                    </h3>
                    <div class="flex gap-2">
                        <button onclick="openEditModal('${note.id}')" class="text-gray-400 hover:text-yellow-500 transition" title="編輯">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="togglePin('${note.id}')" class="text-gray-400 hover:text-yellow-500 transition" title="釘選">
                            <i class="fa-solid fa-thumbtack ${note.pinned ? 'text-yellow-500 rotate-45' : ''}"></i>
                        </button>
                        <button onclick="deleteNote('${note.id}')" class="text-gray-400 hover:text-red-500 transition" title="刪除">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div class="text-gray-600 text-sm whitespace-pre-wrap mb-4">${processedContent}</div>
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

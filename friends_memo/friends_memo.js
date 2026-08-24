// 從瀏覽器 localStorage 讀取 GAS 網址，若無則預設為空
let API_URL = localStorage.getItem("gas_api_url") || "";

let notes = [];
let currentFilterTag = "all";

document.addEventListener("DOMContentLoaded", () => {
    loadNotes();

    document.getElementById("addNoteBtn").addEventListener("click", handleAddNote);
    document.getElementById("searchInput").addEventListener("input", handleSearch);
    
    document.querySelector(".tag-filter-all").addEventListener("click", () => {
        currentFilterTag = "all";
        renderNotes();
    });

    // 設定視窗開關控制
    const modal = document.getElementById("settingsModal");
    document.getElementById("openSettingsBtn").addEventListener("click", () => {
        document.getElementById("gasUrlInput").value = API_URL;
        modal.classList.remove("hidden");
    });
    document.getElementById("closeSettingsBtn").addEventListener("click", () => modal.classList.add("hidden"));
    document.getElementById("saveSettingsBtn").addEventListener("click", () => {
        const newUrl = document.getElementById("gasUrlInput").value.trim();
        localStorage.setItem("gas_api_url", newUrl);
        API_URL = newUrl;
        modal.classList.add("hidden");
        alert("GAS 網址已儲存！");
        loadNotes();
    });
});

// 載入資料
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

// 同步到雲端
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

// 渲染筆記畫面（包含連結預覽與高亮）
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

        // 處理內文：高亮 #標籤 並自動將網址轉換成預覽卡片格式
        let processedContent = escapeHtml(note.content);
        
        // 抓出網址並轉換成美觀的預覽卡片
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

        // 高亮 hashtag
        processedContent = processedContent.replace(/(#[^\s#]+)/g, '<span class="text-yellow-600 font-semibold bg-yellow-50 px-1 rounded">$1</span>');

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-gray-800 text-base flex items-center gap-1">
                        <i class="fa-solid fa-user-tag text-yellow-500 text-xs"></i> ${escapeHtml(note.title)}
                    </h3>
                    <div class="flex gap-2">
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
                ${new Date(note.updatedAt).toLocaleDateString()}
            </div>
        `;
        container.appendChild(card);
    });
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

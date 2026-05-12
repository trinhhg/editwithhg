// v1.2 - Tích hợp Tiền xử lý, Tab Cặp Thay Thế, Quét Danh Từ - 2026-05-12

// --- GLOBAL STATE ---
const STORAGE_KEY = 'editwithhg_settings';
const IDB_NAME = 'EditWithHgDB';

let appData = {
    settings: {
        fontSize: '15px',
        fontFamily: "'Montserrat', sans-serif",
        formatDialog: 0,
        capsRule: 0,
        regexPreset: 'chapter',
        customRegex: ''
    },
    relations: [],
    modes: [
        { id: 'default', name: 'Mặc định', matchCase: false, wholeWord: true, autoCaps: true, pairs: [] }
    ],
    activeModeId: 'default'
};

// Zero-DB Engine & Smart Scan
window.coreDictionary = []; 
window.localEntities = [];  
window.activeDictionary = []; 
window.pendingLore = []; // Chứa danh từ vừa quét được

let dbInstance = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    applySettingsToUI();
    renderModeSelect();
    applyModeUI();
    
    await initZeroDB();
    document.body.classList.remove('loading');

    // Events
    document.getElementById('raw-text').addEventListener('input', function() {
        document.getElementById('input-word-count').innerText = `Words: ${countWords(this.value)}`;
    });
    document.getElementById('split-input-text').addEventListener('input', function() {
        document.getElementById('split-input-word-count').innerText = `Words: ${countWords(this.value)}`;
    });

    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.setting-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.getAttribute('data-target')).classList.add('active');
        });
    });

    document.querySelectorAll('.split-mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.split-mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    document.querySelectorAll('input[name="split-type"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if(this.value === 'count') {
                document.getElementById('split-type-count').classList.remove('hidden');
                document.getElementById('split-type-regex').classList.add('hidden');
            } else {
                document.getElementById('split-type-count').classList.add('hidden');
                document.getElementById('split-type-regex').classList.remove('hidden');
            }
        });
    });
});

// --- ZERO-DB ENGINE ---
async function initZeroDB() {
    const badge = document.getElementById('db-status-badge');
    badge.innerText = "Đang tải Core DB...";
    badge.className = "badge badge-yellow";

    try {
        const res = await fetch('/data/core_dict.json');
        if (res.ok) window.coreDictionary = await res.json();
    } catch (e) {
        console.warn("Fetch core_dict.json lỗi (có thể do chạy local).");
    }

    await new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('new_entities')) db.createObjectStore('new_entities', { keyPath: 'id' });
        };
        req.onsuccess = e => { dbInstance = e.target.result; resolve(); };
        req.onerror = e => reject(e);
    });

    window.localEntities = await getAllLocalEntities();
    mergeDictionaries();

    badge.innerText = `DB Sẵn sàng (${window.activeDictionary.length} từ)`;
    badge.className = "badge badge-blue";
}

function getAllLocalEntities() {
    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction('new_entities', 'readonly');
        const req = tx.objectStore('new_entities').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

function saveLocalEntity(ent) {
    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction('new_entities', 'readwrite');
        const req = tx.objectStore('new_entities').put(ent);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function deleteLocalEntity(id) {
    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction('new_entities', 'readwrite');
        const req = tx.objectStore('new_entities').delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function mergeDictionaries() {
    const map = new Map();
    window.coreDictionary.forEach(ent => map.set(ent.id, ent));
    window.localEntities.forEach(ent => map.set(ent.id, ent)); 
    window.activeDictionary = Array.from(map.values());
}

// --- UTILS ---
function loadSettings() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try { 
            const parsed = JSON.parse(raw); 
            if(parsed.settings) appData.settings = parsed.settings;
            if(parsed.relations) appData.relations = parsed.relations;
            if(parsed.modes) appData.modes = parsed.modes;
            if(parsed.activeModeId) appData.activeModeId = parsed.activeModeId;
        } catch(e) { console.error("Error parsing settings DB"); }
    }
}

function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        settings: appData.settings,
        relations: appData.relations,
        modes: appData.modes,
        activeModeId: appData.activeModeId
    }));
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active', 'hidden'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if(tabId === 'entities') renderEntityTable();
    if(tabId === 'relations') renderRelationTable();
    if(tabId === 'modes') renderModePairsTable();
}

function countWords(str) { return str.trim() ? str.trim().split(/\s+/).length : 0; }
function showNotif(msg, type='success') {
    const container = document.getElementById('notification-container');
    const div = document.createElement('div');
    div.className = `notification ${type}`;
    div.innerText = msg;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// --- PIPELINE TIỀN XỬ LÝ & FORMAT (CORE) ---
function normalizePunctuation(text) {
    // 1. Quét dấu ngoặc kép (Unicode properties: Pi, Pf, hoặc ngoặc lạ) và ép về thẳng
    text = text.replace(/[\u2018\u2019\u201C\u201D\u201E\u00AB\u00BB\u2039\u203A\u300C\u300D\u300E\u300F]/g, '"');
    
    // 2. Dọn rác dấu ba chấm (gộp 2, 3, 4 dấu chấm thành ...)
    text = text.replace(/\.{2,}|…+/g, '...');
    
    // 3. Chuẩn hóa khoảng trắng quanh dấu câu
    text = text.replace(/\s+([:.,!?])/g, '$1'); // Xóa khoảng trắng thừa trước dấu câu
    text = text.replace(/([,.:;!?])(?=[^\s"'])/g, '$1 '); // Thêm khoảng trắng sau dấu câu nếu thiếu
    
    // 4. Hút khoảng trắng trong ngoặc kép
    text = text.replace(/"\s+(.*?)\s+"/g, '"$1"');
    
    // 5. Gom siêu khoảng trắng (Kể cả Zero-width space u200B)
    text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, ''); // Xóa sạch tàng hình
    text = text.replace(/[ \t]{2,}/g, ' '); // Gom multi space về 1
    
    return text;
}

function applyAbnormalCaps(text) {
    const capsMode = appData.settings.capsRule;
    if (capsMode === 0) return text;
    return text.replace(/(?<=[a-zà-ỹ]\s+)([A-ZÀ-Ỹ][a-zà-ỹ]+)/g, (match) => {
        if (capsMode === 1) return match.toLowerCase(); // Viết thường
        if (capsMode === 2) return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase(); // TitleCase
        return match;
    });
}

function applyDialogFormat(text) {
    const formatMode = appData.settings.formatDialog;
    if (formatMode === 0) return text;
    
    return text.replace(/:\s*([“"-].*?[”"]?)/g, (match, p1) => {
        if (formatMode === 1) return `: "${p1.replace(/^["“]+|["”]+$/g, '')}"`; // Cùng dòng
        if (formatMode === 2) return `:\n\n"${p1.replace(/^["“]+|["”]+$/g, '')}"`; // Xuống dòng
        if (formatMode === 3) return `:\n\n- ${p1.replace(/^["“]+|["”]+$/g, '')}`; // Gạch đầu dòng
        return match;
    });
}

function extractPendingLore(text) {
    // Bắt các danh từ viết hoa đứng giữa câu
    const regex = /(?<!^|\.\s+|!\s+|\?\s+|:\s+|"\s+)([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*)/g;
    let match;
    const foundNames = new Set();
    
    while ((match = regex.exec(text)) !== null) {
        const noun = match[1];
        // Bỏ qua nếu đã có trong core_dict
        const exists = window.activeDictionary.some(e => e.name === noun || (e.aliases && e.aliases.includes(noun)));
        if (!exists) foundNames.add(noun);
    }
    
    window.pendingLore = Array.from(foundNames);
    renderPendingLoreSidebar();
}

// --- TAB CẶP THAY THẾ (MODES) ---
function getActiveMode() { return appData.modes.find(m => m.id === appData.activeModeId) || appData.modes[0]; }

function renderModeSelect() {
    const sel = document.getElementById('mode-select');
    sel.innerHTML = appData.modes.map(m => `<option value="${m.id}" ${m.id === appData.activeModeId ? 'selected' : ''}>${m.name}</option>`).join('');
}

function switchMode(id) {
    appData.activeModeId = id;
    saveSettings();
    applyModeUI();
    renderModePairsTable();
}

function applyModeUI() {
    const m = getActiveMode();
    const updateBtn = (id, prop) => {
        const btn = document.getElementById(id);
        if (m[prop]) { btn.classList.add('active'); btn.querySelector('.status').innerText = 'BẬT'; }
        else { btn.classList.remove('active'); btn.querySelector('.status').innerText = 'TẮT'; }
    };
    updateBtn('toggle-match-case', 'matchCase');
    updateBtn('toggle-whole-word', 'wholeWord');
    updateBtn('toggle-auto-caps', 'autoCaps');
}

function toggleModeSetting(prop) {
    const m = getActiveMode();
    m[prop] = !m[prop];
    saveSettings();
    applyModeUI();
}

function addMode() {
    const name = prompt("Nhập tên chế độ mới:");
    if(!name) return;
    const newId = 'm-' + Date.now();
    appData.modes.push({ id: newId, name, matchCase: false, wholeWord: true, autoCaps: true, pairs: [] });
    appData.activeModeId = newId;
    saveSettings(); renderModeSelect(); applyModeUI(); renderModePairsTable();
}

function cloneMode() {
    const m = getActiveMode();
    const name = prompt("Tên chế độ copy:", m.name + " (Copy)");
    if(!name) return;
    const newId = 'm-' + Date.now();
    appData.modes.push({ id: newId, name, matchCase: m.matchCase, wholeWord: m.wholeWord, autoCaps: m.autoCaps, pairs: JSON.parse(JSON.stringify(m.pairs)) });
    appData.activeModeId = newId;
    saveSettings(); renderModeSelect(); applyModeUI(); renderModePairsTable();
}

function renameMode() {
    if(appData.activeModeId === 'default') return showNotif("Không thể đổi tên Mặc định", "error");
    const m = getActiveMode();
    const name = prompt("Đổi tên thành:", m.name);
    if(!name) return;
    m.name = name; saveSettings(); renderModeSelect();
}

function deleteMode() {
    if(appData.activeModeId === 'default') return showNotif("Không thể xóa Mặc định", "error");
    if(confirm("Xóa chế độ này?")) {
        appData.modes = appData.modes.filter(m => m.id !== appData.activeModeId);
        appData.activeModeId = 'default';
        saveSettings(); renderModeSelect(); applyModeUI(); renderModePairsTable();
    }
}

function addPairUI() {
    const m = getActiveMode();
    // Prepend (Thêm vào đầu = STT lớn ở trên)
    m.pairs.unshift({ id: 'p-'+Date.now(), find: '', replace: '', type: 'normal' });
    saveSettings();
    renderModePairsTable();
}

function deletePair(id) {
    const m = getActiveMode();
    m.pairs = m.pairs.filter(p => p.id !== id);
    saveSettings();
    renderModePairsTable();
}

function updatePair(id, field, value) {
    const m = getActiveMode();
    const p = m.pairs.find(x => x.id === id);
    if(p) { p[field] = value; saveSettings(); }
}

function renderModePairsTable() {
    const tbody = document.getElementById('pairs-list-body');
    tbody.innerHTML = '';
    const m = getActiveMode();
    const total = m.pairs.length;
    
    // Vì đã unshift() ở trên nên mảng đang theo thứ tự mới nhất -> cũ nhất
    m.pairs.forEach((p, idx) => {
        const stt = total - idx; // STT ngược (to ở trên)
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:#999; font-weight:600; text-align:center;">${stt}</td>
            <td><input type="text" class="pair-row-input" value="${p.find}" onchange="updatePair('${p.id}', 'find', this.value)" placeholder="Từ gốc..."></td>
            <td><input type="text" class="pair-row-input" value="${p.replace}" onchange="updatePair('${p.id}', 'replace', this.value)" placeholder="Từ thay thế..."></td>
            <td>
                <select class="pair-row-select" onchange="updatePair('${p.id}', 'type', this.value)">
                    <option value="normal" ${p.type === 'normal' ? 'selected' : ''}>Bình thường</option>
                    <option value="regex" ${p.type === 'regex' ? 'selected' : ''}>Regex</option>
                </select>
            </td>
            <td><button class="icon-btn" style="color:#ef4444" onclick="deletePair('${p.id}')"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

function exportModeCSV() {
    const m = getActiveMode();
    if(m.pairs.length === 0) return showNotif("Không có dữ liệu", "error");
    let csv = "find,replace,type\n";
    m.pairs.forEach(p => { csv += `"${p.find}","${p.replace}","${p.type}"\n`; });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `mode_${m.name}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// --- THỰC THỂ & QUAN HỆ LOGIC (Zero-DB) ---
// ... (Logic render/save/delete Entity và Relation giữ nguyên như file v1.1 cũ, không lặp lại để tiết kiệm chữ, chỉ bổ sung Quick Lore)

function exportNewWordsCSV() {
    if (window.localEntities.length === 0) return showNotif("Không có từ mới nào trong Local để xuất!", "error");
    let csv = "id,name,type,aliases,notes\n";
    window.localEntities.forEach(e => {
        const safeAliases = e.aliases ? e.aliases.join(',').replace(/"/g, '""') : '';
        const safeNotes = e.notes ? e.notes.replace(/"/g, '""') : '';
        csv += `${e.id},"${e.name}",${e.type},"${safeAliases}","${safeNotes}"\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "new_words.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showNotif("Đã tải xuống file new_words.csv");
}

function renderEntityTable() {
    const tbody = document.getElementById('entity-list-body');
    const filterTxt = document.getElementById('search-entity').value.toLowerCase();
    const filterType = document.getElementById('filter-type').value;
    tbody.innerHTML = '';
    let count = 0;
    window.activeDictionary.forEach(ent => {
        const aliasStr = (ent.aliases || []).join(', ');
        if ((ent.name.toLowerCase().includes(filterTxt) || aliasStr.toLowerCase().includes(filterTxt)) && (filterType === 'all' || ent.type === filterType)) {
            count++;
            const isLocal = window.localEntities.some(l => l.id === ent.id);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:#999;">${count}</td>
                <td style="font-weight:700; color:var(--primary)">${ent.name} ${isLocal?'<i class="fa-solid fa-clock-rotate-left" style="color:#f59e0b"></i>':''}</td>
                <td><span class="tag ${ent.type}">${ent.type}</span></td>
                <td>${aliasStr}</td>
                <td style="color:#666;">${ent.notes || ''}</td>
                <td>
                    <button class="icon-btn" onclick="editEntity('${ent.id}')"><i class="fa-solid fa-pencil"></i></button>
                    <button class="icon-btn" style="color:#ef4444" onclick="deleteEntity('${ent.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}
async function saveEntity() {
    const id = document.getElementById('ent-id').value;
    const name = document.getElementById('ent-name').value.trim();
    if(!name) return showNotif("Thiếu tên chuẩn!", "error");
    const aliasesRaw = document.getElementById('ent-aliases').value;
    const ent = { id: id || 'ent-'+Date.now(), type: document.getElementById('ent-type').value, name: name, aliases: aliasesRaw ? aliasesRaw.split(',').map(x=>x.trim()).filter(x=>x) : [], notes: document.getElementById('ent-notes').value };
    await saveLocalEntity(ent); window.localEntities = await getAllLocalEntities(); mergeDictionaries();
    closeModal('modal-entity'); renderEntityTable(); showNotif("Đã lưu thực thể vào Local");
}
async function deleteEntity(id){ if(confirm("Xóa khỏi Local?")){ await deleteLocalEntity(id); window.localEntities = await getAllLocalEntities(); mergeDictionaries(); renderEntityTable(); showNotif("Đã xóa khỏi Local"); } }
function editEntity(id){ const e = window.activeDictionary.find(x=>x.id===id); if(!e) return; document.getElementById('ent-id').value = e.id; document.getElementById('ent-name').value = e.name; document.getElementById('ent-type').value = e.type; document.getElementById('ent-aliases').value = (e.aliases || []).join(', '); document.getElementById('ent-notes').value = e.notes || ''; openModal('modal-entity'); }
function renderRelationTable() { const tbody = document.getElementById('relation-list-body'); tbody.innerHTML = ''; appData.relations.forEach((rel, i) => { const n1 = (window.activeDictionary.find(x=>x.id===rel.from)||{}).name||rel.from; const n2 = (window.activeDictionary.find(x=>x.id===rel.to)||{}).name||rel.to; tbody.innerHTML += `<tr><td>${i+1}</td><td><b>${n1}</b></td><td><span style="color:#2563eb">⎯ ${rel.type} ➝</span></td><td><b>${n2}</b></td><td><button class="icon-btn" style="color:#ef4444" onclick="deleteRelation('${rel.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`; }); }
function saveRelation(){ const from = document.getElementById('rel-from').value; const to = document.getElementById('rel-to').value; const type = document.getElementById('rel-type').value; if(!from || !to || !type) return; appData.relations.push({id: 'rel-'+Date.now(), from, to, type}); saveSettings(); closeModal('modal-relation'); renderRelationTable(); }
function openRelationModal(){ const opts = window.activeDictionary.map(e=>`<option value="${e.id}">${e.name}</option>`).join(''); document.getElementById('rel-from').innerHTML = opts; document.getElementById('rel-to').innerHTML = opts; document.getElementById('rel-type').value = ''; openModal('modal-relation'); }
function deleteRelation(id){ appData.relations = appData.relations.filter(x=>x.id!==id); saveSettings(); renderRelationTable(); }


// --- PENDING LORE SIDEBAR LOGIC ---
function renderPendingLoreSidebar() {
    const list = document.getElementById('pending-lore-list');
    list.innerHTML = '';
    if(window.pendingLore.length === 0) {
        list.innerHTML = `<div class="empty-message">Không quét được danh từ mới.</div>`;
        return;
    }
    window.pendingLore.forEach((word, idx) => {
        const item = document.createElement('div');
        item.className = 'pending-item';
        item.innerHTML = `
            <span title="${word}">${word}</span>
            <div class="pending-actions">
                <button class="icon-btn-sm add" onclick="openQuickLore('${escapeRegExp(word)}')"><i class="fa-solid fa-plus"></i></button>
                <button class="icon-btn-sm del" onclick="removePendingLore(${idx})"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

function clearPendingLore() { window.pendingLore = []; renderPendingLoreSidebar(); }
function removePendingLore(idx) { window.pendingLore.splice(idx, 1); renderPendingLoreSidebar(); }

function openQuickLore(word) {
    document.getElementById('ql-name').value = word;
    document.getElementById('ql-name-display').innerText = word;
    openModal('modal-quick-lore');
}

async function saveQuickLore() {
    const name = document.getElementById('ql-name').value;
    const type = document.getElementById('ql-type').value;
    const ent = { id: 'ent-'+Date.now(), type, name, aliases: [], notes: '' };
    
    await saveLocalEntity(ent);
    window.localEntities = await getAllLocalEntities();
    mergeDictionaries();
    
    // Bỏ ra khỏi pending list
    window.pendingLore = window.pendingLore.filter(w => w !== name);
    renderPendingLoreSidebar();
    closeModal('modal-quick-lore');
    
    // Tự động Replace lại màn hình để highlight từ vừa thêm
    processText(false); 
    showNotif(`Đã thêm ${name} vào từ điển!`);
}

// --- MAIN REPLACE PIPELINE ---
function processText(doRescan = true) {
    let text = document.getElementById('raw-text').value;
    if(!text.trim()) return;

    let stats = { foundLore: 0, replaceNormal: 0, capsFixed: 0 };

    // BƯỚC 1: TIỀN XỬ LÝ (DỌN DẤU CÂU UNICODE)
    text = normalizePunctuation(text);

    // BƯỚC 2: THAY THẾ THEO CHẾ ĐỘ (MODE PAIRS)
    const activeMode = getActiveMode();
    if (activeMode && activeMode.pairs.length > 0) {
        // Cờ regex: gu = global + unicode, giu = global + ignoreCase + unicode
        const flags = activeMode.matchCase ? 'gu' : 'giu';
        
        activeMode.pairs.forEach(p => {
            if(!p.find) return;
            let pattern;
            if (p.type === 'regex') {
                pattern = new RegExp(p.find, flags);
            } else {
                // Xử lý Whole Word tiếng Việt siêu chuẩn (Look-behind và Look-ahead chặn \p{L} và \p{N})
                const escapedFind = escapeRegExp(p.find);
                if (activeMode.wholeWord) {
                    pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escapedFind}(?![\\p{L}\\p{N}_])`, flags);
                } else {
                    pattern = new RegExp(escapedFind, flags);
                }
            }
            text = text.replace(pattern, (match) => {
                stats.replaceNormal++;
                return `<span class="hl-replaced">${p.replace}</span>`;
            });
        });
    }

    // BƯỚC 3: THAY THẾ THỰC THỂ (LORE ZERO-DB)
    let keywords = []; 
    let loreMap = {};
    window.activeDictionary.forEach(e => {
        loreMap[e.name] = e.name;
        keywords.push(e.name);
        (e.aliases || []).forEach(a => { 
            loreMap[a] = e.name; 
            keywords.push(a); 
        });
    });
    
    // Sort dài xuống ngắn để không bị lỗi Replace cụm ngắn trước
    keywords.sort((a,b) => b.length - a.length);
    
    if (keywords.length > 0) {
        // Build regex với Whole Word (Lore mặc định là Whole Word)
        const loreRegex = new RegExp(`(?<![\\p{L}\\p{N}_])(${keywords.map(k=>escapeRegExp(k)).join('|')})(?![\\p{L}\\p{N}_])`, 'g');
        text = text.replace(loreRegex, (m) => {
            stats.foundLore++; 
            return `<span class="hl-found">${loreMap[m] || m}</span>`; 
        });
    }

    // BƯỚC 4: XỬ LÝ VIẾT HOA BẤT THƯỜNG
    text = applyAbnormalCaps(text);

    // BƯỚC 5: AUTO CAPS ĐẦU CÂU (Áp dụng nếu bật trong Mode)
    if (activeMode.autoCaps) {
        // Tự động viết hoa sau . ! ? ... và đầu dòng (bỏ qua HTML span tags)
        text = text.replace(/(^|[\.\!\?\n]+[\s]*)(<span[^>]*>)?([a-zà-ỹ])/g, (match, prefix, spanTag, letter) => {
            return prefix + (spanTag || '') + letter.toUpperCase();
        });
    }

    // BƯỚC 6: FORMAT HỘI THOẠI (Chốt sổ sau khi Replace xong)
    text = applyDialogFormat(text);

    // BƯỚC 7: QUÉT DANH TỪ MỚI
    if(doRescan) extractPendingLore(text);

    // HIỂN THỊ
    const out = document.getElementById('processed-output');
    out.innerHTML = text; 
    
    document.getElementById('count-found').innerText = `Lore: ${stats.foundLore}`;
    document.getElementById('count-replace').innerText = `Replace: ${stats.replaceNormal}`;
    document.getElementById('count-caps').innerText = `Caps: ${stats.capsFixed}`;
    document.getElementById('output-word-count').innerText = `Words: ${countWords(out.innerText)}`;
}

function clearEditor() { 
    document.getElementById('raw-text').value = ''; 
    document.getElementById('processed-output').innerHTML = ''; 
    document.getElementById('input-word-count').innerText = 'Words: 0';
    document.getElementById('output-word-count').innerText = 'Words: 0';
    clearPendingLore();
}

function copyResult() { 
    const t = document.getElementById('processed-output').innerText; 
    if(t) { navigator.clipboard.writeText(t).then(() => { showNotif("Đã copy thành công!"); }); }
}

// --- SETTINGS (UI & REGEX) ---
function applySettingsToUI() {
    document.documentElement.style.setProperty('--editor-font-size', appData.settings.fontSize || '15px');
    document.documentElement.style.setProperty('--editor-font-family', appData.settings.fontFamily || "'Montserrat', sans-serif");
    document.getElementById('setting-size').value = appData.settings.fontSize || '15px';
    document.getElementById('setting-font').value = appData.settings.fontFamily || "'Montserrat', sans-serif";

    document.querySelectorAll(`[data-format]`).forEach(el => el.classList.remove('active'));
    const fCard = document.querySelector(`[data-format="${appData.settings.formatDialog}"]`);
    if(fCard) fCard.classList.add('active');

    document.querySelectorAll(`[data-caps]`).forEach(el => el.classList.remove('active'));
    const cCard = document.querySelector(`[data-caps="${appData.settings.capsRule}"]`);
    if(cCard) cCard.classList.add('active');

    document.querySelector(`input[name="regex-preset"][value="${appData.settings.regexPreset || 'chapter'}"]`).checked = true;
    document.getElementById('custom-regex-input').value = appData.settings.customRegex || '';
}

function applySettings() {
    appData.settings.fontSize = document.getElementById('setting-size').value;
    appData.settings.fontFamily = document.getElementById('setting-font').value;
    saveSettings(); applySettingsToUI();
}
function setSetting(key, val, el) { appData.settings[key] = val; saveSettings(); el.parentElement.querySelectorAll('.format-card').forEach(c => c.classList.remove('active')); el.classList.add('active'); }
function saveRegex() { appData.settings.regexPreset = document.querySelector('input[name="regex-preset"]:checked').value; appData.settings.customRegex = document.getElementById('custom-regex-input').value; saveSettings(); }
async function resetAllData() {
    if(confirm("XÓA SẠCH CÀI ĐẶT VÀ TỪ MỚI TRONG MÁY NÀY?")) {
        localStorage.removeItem(STORAGE_KEY);
        if(dbInstance) { dbInstance.close(); indexedDB.deleteDatabase(IDB_NAME).onsuccess = () => location.reload(); }
        else location.reload();
    }
}

// --- CHIA CHƯƠNG LOGIC (Giữ nguyên) ---
function processSplit() {
    const text = document.getElementById('split-input-text').value;
    if(!text) return;
    const mode = document.querySelector('input[name="split-type"]:checked').value;
    const wrapper = document.getElementById('split-outputs-wrapper');
    wrapper.innerHTML = ''; 
    let parts = [];
    if (mode === 'count') {
        const partsCount = parseInt(document.querySelector('.split-mode-btn.active').getAttribute('data-split'));
        const totalLen = text.length; const chunkLen = Math.ceil(totalLen / partsCount);
        let currentIdx = 0;
        for (let i = 0; i < partsCount; i++) {
            if (currentIdx >= totalLen) break;
            let endIdx = currentIdx + chunkLen;
            if (endIdx < totalLen) { let nextNewline = text.indexOf('\n', endIdx); if (nextNewline !== -1 && nextNewline - endIdx < 500) { endIdx = nextNewline + 1; } }
            parts.push({ title: `Phần ${i+1}`, content: text.substring(currentIdx, endIdx).trim() });
            currentIdx = endIdx;
        }
    } else if (mode === 'regex') {
        let regexPattern = '';
        if(appData.settings.regexPreset === 'chapter') regexPattern = '^(Chương|Chapter)\\s+\\d+.*?$';
        else if(appData.settings.regexPreset === 'book') regexPattern = '^(Hồi|Quyển)\\s+[\\dIVX]+.*?$';
        else regexPattern = appData.settings.customRegex;
        if(!regexPattern) return;
        try {
            const regex = new RegExp(regexPattern, 'gm'); let match; let indices = [];
            while ((match = regex.exec(text)) !== null) indices.push({ index: match.index, title: match[0].trim() });
            if(indices.length === 0) return;
            for (let i = 0; i < indices.length; i++) {
                let start = indices[i].index; let end = (i + 1 < indices.length) ? indices[i+1].index : text.length;
                parts.push({ title: indices[i].title, content: text.substring(start, end).trim() });
            }
        } catch(e) { return showNotif("Lỗi Regex: " + e.message, "error"); }
    }
    parts.forEach((p) => {
        const box = document.createElement('div'); box.className = 'split-box';
        box.innerHTML = `<div class="split-header"><span style="color:var(--primary);">${p.title}</span><span class="badge">Words: ${countWords(p.content)}</span></div><textarea class="custom-scrollbar" readonly>${p.content}</textarea><div class="split-footer"><button class="btn btn-success full-width" onclick="navigator.clipboard.writeText(this.parentElement.previousElementSibling.value); showNotif('Đã copy ${p.title}');">Copy Phần Này</button></div>`;
        wrapper.appendChild(box);
    });
}

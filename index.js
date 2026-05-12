// v1.0 - Initial Merge (aulapro + bigpro) - EditWithHg - 2026-05-12

// --- GLOBAL STATE ---
const STORAGE_KEY = 'editwithhg_data';
let appData = {
    settings: {
        fontSize: '15px',
        fontFamily: "'Montserrat', sans-serif",
        formatDialog: 0, // 0: Keep, 1: Inline, 2: Newline, 3: Dash
        capsRule: 0, // 0: Keep, 1: Lower, 2: TitleCase
        regexPreset: 'chapter',
        customRegex: ''
    },
    entities: [],
    relations: []
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.remove('loading');
    loadData();
    applySettingsToUI();
    
    // Auto-count input text
    document.getElementById('raw-text').addEventListener('input', function() {
        document.getElementById('input-word-count').innerText = `Words: ${countWords(this.value)}`;
    });
    document.getElementById('split-input-text').addEventListener('input', function() {
        document.getElementById('split-input-word-count').innerText = `Words: ${countWords(this.value)}`;
    });

    // Sub-settings navigation
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.setting-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.getAttribute('data-target')).classList.add('active');
        });
    });

    // Split buttons
    document.querySelectorAll('.split-mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.split-mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Split radio toggle
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

// --- CORE UTILS ---
function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try { appData = JSON.parse(raw); } catch(e) { console.error("Error parsing DB"); }
        if (!appData.settings) appData.settings = {};
        if (!appData.entities) appData.entities = [];
        if (!appData.relations) appData.relations = [];
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if(tabId === 'entities') renderEntityTable();
    if(tabId === 'relations') renderRelationTable();
}

function countWords(str) {
    return str.trim() ? str.trim().split(/\s+/).length : 0;
}

function showNotif(msg, type='success') {
    const container = document.getElementById('notification-container');
    const div = document.createElement('div');
    div.className = `notification ${type}`;
    div.innerText = msg;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// --- SETTINGS LOGIC ---
function applySettingsToUI() {
    // Font/Size
    document.documentElement.style.setProperty('--editor-font-size', appData.settings.fontSize || '15px');
    document.documentElement.style.setProperty('--editor-font-family', appData.settings.fontFamily || "'Montserrat', sans-serif");
    document.getElementById('setting-size').value = appData.settings.fontSize || '15px';
    document.getElementById('setting-font').value = appData.settings.fontFamily || "'Montserrat', sans-serif";

    // Format & Caps UI matching
    document.querySelectorAll(`[data-format]`).forEach(el => el.classList.remove('active'));
    const fCard = document.querySelector(`[data-format="${appData.settings.formatDialog}"]`);
    if(fCard) fCard.classList.add('active');

    document.querySelectorAll(`[data-caps]`).forEach(el => el.classList.remove('active'));
    const cCard = document.querySelector(`[data-caps="${appData.settings.capsRule}"]`);
    if(cCard) cCard.classList.add('active');

    // Regex UI matching
    document.querySelector(`input[name="regex-preset"][value="${appData.settings.regexPreset || 'chapter'}"]`).checked = true;
    document.getElementById('custom-regex-input').value = appData.settings.customRegex || '';
}

function applySettings() {
    appData.settings.fontSize = document.getElementById('setting-size').value;
    appData.settings.fontFamily = document.getElementById('setting-font').value;
    saveData();
    applySettingsToUI();
}

function setSetting(key, val, el) {
    appData.settings[key] = val;
    saveData();
    el.parentElement.querySelectorAll('.format-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
}

function saveRegex() {
    appData.settings.regexPreset = document.querySelector('input[name="regex-preset"]:checked').value;
    appData.settings.customRegex = document.getElementById('custom-regex-input').value;
    saveData();
}

function resetAllData() {
    if(confirm("BẠN CÓ CHẮC MUỐN XÓA TOÀN BỘ DỮ LIỆU? KHÔNG THỂ KHÔI PHỤC!")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}

// --- ENTITY LOGIC (LORE) ---
const typeMap = { 'character':'Nhân vật', 'location':'Địa danh', 'faction':'Thế lực' };

function renderEntityTable() {
    const tbody = document.getElementById('entity-list-body');
    const filterTxt = document.getElementById('search-entity').value.toLowerCase();
    const filterType = document.getElementById('filter-type').value;
    tbody.innerHTML = '';
    
    let count = 0;
    appData.entities.forEach(ent => {
        const aliasStr = ent.aliases.join(', ');
        if ((ent.name.toLowerCase().includes(filterTxt) || aliasStr.toLowerCase().includes(filterTxt)) && 
            (filterType === 'all' || ent.type === filterType)) {
            count++;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:#999;">${count}</td>
                <td style="font-weight:700; color:var(--primary)">${ent.name}</td>
                <td><span class="tag ${ent.type}">${typeMap[ent.type] || ent.type}</span></td>
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

function saveEntity() {
    const id = document.getElementById('ent-id').value;
    const name = document.getElementById('ent-name').value.trim();
    if(!name) return showNotif("Thiếu tên chuẩn!", "error");
    
    const ent = {
        id: id || 'ent-'+Date.now(),
        type: document.getElementById('ent-type').value,
        name: name,
        aliases: document.getElementById('ent-aliases').value.split(',').map(x=>x.trim()).filter(x=>x),
        notes: document.getElementById('ent-notes').value
    };
    
    if(id) {
        const idx = appData.entities.findIndex(x=>x.id===id);
        if(idx > -1) appData.entities[idx] = ent;
    } else {
        appData.entities.push(ent);
    }
    
    saveData(); 
    closeModal('modal-entity'); 
    renderEntityTable();
    showNotif("Đã lưu thực thể");
}

function deleteEntity(id){ 
    if(confirm("Xóa thực thể này?")){
        appData.entities = appData.entities.filter(x=>x.id!==id); 
        saveData(); 
        renderEntityTable();
    }
}

function editEntity(id){ 
    const e = appData.entities.find(x=>x.id===id); 
    if(!e) return;
    document.getElementById('ent-id').value = e.id; 
    document.getElementById('ent-name').value = e.name; 
    document.getElementById('ent-type').value = e.type; 
    document.getElementById('ent-aliases').value = e.aliases.join(', '); 
    document.getElementById('ent-notes').value = e.notes || ''; 
    openModal('modal-entity');
}

// --- RELATION LOGIC ---
function renderRelationTable() {
    const tbody = document.getElementById('relation-list-body');
    const term = document.getElementById('search-relation').value.toLowerCase();
    tbody.innerHTML = '';
    
    const getName = (val) => { const e = appData.entities.find(x=>x.id===val); return e ? e.name : val; };
    let count = 0;
    
    appData.relations.forEach(rel => {
        const n1 = getName(rel.from); 
        const n2 = getName(rel.to);
        if(!term || n1.toLowerCase().includes(term) || n2.toLowerCase().includes(term) || rel.type.toLowerCase().includes(term)) {
            count++;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:#999;">${count}</td>
                <td style="font-weight:600;">${n1}</td>
                <td><span style="color:#2563eb; font-weight:600;">⎯ ${rel.type} ➝</span></td>
                <td style="font-weight:600;">${n2}</td>
                <td>
                    <button class="icon-btn" style="color:#ef4444" onclick="deleteRelation('${rel.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function saveRelation(){
    const from = document.getElementById('rel-from').value;
    const to = document.getElementById('rel-to').value;
    const type = document.getElementById('rel-type').value;
    if(!from || !to || !type) return showNotif("Vui lòng điền đủ thông tin", "error");

    appData.relations.push({
        id: 'rel-'+Date.now(),
        from, to, type
    });
    
    saveData(); 
    closeModal('modal-relation'); 
    renderRelationTable();
}

function openRelationModal(){ 
    if(appData.entities.length < 2) return showNotif("Cần ít nhất 2 thực thể để tạo quan hệ", "error");
    const opts = appData.entities.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
    document.getElementById('rel-from').innerHTML = opts; 
    document.getElementById('rel-to').innerHTML = opts;
    document.getElementById('rel-type').value = '';
    openModal('modal-relation');
}

function deleteRelation(id){
    if(confirm("Xóa quan hệ này?")){
        appData.relations = appData.relations.filter(x=>x.id!==id); 
        saveData(); 
        renderRelationTable();
    }
}

// --- REPLACE PIPELINE LOGIC ---
function processText() {
    let text = document.getElementById('raw-text').value;
    if(!text.trim()) return;

    let stats = { foundLore: 0, replaceNormal: 0, capsFixed: 0 };

    // 1. CHUẨN HÓA HỘI THOẠI (Từ aulapro)
    const formatMode = appData.settings.formatDialog;
    if (formatMode > 0) {
        text = text.replace(/:\s*([“"-].*?[”"]?)/g, (match, p1) => {
            if (formatMode === 1) return `: ${p1}`; // Cùng dòng
            if (formatMode === 2) return `:\n\n${p1}`; // Xuống dòng
            if (formatMode === 3) return `:\n\n- ${p1.replace(/^["“]+|["”]+$/g, '')}`; // Gạch đầu dòng
            return match;
        });
    }

    // 2. XỬ LÝ VIẾT HOA BẤT THƯỜNG (Từ aulapro)
    const capsMode = appData.settings.capsRule;
    if (capsMode > 0) {
        text = text.replace(/(?<=[a-zà-ỹ]\s+)([A-ZÀ-Ỹ][a-zà-ỹ]+)/g, (match) => {
            stats.capsFixed++;
            if (capsMode === 1) return match.toLowerCase();
            if (capsMode === 2) return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase(); // Giữ title case
            return match;
        });
    }

    // 3. THAY THẾ TỪ ĐIỂN THỰC THỂ LORE (Từ bigpro)
    // Tương lai: Sẽ fetch dict.json ở đây. Hiện tại dùng appData.entities
    let keywords = []; 
    let map = {};
    appData.entities.forEach(e => {
        map[e.name] = { t: e.name, type: 'main' }; 
        keywords.push(e.name);
        e.aliases.forEach(a => { 
            map[a] = { t: e.name, type: 'alias' }; 
            keywords.push(a); 
        });
    });
    
    // Sort longest first
    keywords.sort((a,b) => b.length - a.length);
    
    if (keywords.length > 0) {
        const pattern = new RegExp(`(${keywords.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
        text = text.replace(pattern, (m) => {
            const d = map[m];
            if(d.type === 'alias'){ 
                stats.replaceNormal++; 
                return `<span class="hl-replaced">${d.t}</span>`; 
            } else { 
                stats.foundLore++; 
                return `<span class="hl-found">${m}</span>`; 
            }
        });
    }

    // Output rendering
    const out = document.getElementById('processed-output');
    out.innerHTML = text; // Because it contains HTML spans
    
    // Update Badges
    document.getElementById('count-found').innerText = `Lore: ${stats.foundLore}`;
    document.getElementById('count-replace').innerText = `Replace: ${stats.replaceNormal}`;
    document.getElementById('count-caps').innerText = `Auto-Caps: ${stats.capsFixed}`;
    document.getElementById('output-word-count').innerText = `Words: ${countWords(out.innerText)}`;
}

function clearEditor() { 
    document.getElementById('raw-text').value = ''; 
    document.getElementById('processed-output').innerHTML = ''; 
    document.getElementById('input-word-count').innerText = 'Words: 0';
    document.getElementById('output-word-count').innerText = 'Words: 0';
    ['found', 'replace', 'caps'].forEach(x => document.getElementById(`count-${x}`).innerText = x === 'found' ? 'Lore: 0' : (x==='replace'?'Replace: 0':'Auto-Caps: 0')); 
}

function copyResult() { 
    const t = document.getElementById('processed-output').innerText; 
    if(t) {
        navigator.clipboard.writeText(t).then(() => { 
            showNotif("Đã copy thành công!");
        }); 
    }
}

// --- SPLIT CHƯƠNG LOGIC (Từ aulapro) ---
function processSplit() {
    const text = document.getElementById('split-input-text').value;
    if(!text) return showNotif("Không có văn bản để chia", "error");

    const mode = document.querySelector('input[name="split-type"]:checked').value;
    const wrapper = document.getElementById('split-outputs-wrapper');
    wrapper.innerHTML = ''; // Clear old

    let parts = [];

    if (mode === 'count') {
        const partsCount = parseInt(document.querySelector('.split-mode-btn.active').getAttribute('data-split'));
        const totalLen = text.length;
        const chunkLen = Math.ceil(totalLen / partsCount);
        
        let currentIdx = 0;
        for (let i = 0; i < partsCount; i++) {
            if (currentIdx >= totalLen) break;
            let endIdx = currentIdx + chunkLen;
            if (endIdx < totalLen) {
                // Find next newline to avoid splitting words
                let nextNewline = text.indexOf('\n', endIdx);
                if (nextNewline !== -1 && nextNewline - endIdx < 500) {
                    endIdx = nextNewline + 1;
                }
            }
            parts.push({ title: `Phần ${i+1}`, content: text.substring(currentIdx, endIdx).trim() });
            currentIdx = endIdx;
        }
    } else if (mode === 'regex') {
        let regexPattern = '';
        if(appData.settings.regexPreset === 'chapter') regexPattern = '^(Chương|Chapter)\\s+\\d+.*?$';
        else if(appData.settings.regexPreset === 'book') regexPattern = '^(Hồi|Quyển)\\s+[\\dIVX]+.*?$';
        else regexPattern = appData.settings.customRegex;

        if(!regexPattern) return showNotif("Regex không hợp lệ", "error");

        try {
            const regex = new RegExp(regexPattern, 'gm');
            let match;
            let indices = [];
            while ((match = regex.exec(text)) !== null) {
                indices.push({ index: match.index, title: match[0].trim() });
            }

            if(indices.length === 0) return showNotif("Không tìm thấy chương nào theo mẫu Regex", "error");

            for (let i = 0; i < indices.length; i++) {
                let start = indices[i].index;
                let end = (i + 1 < indices.length) ? indices[i+1].index : text.length;
                parts.push({
                    title: indices[i].title,
                    content: text.substring(start, end).trim()
                });
            }
        } catch(e) {
            return showNotif("Lỗi Regex: " + e.message, "error");
        }
    }

    // Render output boxes
    parts.forEach((p, idx) => {
        const box = document.createElement('div');
        box.className = 'split-box';
        box.innerHTML = `
            <div class="split-header">
                <span style="color:var(--primary);">${p.title}</span>
                <span class="badge">Words: ${countWords(p.content)}</span>
            </div>
            <textarea class="custom-scrollbar" readonly>${p.content}</textarea>
            <div class="split-footer">
                <button class="btn btn-success full-width" onclick="navigator.clipboard.writeText(this.parentElement.previousElementSibling.value); showNotif('Đã copy ${p.title}');">Copy Phần Này</button>
            </div>
        `;
        wrapper.appendChild(box);
    });
    showNotif(`Đã chia thành ${parts.length} phần`);
}

// --- MODAL UTILS ---
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ==========================================
// CONFIGURATION 
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrpdjWxB68KvFRbhMw3NtddrvkkiWZXWyWgvQGJB87Wfsgl_mJXVX6ywM0S0Bvzq8L/exec"; // <-- PASTE YOUR URL HERE

let currentUser = null;
let appDropdowns = {};

const screens = { login: document.getElementById('login-screen'), app: document.getElementById('app-screen') };
const toastEl = document.getElementById('toast');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const moduleCards = document.querySelectorAll('.module-card');

function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    toastEl.style.display = 'block';
    setTimeout(() => toastEl.style.transform = 'translateY(-10px)', 10);
    setTimeout(() => { toastEl.style.transform = 'translateY(100%)'; setTimeout(() => toastEl.className = 'toast hidden', 300); }, 3000);
}

function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

async function apiCall(action, data = {}) {
    const payload = { action, ...data };
    try {
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        return await response.json();
    } catch (error) { return { status: 'error', message: 'Network error.' }; }
}

// --- AUTHENTICATION ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');

    btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Authenticating..."; btn.disabled = true;
    const res = await apiCall('login', { email, password });

    if (res.status === 'success') {
        currentUser = res.user;
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-role').textContent = currentUser.role;
        applyRolePermissions();
        await loadDropdowns();
        switchScreen('app');
        showToast(`Welcome back, ${currentUser.name}!`);
        loginForm.reset();
    } else { showToast(res.message, 'error'); }
    btn.innerHTML = "<span>Login</span><i class='bx bx-right-arrow-alt'></i>"; btn.disabled = false;
});

logoutBtn.addEventListener('click', () => { currentUser = null; switchScreen('login'); showToast("Logged out."); });

function applyRolePermissions() {
    const adminCards = document.querySelectorAll('.admin-only');
    if (currentUser.role === 'Admin' || currentUser.role === 'Manager') { adminCards.forEach(card => card.style.display = 'flex'); } 
    else { adminCards.forEach(card => card.style.display = 'none'); }
}

// --- DROPDOWNS & FORMS ---
async function loadDropdowns() {
    const res = await apiCall('getDropdowns');
    if (res.status === 'success') { appDropdowns = res.data; populateAllSelectElements(); } 
    else { showToast("Failed to load component lists.", 'error'); }
}

function populateAllSelectElements() {
    document.querySelectorAll('select:not(.view-filter)').forEach(select => {
        const headerName = select.getAttribute('name');
        if (appDropdowns[headerName]) {
            const defaultOption = '<option value="">Select...</option>';
            const optionsHtml = appDropdowns[headerName].map(val => `<option value="${val}">${val}</option>`).join('');
            select.innerHTML = defaultOption + optionsHtml;
        }
    });
}

moduleCards.forEach(card => {
    card.addEventListener('click', () => {
        moduleCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        document.querySelectorAll('.data-form').forEach(f => f.classList.remove('active-form'));
        document.getElementById(card.getAttribute('data-target')).classList.add('active-form');
    });
});

document.querySelectorAll('form.modern-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sectionName = form.id.replace('form-', '');
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        submitBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Saving..."; submitBtn.disabled = true;
        
        const formData = new FormData(form);
        const res = await apiCall('submitData', { section: sectionName, data: Object.fromEntries(formData.entries()), user: currentUser });

        if (res.status === 'success') {
            showToast(res.message);
            form.reset();
            if (sectionName === 'WINDING' && res.batchCode) {
                document.getElementById('display-batch-code').textContent = res.batchCode;
                if (appDropdowns['Product_Batch Code']) { appDropdowns['Product_Batch Code'].push(res.batchCode); populateAllSelectElements(); }
            }
        } else { showToast(res.message, 'error'); }
        submitBtn.innerHTML = originalBtnText; submitBtn.disabled = false;
    });
});

// --- ADMIN DATA VIEW ---
const sheetSelector = document.getElementById('view-sheet-selector');
document.querySelector('[data-target="audit-view"]').addEventListener('click', () => loadAdminTable(sheetSelector.value));
sheetSelector.addEventListener('change', (e) => loadAdminTable(e.target.value));

async function loadAdminTable(sheetName) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;"><i class="bx bx-loader-alt bx-spin"></i> Loading...</td></tr>';
    
    const res = await apiCall('getViewData', { sheetName: sheetName });
    if (res.status === 'success') {
        document.getElementById('table-headers').innerHTML = res.headers.map(h => `<th>${h}</th>`).join('') + '<th>ACTIONS</th>';
        if (res.data.length === 0) { tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No recent data found.</td></tr>`; return; }
        
        tableBody.innerHTML = res.data.map(row => {
            const rowCells = res.headers.map(h => `<td>${row[h] || ''}</td>`).join('');
            const btn = `<td><button class="btn-danger" onclick='deleteRow(${row._rowIndex}, "${sheetName}", ${JSON.stringify(row).replace(/'/g, "&apos;")})'><i class='bx bx-trash'></i> Delete</button></td>`;
            return `<tr>${rowCells}${btn}</tr>`;
        }).join('');
    } else { showToast(res.message, 'error'); tableBody.innerHTML = ''; }
}

window.deleteRow = async function(rowIndex, sheetName, recordDetails) {
    if(!confirm('Are you sure you want to delete this record? This action will be logged.')) return;
    showToast("Deleting record...");
    const res = await apiCall('deleteRecord', { sheetName: sheetName, rowIndex: rowIndex, recordDetails: recordDetails, user: currentUser });
    if (res.status === 'success') { showToast(res.message); loadAdminTable(sheetName); } 
    else { showToast(res.message, 'error'); }
};

// --- SERVICE WORKER REGISTRATION (PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); });
}

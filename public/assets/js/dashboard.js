import { apiFetch, isLoggedIn, clearToken } from './api.js';

// ── Auth guard ────────────────────────────────────────────────────────────────
if (!isLoggedIn()) location.replace('./login.html');

// ── Show username ─────────────────────────────────────────────────────────────
const username = localStorage.getItem('admin_username') || 'Admin';
document.getElementById('navUser').textContent = username;
document.getElementById('avatarInitial').textContent = username[0].toUpperCase();

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    location.replace('./login.html');
});

// ── Load calls ────────────────────────────────────────────────────────────────
async function loadCalls(query = '') {
    document.getElementById('tableBody').innerHTML = '<div class="loader">Loading…</div>';
    try {
        const data = await apiFetch(`/api/calls${query}`);
        window._currentCalls = data;
        renderTable(data);
        renderStats(data);

    } catch (err) {
        if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
            clearToken(); location.replace('./login.html');
        }
        document.getElementById('tableBody').innerHTML =
            `<div class="empty">⚠️ ${err.message}</div>`;
    }
}

function applyFilter() {
    const filter = document.getElementById('dateFilter') ? document.getElementById('dateFilter').value : 'all';

    let query = '';
    const now = new Date();

    if (filter !== 'all') {
        let startDate, endDate;

        switch (filter) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'yesterday':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'this_week':
                const dayOfWeek = now.getDay();
                const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
                startDate = new Date(now.setDate(diff));
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last_3_months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                break;
            case 'this_year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
        }

        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());

        query = `?${params.toString()}`;
    }

    loadCalls(query);
}

if (document.getElementById('dateFilter')) {
    document.getElementById('dateFilter').addEventListener('change', applyFilter);
}

if (document.getElementById('exportBtn')) {
    document.getElementById('exportBtn').addEventListener('click', () => {
        const calls = window._currentCalls || [];
        if (!calls.length) {
            alert('No data to export.');
            return;
        }

        // Map data to array of objects for Excel
        const excelData = calls.map(c => {
            const d = new Date(c.updatedAt || c.createdAt || c.timestamp || Date.now());
            const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return {
                "Phone Number (Caller)": c.incomingNumber || c.phoneNumber || 'Unknown',
                "Service Name": c.serviceName || 'Unknown',
                "Receiving Number": c.receivingNumber || '',
                "Count": c.count || 1,
                "Last Call Date": date,
                "Last Call Time": time
            };
        });

        // Create workbook and worksheet using SheetJS
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Rejected Calls");

        // Download file
        const filterName = document.getElementById('dateFilter') ? document.getElementById('dateFilter').value : 'all';
        XLSX.writeFile(workbook, `auto_rejected_calls_${filterName}.xlsx`);
    });
}

function renderTable(calls) {
    document.getElementById('countBadge').textContent = calls.length;
    if (!calls.length) {
        document.getElementById('tableBody').innerHTML =
            '<div class="empty">📭 No auto-rejected calls yet</div>';
        return;
    }

    if (!document.getElementById('swal-script')) {
        const script = document.createElement('script');
        script.id = 'swal-script';
        script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
        document.head.appendChild(script);
    }

    window._currentCalls = calls;

    const rows = calls.map((c, index) => {
        const d = new Date(c.updatedAt || c.createdAt || c.timestamp || Date.now());
        const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return `<tr>
          <td class="col-number">
             ${c.incomingNumber || c.phoneNumber || '—'}
          </td>
          <td class="col-number" style="font-weight: 500;">
             ${c.serviceName || 'Unknown'} 
             <div style="font-size:11px; color:var(--muted); font-weight:normal">${c.receivingNumber || ''}</div>
          </td>
          <td>
             <span style="background:var(--accent-lt);color:var(--accent);padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;">
                 ${c.count || 1}
             </span>
          </td>
          <td>
             <div onclick="showHistory(${index})" style="cursor:pointer; padding:6px; border-radius:6px; background:var(--bg-light); display:inline-block; border:1px solid var(--border-color); transition: border-color 0.2s;" title="Click to view all timestamps">
                 <span style="color:var(--text-main); font-weight:500;">${date}</span>
                 <span style="color:var(--muted);font-size:12px; margin-left:6px;">@ ${time}</span>
                 <span style="font-size:10px; margin-left:6px; color:var(--accent);">👇 View All</span>
             </div>
          </td>
        </tr>`;
    }).join('');

    document.getElementById('tableBody').innerHTML = `
      <table style="table-layout: fixed; width: 100%;">
        <thead><tr>
          <th style="width: 25%">Phone Number (Caller)</th>
          <th style="width: 30%">Service Name</th>
          <th style="width: 15%">Count</th>
          <th style="width: 30%">Timestamp (Recent)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
}

window.showHistory = function (index) {
    if (!window._currentCalls || !window._currentCalls[index]) return;
    const call = window._currentCalls[index];

    const times = (call.timestamps || [])
        .map(t => new Date(t))
        .sort((a, b) => b - a);

    let html = `<div style="max-height: 300px; overflow-y: auto; text-align: left; padding: 10px;">`;

    if (times.length === 0) {
        html += `<p style="color: #666; text-align:center;">No history available</p>`;
    } else {
        times.forEach((d, i) => {
            const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            html += `
                <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #666; font-size: 13px;">Call #${times.length - i}</span>
                    <div>
                        <span style="font-weight: 500; color: #333;">${date}</span>
                        <span style="color: #888; font-size: 12px; margin-left: 8px;">${time}</span>
                    </div>
                </div>
            `;
        });
    }
    html += `</div>`;

    if (window.Swal) {
        Swal.fire({
            title: `History for ${call.incomingNumber || 'Caller'}`,
            html: html,
            showCloseButton: true,
            confirmButtonText: 'Close',
            confirmButtonColor: '#6C63FF',
            width: '450px'
        });
    } else {
        alert("Loading viewer... Please try again in a second.");
    }
}

function renderStats(calls) {
    const today = new Date().toDateString();
    // Sum all individual calls using count
    const totalCalls = calls.reduce((sum, c) => sum + (c.count || 1), 0);
    const todayCalls = calls
        .filter(c => new Date(c.updatedAt || c.createdAt || c.timestamp).toDateString() === today)
        .reduce((sum, c) => sum + (c.count || 1), 0);

    document.getElementById('statTotal').textContent = totalCalls;
    document.getElementById('statToday').textContent = todayCalls;
    // unique pairs are essentially the length of the calls array
    document.getElementById('statUnique').textContent = calls.length;
}

document.getElementById('refreshBtn').addEventListener('click', loadCalls);

// ── Add User Modal ────────────────────────────────────────────────────────────
const modal = document.getElementById('addUserModal');
const openBtn = document.getElementById('openAddUserBtn');
const closeBtn = document.getElementById('closeModalBtn');
const addUserForm = document.getElementById('addUserForm');
const modalError = document.getElementById('modalError');
const modalSuccess = document.getElementById('modalSuccess');
const submitBtn = document.getElementById('addUserSubmit');
const serviceNameInput = document.getElementById('serviceName');
const phoneNumberInput = document.getElementById('phoneNumber');
const pwdPreview = document.getElementById('generatedPassword');

// password = first 4 chars of service name + last 3 digits of phone
function buildPassword(service, phone) {
    const prefix = service.trim().replace(/\s+/g, '').slice(0, 4).toLowerCase();
    const suffix = phone.replace(/\D/g, '').slice(-3);
    return prefix && suffix ? `${prefix}${suffix}` : '';
}

function updatePreview() {
    pwdPreview.value = buildPassword(serviceNameInput.value, phoneNumberInput.value);
}
serviceNameInput.addEventListener('input', updatePreview);
phoneNumberInput.addEventListener('input', updatePreview);

function openModal() { modal.classList.add('open'); addUserForm.reset(); pwdPreview.value = ''; hideAlerts(); }
function closeModal() { modal.classList.remove('open'); }
function hideAlerts() { modalError.style.display = 'none'; modalSuccess.style.display = 'none'; }
function showError(msg) { modalError.textContent = msg; modalError.style.display = 'block'; modalSuccess.style.display = 'none'; }
function showSuccess(msg) { modalSuccess.textContent = msg; modalSuccess.style.display = 'block'; modalError.style.display = 'none'; }

openBtn.addEventListener('click', openModal);
closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const serviceName = serviceNameInput.value.trim();
    const phoneNumber = phoneNumberInput.value.trim();
    const password = buildPassword(serviceName, phoneNumber);

    hideAlerts();
    if (!password) { showError('Fill in both Service Name and Phone Number.'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';
    try {
        await apiFetch('/api/users', {
            method: 'POST',
            body: JSON.stringify({ serviceName, phoneNumber, password }),
        });
        showSuccess(`✅ "${serviceName}" created!  Password: ${password}`);
        addUserForm.reset();
        pwdPreview.value = '';
    } catch (err) {
        showError(err.message || 'Failed to create user.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create User';
    }
});

// ── Initial load + auto-refresh ───────────────────────────────────────────────
applyFilter();
setInterval(applyFilter, 30_000);

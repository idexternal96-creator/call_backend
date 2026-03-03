import { apiFetch, setToken, isLoggedIn } from './api.js';

// Already logged in? Go straight to dashboard
if (isLoggedIn()) location.replace('../index.html');

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    const spinner = document.getElementById('spinner');
    const btnText = document.getElementById('btnText');
    const errorBox = document.getElementById('errorBox');

    // Loading state
    btn.disabled = true;
    spinner.style.display = 'block';
    btnText.style.display = 'none';
    errorBox.style.display = 'none';

    try {
        const data = await apiFetch('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        setToken(data.token);
        localStorage.setItem('admin_username', data.username);
        location.replace('../index.html');
    } catch (err) {
        errorBox.textContent = err.message || 'Login failed. Please try again.';
        errorBox.style.display = 'block';
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.style.display = 'block';
    }
});

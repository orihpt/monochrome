
import { MusicAPI } from './music-api.js';

export const initAuthModal = () => {
    const modal = document.getElementById('waves-music-auth-modal');
    const form = document.getElementById('waves-music-auth-form');
    const errorEl = document.getElementById('waves-music-auth-error');
    const submitBtn = form.querySelector('button');
    const spinner = submitBtn.querySelector('.spinner');
    const btnText = submitBtn.querySelector('span');

    // Check if user is already authenticated
    const savedUser = localStorage.getItem('subsonic_user');
    const savedPass = localStorage.getItem('subsonic_pass');

    if (savedUser && savedPass) {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        // Pre-fill for dev convenience
        document.getElementById('waves-music-auth-username').value = 'admin';
        document.getElementById('waves-music-auth-password').value = 'N3verGuESSTHIS';
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        console.log('Waves Music Auth: Submit started');
        const username = document.getElementById('waves-music-auth-username').value;
        const password = document.getElementById('waves-music-auth-password').value;

        errorEl.style.display = 'none';
        submitBtn.disabled = true;
        spinner.style.display = 'block';
        btnText.style.opacity = '0.5';

        try {
            console.log('Waves Music Auth: Testing connection...');
            const api = MusicAPI.instance.subsonicAPI;
            api.user = username;
            api.password = password;

            const response = await api.fetchAPI('ping');
            console.log('Waves Music Auth: Response received', response);
            if (response && response.status === 'ok') {
                // Success! Save credentials
                localStorage.setItem('subsonic_user', username);
                localStorage.setItem('subsonic_pass', password);
                
                modal.style.animation = 'fadeIn 0.3s ease-out reverse';
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
                
                // Refresh data
                window.location.reload();
            } else {
                throw new Error(response?.error?.message || 'Invalid credentials');
            }
        } catch (err) {
            errorEl.textContent = err.message || 'Authentication failed. Please check your credentials and ensure Navidrome is running.';
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            spinner.style.display = 'none';
            btnText.style.opacity = '1';
        }
    };
};

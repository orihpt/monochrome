// js/accounts/auth.js
import { auth } from './config.js';

export class AuthManager {
    constructor() {
        this.user = null;
        this.authListeners = [];
        this.init().catch(console.error);
    }

    async init() {
        const params = new URLSearchParams(window.location.search);
        const userId = params.get('userId');
        const secret = params.get('secret');
        const isOAuthRedirect = params.get('oauth') === '1';

        if (userId && secret && userId !== 'null' && secret !== 'null') {
            if (window.location.pathname !== '/reset-password') {
                try {
                    await auth.createSession(userId, secret);
                    window.history.replaceState({}, '', window.location.pathname);
                } catch (error) {
                    console.warn('OAuth session handoff failed:', error.message);
                    window.history.replaceState({}, '', window.location.pathname);
                }
            }
        } else if (isOAuthRedirect) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            window.history.replaceState({}, '', window.location.pathname);
        }

        try {
            this.user = await auth.get();
            this.updateUI(this.user);
            this.authListeners.forEach((listener) => listener(this.user));
        } catch {
            this.user = null;
            this.updateUI(null);
        }
    }

    onAuthStateChanged(callback) {
        this.authListeners.push(callback);
        // If we already have a user state, trigger immediately
        if (this.user !== null) {
            callback(this.user);
        }
    }

    async signInWithGoogle() {
        this.showExternalAuthDisabled();
    }

    async signInWithGitHub() {
        this.showExternalAuthDisabled();
    }

    async signInWithSpotify() {
        this.showExternalAuthDisabled();
    }

    async signInWithDiscord() {
        this.showExternalAuthDisabled();
    }

    async signInWithEmail(email, password) {
        try {
            await auth.createEmailPasswordSession(email, password);
            this.user = await auth.get();
            this.updateUI(this.user);
            this.authListeners.forEach((listener) => listener(this.user));
            return this.user;
        } catch (error) {
            console.error('Email Login failed:', error);
            alert(`Login failed: ${error.message}`);
            throw error;
        }
    }

    async signUpWithEmail(email, password) {
        try {
            await auth.create('unique()', email, password);
            await auth.createEmailPasswordSession(email, password);
            this.user = await auth.get();
            this.updateUI(this.user);
            this.authListeners.forEach((listener) => listener(this.user));
            return this.user;
        } catch (error) {
            console.error('Sign Up failed:', error);
            alert(`Sign Up failed: ${error.message}`);
            throw error;
        }
    }

    async sendPasswordReset(email) {
        throw new Error('Password reset is disabled in offline mode.');
    }

    showExternalAuthDisabled() {
        alert('External sign-in is disabled. Use your local Waves Music account.');
    }

    async resetPassword(userId, secret, password, confirmPassword) {
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }
        try {
            await auth.updateRecovery(userId, secret, password, password);
        } catch (error) {
            console.error('Password reset failed:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await auth.deleteSession('current');
            this.user = null;
            this.updateUI(null);
            this.authListeners.forEach((listener) => listener(null));

            if (window.__AUTH_GATE__) {
                window.location.href = '/login';
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error('Logout failed:', error);
            throw error;
        }
    }

    updateUI(user) {
        const connectBtn = document.getElementById('auth-connect-btn');
        const clearDataBtn = document.getElementById('auth-clear-cloud-btn');
        const statusText = document.getElementById('auth-status');
        const emailContainer = document.getElementById('email-auth-container');
        const emailToggleBtn = document.getElementById('toggle-email-auth-btn');
        const githubBtn = document.getElementById('auth-github-btn');
        const discordBtn = document.getElementById('auth-discord-btn');
        const subsonicUser = localStorage.getItem('subsonic_user');

        if (subsonicUser) {
            if (statusText) statusText.textContent = `Signed in as ${subsonicUser}`;
            if (githubBtn) githubBtn.style.display = 'none';
            if (discordBtn) discordBtn.style.display = 'none';
            if (emailToggleBtn) emailToggleBtn.style.display = 'none';
            const description = document.querySelector('.account-description');
            if (description) description.textContent = 'You are signed in to your local music ecosystem.';
            return;
        }

        if (!connectBtn) return;

        if (window.__AUTH_GATE__) {
            connectBtn.textContent = 'Sign Out';
            connectBtn.classList.add('danger');
            connectBtn.onclick = () => this.signOut();
            if (clearDataBtn) clearDataBtn.style.display = 'none';
            if (emailContainer) emailContainer.style.display = 'none';
            if (emailToggleBtn) emailToggleBtn.style.display = 'none';
            if (githubBtn) githubBtn.style.display = 'none';
            if (discordBtn) discordBtn.style.display = 'none';
            if (statusText) statusText.textContent = user ? `Signed in as ${user.email}` : 'Signed in';

            const accountPage = document.getElementById('page-account');
            if (accountPage) {
                const title = accountPage.querySelector('.section-title');
                if (title) title.textContent = 'Account';
                accountPage.querySelectorAll('.account-content > p, .account-content > div').forEach((el) => {
                    if (el.id !== 'auth-status' && el.id !== 'auth-buttons-container') {
                        el.style.display = 'none';
                    }
                });
            }

            const customDbBtn = document.getElementById('custom-db-btn');
            if (customDbBtn) {
                const pbFromEnv = !!window.__POCKETBASE_URL__;
                if (pbFromEnv) {
                    const settingItem = customDbBtn.closest('.setting-item');
                    if (settingItem) settingItem.style.display = 'none';
                }
            }

            return;
        }

        if (user) {
            connectBtn.textContent = 'Sign Out';
            connectBtn.classList.add('danger');
            connectBtn.onclick = () => this.signOut();

            if (clearDataBtn) clearDataBtn.style.display = 'block';
            if (emailContainer) emailContainer.style.display = 'none';
            if (emailToggleBtn) emailToggleBtn.style.display = 'none';
            if (githubBtn) githubBtn.style.display = 'none';
            if (discordBtn) discordBtn.style.display = 'none';
            if (statusText) statusText.textContent = `Signed in as ${user.email}`;
        } else {
            connectBtn.textContent = 'Local account required';
            connectBtn.classList.remove('danger');
            connectBtn.onclick = () => this.showExternalAuthDisabled();

            if (clearDataBtn) clearDataBtn.style.display = 'none';
            if (emailToggleBtn) emailToggleBtn.style.display = 'none';
            if (githubBtn) {
                githubBtn.style.display = 'none';
            }
            if (discordBtn) {
                discordBtn.style.display = 'none';
            }
            if (statusText) statusText.textContent = 'Sign in with your local music server account.';
        }
    }
}

export const authManager = new AuthManager();

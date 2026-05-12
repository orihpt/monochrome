import { db } from './db.js';

export const syncManager = {
    _syncTimeout: null,

    async fetchSyncData() {
        const response = await fetch('/api/user/sync');
        if (response.status === 401) return null; // Not logged in
        if (!response.ok) throw new Error('Failed to fetch sync data');
        return await response.json();
    },

    async pushSyncData(data, timestamp) {
        const response = await fetch('/api/user/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userData: JSON.stringify(data),
                userDataUpdatedAt: timestamp,
            }),
        });
        if (!response.ok) throw new Error('Failed to push sync data');
        return await response.json();
    },

    async sync() {
        try {
            const serverResponse = await this.fetchSyncData();
            if (!serverResponse) return;

            const localTimestamp = parseInt(localStorage.getItem('user_data_updated_at') || '0');
            const serverTimestamp = serverResponse.userDataUpdatedAt ? new Date(serverResponse.userDataUpdatedAt).getTime() : 0;

            console.log(`Sync check: Local=${localTimestamp}, Server=${serverTimestamp}`);

            if (serverTimestamp > localTimestamp) {
                console.log('Server data is newer, importing...');
                if (serverResponse.userData) {
                    try {
                        const parsedData = JSON.parse(serverResponse.userData);
                        await db.importData(parsedData, true);
                        localStorage.setItem('user_data_updated_at', serverTimestamp.toString());
                        
                        // Notify UI
                        window.dispatchEvent(new CustomEvent('favorites-changed'));
                        window.dispatchEvent(new CustomEvent('playlist-tracks-changed'));
                        window.dispatchEvent(new CustomEvent('sync-complete'));
                    } catch (e) {
                        console.error('Failed to parse server user data:', e);
                    }
                }
            } else if (localTimestamp > serverTimestamp) {
                console.log('Local data is newer, pushing...');
                const localData = await db.exportData();
                
                // Only push if we actually have data (avoid pushing empty state if import failed or something)
                const hasData = Object.values(localData).some(val => Array.isArray(val) && val.length > 0);
                if (hasData) {
                    await this.pushSyncData(localData, new Date(localTimestamp).toISOString());
                }
            } else {
                console.log('Sync: already up to date');
            }
        } catch (error) {
            console.error('Sync error:', error);
        }
    },

    triggerChange() {
        const now = Date.now();
        localStorage.setItem('user_data_updated_at', now.toString());
        
        if (this._syncTimeout) clearTimeout(this._syncTimeout);
        this._syncTimeout = setTimeout(() => this.sync(), 3000);
    },

    initialize() {
        // Listen for changes that should trigger a sync
        window.addEventListener('favorites-changed', () => this.triggerChange());
        window.addEventListener('playlist-tracks-changed', () => this.triggerChange());
        window.addEventListener('sync-playlist-change', () => this.triggerChange());
        
        // Initial sync
        this.sync();
        
        // Periodical sync every 5 minutes
        setInterval(() => this.sync(), 5 * 60 * 1000);
    },

    // Compatibility methods for existing code
    async getPublicPlaylist() { return null; },
    async syncUserFolder() {},
    async publishPlaylist() {},
    async unpublishPlaylist() {},
    async syncUserPlaylist() {},
    async getPublicPlaylist() { return null; },
};

export default syncManager;

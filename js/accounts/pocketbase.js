// js/accounts/pocketbase.js
// Neutralized for offline-first local media ecosystem - all PocketBase sync disabled

export const syncManager = {
    pb: {
        collection: () => ({
            getList: async () => ({ items: [] }),
            getOne: async () => null,
            create: async () => ({}),
            update: async () => ({}),
            delete: async () => ({}),
            subscribe: () => () => {},
            unsubscribe: async () => {},
        }),
        authStore: { isValid: false, token: '' },
    },

    async _getUserRecord() { return null; },
    async getUserData() { return null; },
    async updateProfile() {},
    async getProfile() { return null; },
    async isUsernameTaken() { return false; },
    async syncUserPlaylist() {},
    async publishPlaylist() {},
    async unpublishPlaylist() {},
    async getPublicPlaylist() { return null; },
    async syncUserFolder() {},
    async syncHistoryItem() {},
    async syncLibraryItem() {},
    _minifyItem(type, item) { return item; },
    async listenForUpdates() {},
    async stopListening() {},
    async getThemes() { return []; },
    safeParseInternal(val, _key, fallback) {
        if (!val) return fallback;
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return fallback; }
        }
        return val;
    },
};

export const pb = syncManager.pb;
export default syncManager;

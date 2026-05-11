import { db } from './db.js';
import { MusicAPI } from './music-api.js';

export const syncManager = {
    _syncTimeout: null,
    _disabled: false,
    _playlistSyncInFlight: new Set(),

    _pendingDeleteKey() {
        return `waves_pending_playlist_deletes:${localStorage.getItem('subsonic_user') || 'anonymous'}`;
    },

    _readPendingDeletes() {
        try {
            return JSON.parse(localStorage.getItem(this._pendingDeleteKey()) || '[]');
        } catch {
            return [];
        }
    },

    _writePendingDeletes(ids) {
        const uniqueIds = [...new Set(ids.filter(Boolean))];
        if (uniqueIds.length) {
            localStorage.setItem(this._pendingDeleteKey(), JSON.stringify(uniqueIds));
        } else {
            localStorage.removeItem(this._pendingDeleteKey());
        }
    },

    _queuePendingDelete(id) {
        this._writePendingDeletes([...this._readPendingDeletes(), id]);
    },

    async _readJsonResponse(response, fallbackErrorMessage) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`${fallbackErrorMessage}: expected JSON, received ${contentType || 'unknown content type'}`);
        }
        return await response.json();
    },

    async fetchSyncData() {
        const response = await fetch('/api/user/sync');
        if (response.status === 401) return null; // Not logged in
        if (!response.ok) throw new Error('Failed to fetch sync data');
        return await this._readJsonResponse(response, 'Failed to fetch sync data');
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
        return await this._readJsonResponse(response, 'Failed to push sync data');
    },

    async sync() {
        if (this._disabled) return;

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
        if (this._disabled) return;

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
        setTimeout(() => this.syncPendingPlaylists(), 1000);
        
        // Periodical sync every 5 minutes
        setInterval(() => {
            this.sync();
            this.syncPendingPlaylists();
        }, 5 * 60 * 1000);
    },

    // Compatibility methods for existing code
    async getPublicPlaylist() { return null; },
    async getProfile() { return null; },
    async syncUserFolder() {},
    async publishPlaylist(playlist) {
        if (!playlist?.id) return playlist;
        const isLocalOnlyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playlist.id);
        if (!playlist.serverId && !playlist.navidromeId && playlist.syncStatus !== 'synced' && isLocalOnlyId) {
            playlist.visibility = playlist.visibility || 'public';
            playlist.isPublic = true;
            return playlist;
        }
        return this.syncUserPlaylist({ ...playlist, visibility: playlist.visibility || 'public', isPublic: true }, 'update');
    },
    async unpublishPlaylist(id) {
        if (!id) return null;
        const playlist = (await db.getPlaylist(id).catch(() => null)) || { id };
        const isLocalOnlyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playlist.id);
        if (!playlist.serverId && !playlist.navidromeId && playlist.syncStatus !== 'synced' && isLocalOnlyId) {
            playlist.visibility = 'private';
            playlist.isPublic = false;
            return playlist;
        }
        return this.syncUserPlaylist({ ...playlist, visibility: 'private', isPublic: false }, 'update');
    },
    async syncUserPlaylist(playlist, action = 'update') {
        if (!playlist?.id) return playlist;

        const api = MusicAPI.instance;
        if (!api) return playlist;

        const syncKey = `${action}:${playlist.serverId || playlist.navidromeId || playlist.id}`;
        if (this._playlistSyncInFlight.has(syncKey)) return playlist;
        this._playlistSyncInFlight.add(syncKey);

        const isLocalOnlyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playlist.id);
        const serverId = playlist.serverId || playlist.navidromeId || playlist.id;
        const ownerUsername = localStorage.getItem('subsonic_user') || playlist.ownerUsername || '';

        try {
            if (action === 'delete') {
                if (!playlist.serverId && !playlist.navidromeId && playlist.syncStatus !== 'synced' && isLocalOnlyId) {
                    return null;
                }
                await api.deleteSubsonicPlaylist(serverId);
                return null;
            }

            const trackIds = (playlist.tracks || [])
                .map((track) => track.navidromeTrackId || track.navidrome_track_id || track.id)
                .filter(Boolean);
            const description = playlist.description || playlist.comment || '';
            const visibility = playlist.visibility || (playlist.isPublic ? 'public' : 'private');

            let remotePlaylist;
            if (action === 'create' || (!playlist.serverId && playlist.syncStatus !== 'synced' && isLocalOnlyId)) {
                remotePlaylist = await api.createSubsonicPlaylist(playlist.name || playlist.title || 'Untitled', trackIds, description);
            } else {
                remotePlaylist = await api.replaceSubsonicPlaylistTracks(serverId, trackIds);
                await api.updateSubsonicPlaylist(serverId, {
                    name: playlist.name || playlist.title,
                    comment: description,
                    public: visibility !== 'private',
                });
            }

            const resolvedId = remotePlaylist?.id || serverId;
            if (resolvedId && typeof api.setPlaylistVisibility === 'function') {
                try {
                    await api.setPlaylistVisibility(resolvedId, visibility);
                } catch (error) {
                    console.warn('Playlist synced, but visibility update failed:', error);
                }
            }

            const syncedPlaylist = {
                ...playlist,
                id: resolvedId,
                uuid: resolvedId,
                serverId: resolvedId,
                navidromeId: resolvedId,
                ownerUsername,
                isPublic: visibility !== 'private',
                visibility,
                syncStatus: 'synced',
                syncError: '',
                syncedAt: Date.now(),
                updatedAt: Date.now(),
            };

            await db.performTransaction('user_playlists', 'readwrite', (store) => {
                if (playlist.id !== resolvedId) store.delete(playlist.id);
                return store.put(syncedPlaylist);
            });

            return syncedPlaylist;
        } catch (error) {
            console.error(`Failed to sync playlist (${action}):`, error);
            if (action !== 'delete') {
                await db.performTransaction('user_playlists', 'readwrite', (store) =>
                    store.put({
                        ...playlist,
                        ownerUsername,
                        syncStatus: 'pending',
                        syncError: error?.message || String(error),
                        updatedAt: Date.now(),
                    })
                );
            } else if (serverId && (!isLocalOnlyId || playlist.serverId || playlist.navidromeId || playlist.syncStatus === 'synced')) {
                this._queuePendingDelete(serverId);
            }
            throw error;
        } finally {
            this._playlistSyncInFlight.delete(syncKey);
        }
    },
    async syncPendingPlaylists() {
        if (this._disabled) return;
        try {
            await this.syncPendingPlaylistDeletes();
            const playlists = await db.getPlaylists(true);
            const pending = playlists.filter((playlist) => {
                const isLocalOnlyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playlist.id);
                return ['local', 'pending'].includes(playlist.syncStatus) || (!playlist.serverId && isLocalOnlyId);
            });
            for (const playlist of pending) {
                try {
                    const isLocalOnlyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playlist.id);
                    await this.syncUserPlaylist(playlist, playlist.serverId || !isLocalOnlyId ? 'update' : 'create');
                } catch {
                    // syncUserPlaylist already stores the error on the local playlist.
                }
            }
        } catch (error) {
            console.error('Failed to sync pending playlists:', error);
        }
    },
    async syncPendingPlaylistDeletes() {
        const api = MusicAPI.instance;
        if (!api) return;
        const pendingDeletes = this._readPendingDeletes();
        if (!pendingDeletes.length) return;

        const remaining = [];
        for (const id of pendingDeletes) {
            try {
                await api.deleteSubsonicPlaylist(id);
            } catch (error) {
                console.error('Failed to sync pending playlist delete:', error);
                remaining.push(id);
            }
        }
        this._writePendingDeletes(remaining);
    },
    async getPublicPlaylist() { return null; },
};

export default syncManager;

import { db } from './db.js';
import { MusicAPI } from './music-api.js';

export const syncManager = {
    _syncTimeout: null,
    _syncInterval: null,
    _initialized: false,
    _changeHandler: null,
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
        const api = MusicAPI.instance?.subsonicAPI;
        if (!api?.user || !api?.password || typeof api.fetchNative !== 'function') return null;
        const response = await api.fetchNative('/api/user/sync');
        return response?.id ? response : null;
    },

    async pushSyncData(data, timestamp) {
        const api = MusicAPI.instance?.subsonicAPI;
        if (!api?.user || !api?.password || typeof api.fetchNative !== 'function') return null;
        const response = await api.fetchNative('/api/user/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userData: JSON.stringify(data),
                userDataUpdatedAt: timestamp,
            }),
        });
        return response?.id ? response : null;
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
            
            // Periodically cleanup followed playlists that might have been made private
            await this.cleanupFollowedPlaylists();
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
        if (this._initialized) return;
        this._initialized = true;
        this._changeHandler = () => this.triggerChange();

        // Listen for changes that should trigger a sync
        window.addEventListener('favorites-changed', this._changeHandler);
        window.addEventListener('playlist-tracks-changed', this._changeHandler);
        window.addEventListener('sync-playlist-change', this._changeHandler);
        
        // Initial sync
        this.sync();
        setTimeout(() => this.syncPendingPlaylists(), 1000);
        
        // Periodical sync every 5 minutes
        this._syncInterval = setInterval(() => {
            this.sync();
            this.syncPendingPlaylists();
        }, 5 * 60 * 1000);
    },

    destroy() {
        if (!this._initialized) return;
        window.removeEventListener('favorites-changed', this._changeHandler);
        window.removeEventListener('playlist-tracks-changed', this._changeHandler);
        window.removeEventListener('sync-playlist-change', this._changeHandler);
        if (this._syncTimeout) clearTimeout(this._syncTimeout);
        if (this._syncInterval) clearInterval(this._syncInterval);
        this._syncTimeout = null;
        this._syncInterval = null;
        this._changeHandler = null;
        this._initialized = false;
    },

    async cleanupFollowedPlaylists() {
        // Throttle cleanup to run at most once every hour to avoid excessive API calls
        const lastCleanup = parseInt(localStorage.getItem('followed_playlists_cleanup_at') || '0');
        const now = Date.now();
        if (now - lastCleanup < 60 * 60 * 1000) return;

        try {
            const playlists = await db.getPlaylists(true);
            const followed = playlists.filter((p) => p.isFollowed);
            if (followed.length === 0) return;

            const api = MusicAPI.instance;
            if (!api) return;
            const currentUsername = localStorage.getItem('subsonic_user') || '';

            for (const playlist of followed) {
                try {
                    const remote = await api.getPlaylist(playlist.id);
                    // Check if it's private and we don't own it
                    if (remote.visibility === 'private' && remote.ownerUsername !== currentUsername) {
                        console.log(`Playlist ${playlist.id} is now private, removing from library.`);
                        await db.removePlaylistFromLibrary(playlist.id);
                    }
                } catch (error) {
                    // 404, 403 or Not Authorized means it's gone or inaccessible
                    const msg = error.message || '';
                    if (error.status === 404 || error.status === 403 || msg.includes('Not Authorized') || msg.includes('not found')) {
                        console.log(`Playlist ${playlist.id} is no longer accessible, removing from library.`);
                        await db.removePlaylistFromLibrary(playlist.id);
                    }
                }
            }
            localStorage.setItem('followed_playlists_cleanup_at', now.toString());
        } catch (error) {
            console.error('Failed to cleanup followed playlists:', error);
        }
    },

    // Compatibility methods for existing code
    async getPublicPlaylist(id) {
        return MusicAPI.instance.getPlaylist(id);
    },
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
        if (!playlist?.id || playlist.isFollowed) return playlist;

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
            if (resolvedId && playlist.coverMetadata && typeof api.updatePlaylistCoverMetadata === 'function') {
                try {
                    await api.updatePlaylistCoverMetadata(resolvedId, playlist.coverMetadata);
                } catch (error) {
                    console.warn('Playlist synced, but cover metadata update failed:', error);
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
                if (playlist.isFollowed) return false;
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
    
    async cleanupFollowedPlaylists() {
        if (this._disabled) return;
        
        const now = Date.now();
        const lastCleanup = parseInt(localStorage.getItem('followed_playlists_cleanup_at') || '0');
        const oneHour = 60 * 60 * 1000;
        
        if (now - lastCleanup < oneHour) {
            return;
        }
        
        try {
            const playlists = await db.getPlaylists(true);
            const followed = playlists.filter(p => p.isFollowed);
            
            if (followed.length === 0) {
                localStorage.setItem('followed_playlists_cleanup_at', now.toString());
                return;
            }
            
            const api = MusicAPI.instance;
            for (const playlist of followed) {
                try {
                    const result = await api.getPlaylist(playlist.id);
                    if (!result || !result.playlist || result.playlist.visibility === 'private') {
                        console.log(`[Sync] Cleaning up inaccessible followed playlist: ${playlist.name} (${playlist.id})`);
                        await db.removePlaylistFromLibrary(playlist.id);
                    }
                } catch (error) {
                    // 404 or 403 means it's gone or private
                    if (error.message?.includes('404') || error.message?.includes('403')) {
                        console.log(`[Sync] Removing 404/403 followed playlist: ${playlist.name}`);
                        await db.removePlaylistFromLibrary(playlist.id);
                    }
                }
            }
            
            localStorage.setItem('followed_playlists_cleanup_at', now.toString());
        } catch (error) {
            console.error('Failed to cleanup followed playlists:', error);
        }
    }
};

export default syncManager;

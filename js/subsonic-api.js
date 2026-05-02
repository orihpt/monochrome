// js/subsonic-api.js
import { PreparedTrack, PreparedAlbum } from './container-classes.js';

export class SubsonicAPI {
    constructor() {
        this.baseUrl = '/rest';
        this.user = localStorage.getItem('subsonic_user') || '';
        this.password = localStorage.getItem('subsonic_pass') || '';
        this.version = '1.16.1';
        this.client = 'waves-music';
    }

    get credentials() {
        const encodedPassword = Array.from(new TextEncoder().encode(this.password))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
        return `?u=${encodeURIComponent(this.user)}&p=enc:${encodedPassword}&v=${this.version}&c=${this.client}`;
    }

    async fetchAPI(endpoint, params = '') {
        const url = `${this.baseUrl}/${endpoint}.view${this.credentials}&f=json${params ? '&' + params : ''}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data['subsonic-response'];
        } catch (error) {
            console.error('Subsonic API Error:', error);
            throw error;
        }
    }

    async postFormAPI(endpoint, formData, params = '') {
        const url = `${this.baseUrl}/${endpoint}.view${this.credentials}&f=json${params ? '&' + params : ''}`;
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        return data['subsonic-response'];
    }

    async getCurrentUser() {
        const username = localStorage.getItem('subsonic_user') || this.user;
        const res = await this.fetchAPI('getUser', `username=${encodeURIComponent(username)}`);
        return res?.user || null;
    }

    async isCurrentUserAdmin() {
        try {
            const user = await this.getCurrentUser();
            return user?.adminRole === true || user?.adminRole === 'true';
        } catch (error) {
            console.warn('Unable to determine admin permissions:', error);
            return false;
        }
    }

    async getArtistRequests() {
        const res = await this.fetchAPI('getArtistRequests');
        this.throwIfSubsonicError(res);
        const data = res?.artistRequests || {};
        return {
            items: data.artistRequest || [],
            isAdmin: data.isAdmin === true || data.isAdmin === 'true',
        };
    }

    async createArtistRequest(name) {
        const res = await this.fetchAPI('createArtistRequest', `name=${encodeURIComponent(name)}`);
        this.throwIfSubsonicError(res);
        const data = res?.artistRequests || {};
        return {
            items: data.artistRequest || [],
            isAdmin: data.isAdmin === true || data.isAdmin === 'true',
        };
    }

    async toggleArtistRequestVote(id) {
        const res = await this.fetchAPI('toggleArtistRequestVote', `id=${encodeURIComponent(id)}`);
        this.throwIfSubsonicError(res);
        const data = res?.artistRequests || {};
        return {
            items: data.artistRequest || [],
            isAdmin: data.isAdmin === true || data.isAdmin === 'true',
        };
    }

    async deleteArtistRequest(id) {
        const res = await this.fetchAPI('deleteArtistRequest', `id=${encodeURIComponent(id)}`);
        this.throwIfSubsonicError(res);
        const data = res?.artistRequests || {};
        return {
            items: data.artistRequest || [],
            isAdmin: data.isAdmin === true || data.isAdmin === 'true',
        };
    }

    async moveArtistRequest(id, status) {
        const res = await this.fetchAPI(
            'moveArtistRequest',
            `id=${encodeURIComponent(id)}&status=${encodeURIComponent(status)}`
        );
        this.throwIfSubsonicError(res);
        const data = res?.artistRequests || {};
        return {
            items: data.artistRequest || [],
            isAdmin: data.isAdmin === true || data.isAdmin === 'true',
        };
    }

    async updateArtistRequestName(id, name) {
        const res = await this.fetchAPI(
            'updateArtistRequestName',
            `id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`
        );
        this.throwIfSubsonicError(res);
        const data = res?.artistRequests || {};
        return {
            items: data.artistRequest || [],
            isAdmin: data.isAdmin === true || data.isAdmin === 'true',
        };
    }

    async getArtistRequestSuggestions(query) {
        const res = await this.fetchAPI('getArtistRequestSuggestions', `query=${encodeURIComponent(query || '')}`);
        this.throwIfSubsonicError(res);
        return res?.artistRequestSuggestions?.name || [];
    }

    throwIfSubsonicError(res) {
        if (res?.status === 'failed' || res?.error) {
            throw new Error(res?.error?.message || 'Request failed');
        }
    }

    preparePlaylist(playlist) {
        if (!playlist) return null;
        return {
            id: playlist.id,
            uuid: playlist.id,
            title: playlist.name,
            name: playlist.name,
            description: playlist.comment || '',
            cover: playlist.coverArt,
            image: playlist.coverArt,
            squareImage: playlist.coverArt,
            numberOfTracks: playlist.songCount || 0,
            songCount: playlist.songCount || 0,
            duration: playlist.duration || 0,
            owner: playlist.owner,
            public: playlist.public === true || playlist.public === 'true',
            curatorPinned: playlist.curatorPinned === true || playlist.curatorPinned === 'true',
            readonly: playlist.readonly === true || playlist.readonly === 'true',
            isCuratorPlaylist: playlist.owner === 'wavesmusic_curator',
        };
    }

    // --- URL helpers ---

    getStreamUrl(id) {
        return { url: `${this.baseUrl}/stream.view${this.credentials}&id=${id}` };
    }

    getCoverUrl(id, size) {
        if (!id) return '/assets/1024w_new.png';
        return `${this.baseUrl}/getCoverArt.view${this.credentials}&id=${id}&size=${size || 300}`;
    }

    getCoverSrcset(id) {
        if (!id) return '';
        const small = this.getCoverUrl(id, 300);
        const large = this.getCoverUrl(id, 800);
        return `${small} 300w, ${large} 800w`;
    }

    getArtistPictureUrl(id /*, size */) {
        if (typeof id === 'string' && id.startsWith('/rest/')) return id;
        if (!id) return '/assets/appicon.png';
        
        // Use Navidrome's rich image endpoint for artists as it's more reliable
        // Strip 'ar-' prefix and any '_0' suffix to get the raw artist ID
        let artistId = (typeof id === 'string' && id.startsWith('ar-')) ? id.substring(3) : id;
        if (typeof artistId === 'string' && artistId.endsWith('_0')) {
            artistId = artistId.substring(0, artistId.length - 2);
        }
        return `${this.baseUrl}/getArtistRichImage.view${this.credentials}&id=${encodeURIComponent(artistId)}&type=avatar`;
    }

    getArtistRichImageUrl(id, type) {
        if (!id) return null;
        return `${this.baseUrl}/getArtistRichImage.view${this.credentials}&id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`;
    }

    getArtistPictureSrcset(id) {
        if (!id) return '';
        return `${this.getArtistPictureUrl(id)} 300w`;
    }

    // --- Data preparers ---

    prepareTrack(song) {
        if (!song) return null;
        return new PreparedTrack({
            id: song.id,
            streamUrl: this.getStreamUrl(song.id),
            cover: song.coverArt || song.albumId,
            title: song.title,
            artists: song.artists
                ? song.artists.map(a => ({ name: a.name, id: a.id }))
                : [{ name: song.artist || 'Unknown Artist', id: song.artistId }],
            artist: { name: song.artist || 'Unknown Artist', id: song.artistId },
            album: {
                id: song.albumId,
                title: song.album || 'Unknown Album',
                cover: song.coverArt || song.albumId,
            },
            duration: song.duration,
            albumId: song.albumId,
            trackNumber: song.track,
            popularity: song.playCount || 0,
            playCount: song.playCount || 0,
            isLocal: false,
        });
    }

    prepareAlbum(album) {
        if (!album) return null;
        return new PreparedAlbum({
            id: album.id,
            title: album.name || album.title || 'Unknown Album',
            artist: typeof album.artist === 'string'
                ? { name: album.artist, id: album.artistId }
                : album.artist || { name: 'Unknown Artist' },
            cover: album.coverArt || album.id,
            year: album.year,
            releaseDate: album.releaseDate?.value || album.originalReleaseDate?.value || album.year,
            numberOfTracks: album.songCount,
            duration: album.duration,
            popularity: album.playCount || 0,
            playCount: album.playCount || 0,
            type: Array.isArray(album.releaseTypes) && album.releaseTypes.length > 0
                ? album.releaseTypes[0]?.toUpperCase()
                : undefined,
            isLocal: false,
        });
    }

    prepareArtist(artist) {
        if (!artist) return null;
        return {
            id: artist.id,
            name: artist.name || 'Unknown Artist',
            picture: artist.coverArt || artist.id,
            tracks: [],
            albums: [],
            eps: [],
            videos: [],
            albumCount: artist.albumCount || 0,
            isLocal: false,
        };
    }

    // --- Search ---

    async search(query) {
        const res = await this.fetchAPI(
            'search3',
            `query=${encodeURIComponent(query)}&artistCount=12&albumCount=12&songCount=50`
        );
        const result = res?.searchResult3 || {};
        return {
            tracks: { items: (result.song || []).map(s => this.prepareTrack(s)).filter(Boolean) },
            albums: { items: (result.album || []).map(a => this.prepareAlbum(a)).filter(Boolean) },
            artists: { items: (result.artist || []).map(a => this.prepareArtist(a)).filter(Boolean) },
            playlists: { items: [] },
            videos: { items: [] },
        };
    }

    async searchTracks(query, options = {}) {
        const limit = options.limit || 20;
        const res = await this.fetchAPI(
            'search3',
            `query=${encodeURIComponent(query)}&songCount=${limit}&albumCount=0&artistCount=0`
        );
        const songs = res?.searchResult3?.song || [];
        return { items: songs.map(s => this.prepareTrack(s)).filter(Boolean) };
    }

    async searchAlbums(query, options = {}) {
        const limit = options.limit || 12;
        const res = await this.fetchAPI(
            'search3',
            `query=${encodeURIComponent(query)}&songCount=0&albumCount=${limit}&artistCount=0`
        );
        const albums = res?.searchResult3?.album || [];
        return { items: albums.map(a => this.prepareAlbum(a)).filter(Boolean) };
    }

    async searchArtists(query, options = {}) {
        const limit = options.limit || 12;
        const res = await this.fetchAPI(
            'search3',
            `query=${encodeURIComponent(query)}&songCount=0&albumCount=0&artistCount=${limit}`
        );
        const artists = res?.searchResult3?.artist || [];
        return { items: artists.map(a => this.prepareArtist(a)).filter(Boolean) };
    }

    // --- Individual item getters ---

    async getTrack(id) {
        const res = await this.fetchAPI('getSong', `id=${id}`);
        return this.prepareTrack(res?.song);
    }

    async getTrackMetadata(id) {
        return this.getTrack(id);
    }

    async getAlbum(id) {
        const res = await this.fetchAPI('getAlbum', `id=${id}`);
        const album = this.prepareAlbum(res?.album);
        const tracks = (res?.album?.song || []).map(s => this.prepareTrack(s)).filter(Boolean);
        return { album, tracks };
    }

    async getArtist(id) {
        const res = await this.fetchAPI('getArtist', `id=${id}`);
        const artist = res?.artist;
        if (!artist) return null;
        const prepared = this.prepareArtist(artist);
        prepared.albums = (artist.album || []).map(a => this.prepareAlbum(a)).filter(Boolean);
        const topTracks = await this.getArtistTopTracks(id, { limit: 15 });
        prepared.tracks = topTracks.tracks || [];
        const richInfo = await this.getArtistRichInfo(id);
        if (richInfo) {
            Object.assign(prepared, {
                name: richInfo.name || prepared.name,
                genres: Array.isArray(richInfo.genres) ? richInfo.genres : [],
                followers: richInfo.followers,
                popularity: richInfo.popularity,
                biography: richInfo.biography || null,
                localAvatarUrl: richInfo.hasAvatar ? this.getArtistRichImageUrl(id, 'avatar') : null,
                localHeaderUrl: richInfo.hasHeader ? this.getArtistRichImageUrl(id, 'header') : null,
            });
        }
        return prepared;
    }

    async getArtistTopTracks(artistId, options = {}) {
        const offset = options.offset || 0;
        const limit = options.limit || 15;
        const count = offset + limit + 1;

        try {
            const artistRes = await this.fetchAPI('getArtist', `id=${artistId}`);
            const artist = artistRes?.artist;
            if (artist?.name) {
                const res = await this.fetchAPI('getTopSongs', `artist=${encodeURIComponent(artist.name)}&count=${count}`);
                const songs = res?.topSongs?.song || [];
                const tracks = songs.map(s => this.prepareTrack(s)).filter(Boolean);
                return {
                    tracks: tracks.slice(offset, offset + limit),
                    offset,
                    limit,
                    hasMore: tracks.length > offset + limit,
                };
            }
        } catch (e) {
            console.warn('getArtistTopTracks fallback:', e);
        }

        const res = await this.fetchAPI('search3', `query=${artistId}&songCount=${count}&albumCount=0&artistCount=0`);
        const tracks = (res?.searchResult3?.song || []).map(s => this.prepareTrack(s)).filter(Boolean);
        return {
            tracks: tracks.slice(offset, offset + limit),
            offset,
            limit,
            hasMore: tracks.length > offset + limit,
        };
    }

    async getArtistBiography(id) {
        try {
            const richInfo = await this.getArtistRichInfo(id);
            if (richInfo?.biography) return richInfo.biography;
        } catch {
            return null;
        }
        return null;
    }

    async getArtistRichInfo(id) {
        try {
            const res = await this.fetchAPI('getArtistRichInfo', `id=${id}`);
            return res?.artistRichInfo || null;
        } catch (e) {
            console.warn('getArtistRichInfo failed:', e);
            return null;
        }
    }

    // --- Home content ---

    async getHomeContent() {
        // Return newest albums for home page
        const res = await this.fetchAPI('getAlbumList2', 'type=newest&size=20');
        const albums = res?.albumList2?.album || [];
        return albums.map(a => this.prepareAlbum(a)).filter(Boolean);
    }

    async getCuratorPlaylists() {
        const res = await this.fetchAPI('getCuratorPlaylists');
        this.throwIfSubsonicError(res);
        const playlists = res?.playlists?.playlist || [];
        return playlists.map((playlist) => this.preparePlaylist(playlist)).filter(Boolean);
    }

    async getAllArtists(options = {}) {
        const res = await this.fetchAPI('getArtists');
        const indices = res?.artists?.index || [];
        let allArtists = [];
        for (const index of indices) {
            if (index.artist) {
                allArtists = allArtists.concat(index.artist);
            }
        }
        
        let items = allArtists.map(a => this.prepareArtist(a)).filter(Boolean);
        
        // In-memory sorting since getArtists doesn't support it natively
        const sort = options.sort || 'name';
        if (sort === 'popularity' || sort === 'most_played') {
            // Approximation: sort by albumCount for popularity/most played
            items.sort((a, b) => {
                const aCount = a.albums ? a.albums.length : (a.albumCount || 0);
                const bCount = b.albums ? b.albums.length : (b.albumCount || 0);
                return bCount - aCount;
            });
        } else if (sort === 'recent') {
            // Approximation: sort by ID (if sequential) or reverse alphabetical
            items.reverse();
        } else {
            // name (default is already alphabetical)
            items.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        const offset = options.offset || 0;
        const limit = options.limit || 50;
        
        return {
            items: items.slice(offset, offset + limit),
            total: items.length,
            hasMore: offset + limit < items.length
        };
    }

    async getAllAlbums(options = {}) {
        const offset = options.offset || 0;
        const limit = options.limit || 50;
        const sort = options.sort || 'recent';
        
        let type = 'newest'; // default recent
        if (sort === 'name') type = 'alphabeticalByName';
        else if (sort === 'most_played') type = 'frequent';
        
        const res = await this.fetchAPI('getAlbumList2', `type=${type}&size=${limit}&offset=${offset}`);
        const albums = res?.albumList2?.album || [];
        return {
            items: albums.map(a => this.prepareAlbum(a)).filter(Boolean),
            hasMore: albums.length === limit // rough guess
        };
    }

    // --- Recommendations / similar ---

    async getRecommendedTracksForPlaylist(seeds = [], limit = 20, options = {}) {
        try {
            const knownTrackIds = Array.from(options.knownTrackIds || []);
            const response = await fetch('/api/v1/recommend/v1/radio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.user,
                    type: 'track',
                    id: (seeds || []).map((track) => track?.id).filter(Boolean)[0] || '',
                    known_track_ids: knownTrackIds,
                    limit,
                }),
            });

            if (!response.ok) throw new Error(`Recommendation service returned ${response.status}`);
            const data = await response.json();
            const ids = (data?.tracks || []).map((track) => track.id).filter(Boolean);
            const tracks = await Promise.all(ids.map((id) => this.getTrack(id).catch(() => null)));
            return tracks.filter(Boolean);
        } catch (e) {
            console.warn('LightFM recommendations failed:', e);
            return [];
        }
    }

    async getSimilarAlbums(albumId) {
        try {
            const response = await fetch(`/api/v1/recommend/v1/related/albums/${encodeURIComponent(albumId)}?limit=12`);
            if (!response.ok) throw new Error(`Recommendation service returned ${response.status}`);
            const data = await response.json();
            const ids = (data?.albums || []).map((album) => album.id).filter(Boolean);
            const albums = await Promise.all(
                ids.map((id) =>
                    this.getAlbum(id)
                        .then((result) => result?.album)
                        .catch(() => null)
                )
            );
            return albums.filter(Boolean);
        } catch (e) {
            console.warn('LightFM similar albums failed, falling back to newest albums:', e);
            const res = await this.fetchAPI('getAlbumList2', 'type=newest&size=12');
            const albums = res?.albumList2?.album || [];
            return albums.map(a => this.prepareAlbum(a)).filter(Boolean);
        }
    }

    async getSimilarArtists(artistId) {
        try {
            const response = await fetch(`/api/v1/recommend/v1/related/artists/${encodeURIComponent(artistId)}?limit=12`);
            if (!response.ok) throw new Error(`Recommendation service returned ${response.status}`);
            const data = await response.json();
            const ids = (data?.artists || []).map((artist) => artist.id).filter(Boolean);
            const artists = await Promise.all(ids.map((id) => this.getArtist(id).catch(() => null)));
            return artists.filter(Boolean);
        } catch (e) {
            console.warn('getSimilarArtists fallback:', e);
        }
        // fallback: search by letter
        const res = await this.fetchAPI('search3', `query=a&songCount=0&albumCount=0&artistCount=12`);
        return (res?.searchResult3?.artist || []).map(a => this.prepareArtist(a)).filter(Boolean);
    }

    async getTrackRecommendations(id) {
        try {
            const response = await fetch(`/api/v1/recommend/v1/related/tracks/${encodeURIComponent(id)}?limit=20`);
            if (!response.ok) throw new Error(`Recommendation service returned ${response.status}`);
            const data = await response.json();
            const ids = (data?.tracks || []).map((track) => track.id).filter(Boolean);
            const tracks = await Promise.all(ids.map((trackId) => this.getTrack(trackId).catch(() => null)));
            return tracks.filter(Boolean);
        } catch (e) {
            console.warn('LightFM track recommendations failed:', e);
            return [];
        }
    }

    // --- Lyrics ---

    async getLyrics(id) {
        try {
            // Navidrome supports getLyricsBySongId (OpenSubsonic extension)
            const res = await this.fetchAPI('getLyricsBySongId', `id=${id}`);
            const lyrics = res?.lyricsList?.structuredLyrics?.[0];
            if (lyrics) {
                const format = (lyrics.format || '').toLowerCase();
                const raw = lyrics.raw || '';
                if (raw && (format === 'ttml' || format === 'ttlm')) {
                    return { subtitles: raw, raw, format: 'ttml', lyricsProvider: 'Navidrome' };
                }
                if (raw && format === 'lrc') {
                    return { subtitles: raw, raw, format: 'lrc', lyricsProvider: 'Navidrome' };
                }
                // Convert structured lyrics to LRC format
                if (lyrics.synced && lyrics.line?.length > 0) {
                    const lrc = lyrics.line
                        .map(l => {
                            const ms = l.start || 0;
                            const totalSec = Math.floor(ms / 1000);
                            const min = Math.floor(totalSec / 60);
                            const sec = totalSec % 60;
                            const cs = Math.floor((ms % 1000) / 10);
                            return `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}]${(l.value || '').trim()}`;
                        })
                        .join('\n');
                    return { subtitles: lrc, format: 'lrc', lyricsProvider: 'Navidrome' };
                }
                // Unsynced
                const text = lyrics.line?.map(l => (l.value || '').trim()).join('\n');
                if (text) return { subtitles: text, format: 'text', lyricsProvider: 'Navidrome' };
            }
        } catch (e) {
            console.warn('getLyricsBySongId failed, trying getLyrics:', e);
        }

        // Fallback to classic getLyrics
        try {
            const res = await this.fetchAPI('getLyrics', `id=${id}`);
            const lyrics = res?.lyrics;
            if (lyrics?.value || lyrics) {
                const text = lyrics.value || (typeof lyrics === 'string' ? lyrics : null);
                if (text) return { subtitles: text, lyricsProvider: 'Navidrome' };
            }
        } catch (e) {
            console.warn('getLyrics failed:', e);
        }

        return null;
    }

    // --- Playlists ---

    async searchPlaylists(query) {
        // No native playlist search in Subsonic; return all matching by name
        try {
            const res = await this.fetchAPI('getPlaylists');
            const playlists = res?.playlists?.playlist || [];
            const q = query.toLowerCase();
            return {
                items: playlists
                    .filter(p => p.name?.toLowerCase().includes(q))
                    .map(p => ({
                        id: p.id,
                        title: p.name,
                        cover: p.coverArt,
                        trackCount: p.songCount,
                        isLocal: false,
                    })),
            };
        } catch {
            return { items: [] };
        }
    }

    async getPlaylist(id) {
        const res = await this.fetchAPI('getPlaylist', `id=${encodeURIComponent(id)}`);
        this.throwIfSubsonicError(res);
        const playlist = this.preparePlaylist(res?.playlist);
        const tracks = (res?.playlist?.entry || []).map((song) => this.prepareTrack(song)).filter(Boolean);
        if (playlist) {
            playlist.tracks = tracks;
            playlist.numberOfTracks = playlist.numberOfTracks || tracks.length;
        }
        return { playlist, tracks };
    }

    async createPlaylist(name, trackIds = [], description = '') {
        const params = new URLSearchParams();
        params.set('name', name);
        for (const id of trackIds) params.append('songId', id);
        const res = await this.fetchAPI('createPlaylist', params.toString());
        this.throwIfSubsonicError(res);
        const playlist = this.preparePlaylist(res?.playlist);
        if (description && playlist?.id) {
            await this.updatePlaylist(playlist.id, { comment: description });
            playlist.description = description;
        }
        return playlist;
    }

    async updatePlaylist(id, updates = {}) {
        const params = new URLSearchParams();
        params.set('playlistId', id);
        if (updates.name != null) params.set('name', updates.name);
        if (updates.comment != null) params.set('comment', updates.comment);
        if (updates.public != null) params.set('public', updates.public ? 'true' : 'false');
        const res = await this.fetchAPI('updatePlaylist', params.toString());
        this.throwIfSubsonicError(res);
        return true;
    }

    async importCuratorPlaylist({ name, description, file }) {
        const formData = new FormData();
        formData.set('name', name);
        formData.set('description', description || '');
        formData.set('file', file);
        const res = await this.postFormAPI('importCuratorPlaylist', formData);
        this.throwIfSubsonicError(res);
        return res?.curatorPlaylistImport;
    }

    async setCuratorPlaylistPublished(playlistId, published) {
        const params = new URLSearchParams({ playlistId, published: published ? 'true' : 'false' });
        const res = await this.fetchAPI('setCuratorPlaylistPublished', params.toString());
        this.throwIfSubsonicError(res);
    }

    async setCuratorPlaylistPinned(playlistId, pinned) {
        const params = new URLSearchParams({ playlistId, pinned: pinned ? 'true' : 'false' });
        const res = await this.fetchAPI('setCuratorPlaylistPinned', params.toString());
        this.throwIfSubsonicError(res);
    }

    // --- Library Management ---
    async triggerScan() {
        return this.fetchAPI('startScan');
    }

    async retriggerRecommendations() {
        const isAdmin = await this.isCurrentUserAdmin();
        if (!isAdmin) {
            throw new Error('Admin permissions are required');
        }

        const response = await fetch('/api/v1/recommend/v1/jobs/nightly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Recommendation service returned ${response.status}`);
        }
        return response.json();
    }

    async getRecommendationServerStatus() {
        const isAdmin = await this.isCurrentUserAdmin();
        if (!isAdmin) {
            throw new Error('Admin permissions are required');
        }

        const response = await fetch('/api/v1/recommend/v1/model/status', {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Recommendation service returned ${response.status}`);
        }
        return response.json();
    }

    async recordRecommendationEvent(event) {
        if (!event?.track_id && !event?.trackId) return null;
        const response = await fetch('/api/v1/recommend/v1/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: event.user_id || event.userId || this.user,
                track_id: event.track_id || event.trackId,
                event_type: event.event_type || event.eventType || 'play',
                source: event.source || 'monochrome',
                played_ms: event.played_ms ?? event.playedMs ?? null,
                duration_ms: event.duration_ms ?? event.durationMs ?? null,
            }),
        });
        if (!response.ok) {
            throw new Error(`Recommendation service returned ${response.status}`);
        }
        return response.json();
    }

    // --- Download (no-op for local) ---

    async downloadTrack() {
        console.log('Download not supported in local mode');
    }
}

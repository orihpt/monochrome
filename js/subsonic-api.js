// js/subsonic-api.js
import { PreparedTrack, PreparedAlbum } from './container-classes.js';
import { md5 } from './md5.js';

export class SubsonicAPI {
    constructor() {
        this.baseUrl = '/rest';
        this.user = localStorage.getItem('subsonic_user') || 'admin';
        this.password = localStorage.getItem('subsonic_pass') || 'admin';
        this.version = '1.16.1';
        this.client = 'spotiman';
    }

    get credentials() {
        const salt = Math.random().toString(36).substring(2, 15);
        const token = md5(this.password + salt);
        return `?u=${this.user}&t=${token}&s=${salt}&v=${this.version}&c=${this.client}`;
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
        // Navidrome serves artist art via getCoverArt with the artist id
        if (!id) return '/assets/appicon.png';
        return `${this.baseUrl}/getCoverArt.view${this.credentials}&id=ar-${id}&size=300`;
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
            isLocal: true,
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
            isLocal: true,
        });
    }

    prepareArtist(artist) {
        if (!artist) return null;
        return {
            id: artist.id,
            name: artist.name || 'Unknown Artist',
            picture: artist.id, // use artist id so getArtistPictureUrl works
            tracks: [],
            albums: [],
            eps: [],
            videos: [],
            isLocal: true,
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
        return this.prepareArtist(artist);
    }

    async getArtistTopTracks(artistId) {
        // Navidrome: getTopSongs by artist name (requires name)
        // Fall back to searching for the artist's songs
        try {
            const artist = await this.getArtist(artistId);
            if (artist?.name) {
                const res = await this.fetchAPI('getTopSongs', `artist=${encodeURIComponent(artist.name)}&count=10`);
                const songs = res?.topSongs?.song || [];
                if (songs.length > 0) return songs.map(s => this.prepareTrack(s)).filter(Boolean);
            }
        } catch (e) {
            console.warn('getArtistTopTracks fallback:', e);
        }
        // fallback: search for artist name
        const res = await this.fetchAPI('search3', `query=${artistId}&songCount=10&albumCount=0&artistCount=0`);
        return (res?.searchResult3?.song || []).map(s => this.prepareTrack(s)).filter(Boolean);
    }

    async getArtistBiography(id) {
        try {
            const res = await this.fetchAPI('getArtistInfo', `id=${id}`);
            return res?.artistInfo?.biography || null;
        } catch {
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

    // --- Recommendations / similar ---

    async getRecommendedTracksForPlaylist(_seeds, limit = 20) {
        const res = await this.fetchAPI('getRandomSongs', `size=${limit}`);
        return (res?.randomSongs?.song || []).map(s => this.prepareTrack(s)).filter(Boolean);
    }

    async getSimilarAlbums(albumId) {
        // Navidrome doesn't have "similar albums", fall back to newest
        const res = await this.fetchAPI('getAlbumList2', 'type=newest&size=12');
        const albums = res?.albumList2?.album || [];
        return albums.map(a => this.prepareAlbum(a)).filter(Boolean);
    }

    async getSimilarArtists(artistId) {
        try {
            const res = await this.fetchAPI('getSimilarSongs', `id=${artistId}&count=5`);
            const songs = res?.similarSongs?.song || [];
            // Extract unique artists from similar songs
            const seen = new Set();
            const artists = [];
            for (const song of songs) {
                if (song.artistId && !seen.has(song.artistId)) {
                    seen.add(song.artistId);
                    artists.push({ id: song.artistId, name: song.artist, coverArt: song.coverArt });
                }
            }
            if (artists.length > 0) return artists.map(a => this.prepareArtist(a)).filter(Boolean);
        } catch (e) {
            console.warn('getSimilarArtists fallback:', e);
        }
        // fallback: search by letter
        const res = await this.fetchAPI('search3', `query=a&songCount=0&albumCount=0&artistCount=12`);
        return (res?.searchResult3?.artist || []).map(a => this.prepareArtist(a)).filter(Boolean);
    }

    async getTrackRecommendations(id) {
        try {
            const res = await this.fetchAPI('getSimilarSongs2', `id=${id}&count=20`);
            return (res?.similarSongs2?.song || []).map(s => this.prepareTrack(s)).filter(Boolean);
        } catch {
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
                // Convert structured lyrics to LRC format
                if (lyrics.synced && lyrics.line?.length > 0) {
                    const lrc = lyrics.line
                        .map(l => {
                            const ms = l.start || 0;
                            const totalSec = Math.floor(ms / 1000);
                            const min = Math.floor(totalSec / 60);
                            const sec = totalSec % 60;
                            const cs = Math.floor((ms % 1000) / 10);
                            return `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}]${l.value}`;
                        })
                        .join('\n');
                    return { subtitles: lrc, lyricsProvider: 'Navidrome' };
                }
                // Unsynced
                const text = lyrics.line?.map(l => l.value).join('\n');
                if (text) return { subtitles: text, lyricsProvider: 'Navidrome' };
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
                        isLocal: true,
                    })),
            };
        } catch {
            return { items: [] };
        }
    }

    // --- Library Management ---
    async triggerScan() {
        return this.fetchAPI('startScan');
    }

    // --- Download (no-op for local) ---

    async downloadTrack() {
        console.log('Download not supported in local mode');
    }
}

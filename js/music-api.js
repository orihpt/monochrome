// js/music-api.js

import { LosslessAPI } from './api.js';
import { PodcastsAPI } from './podcasts-api.js';
import { SubsonicAPI } from './subsonic-api.js';
import { musicProviderSettings } from './storage.js';

/**
 * MusicAPI - Singleton class that provides a unified interface for accessing music streaming services.
 *
 * Supports multiple providers (primarily Tidal) and includes functionality for searching,
 * retrieving metadata, streaming, and managing playlists, artists, albums, tracks, and podcasts.
 *
 * @class MusicAPI
 * @classdesc Manages API interactions with music providers and provides caching mechanisms
 * for cover artwork and video metadata.
 *
 * @example
 * // Initialize the MusicAPI
 * await MusicAPI.initialize(settings);
 *
 * // Get the singleton instance
 * const api = MusicAPI.instance;
 *
 * // Search for tracks
 * const results = await api.search('query');
 *
 * // Get a specific track
 * const track = await api.getTrack('track-id');
 *
 * // Get stream URL
 * const streamUrl = await api.getStreamUrl('track-id', 'HIGH');
 *
 * @property {LosslessAPI} tidalAPI - The Tidal API instance
 * @property {PodcastsAPI} podcastsAPI - The Podcasts API instance
 * @property {Object} _settings - Configuration settings
 * @property {Map} videoArtworkCache - Cache for video artwork data
 *
 * @throws {Error} Throws if instance is accessed before initialization
 * @throws {Error} Throws if initialize is called more than once
 */
export class MusicAPI {
    static #instance = null;
    /**
     * @type {MusicAPI}
     */
    static get instance() {
        if (!MusicAPI.#instance) {
            throw new Error('MusicAPI not initialized. Call MusicAPI.initialize(settings) first.');
        }
        return MusicAPI.#instance;
    }

    /** @private */
    constructor(settings) {
        this.tidalAPI = new LosslessAPI(settings);
        this.subsonicAPI = new SubsonicAPI();
        this.podcastsAPI = new PodcastsAPI();
        this._settings = settings;
        this.videoArtworkCache = new Map();
    }

    static async initialize(settings) {
        if (MusicAPI.#instance) {
            throw new Error('MusicAPI is already initialized');
        }

        const api = new MusicAPI(settings);
        return (MusicAPI.#instance = api);
    }

    getCurrentProvider() {
        return musicProviderSettings.getProvider();
    }

    // Get the appropriate API based on provider
    getAPI() {
        const provider = this.getCurrentProvider();
        if (provider === 'subsonic' || provider === 'navidrome') {
            return this.subsonicAPI;
        }
        return this.tidalAPI;
    }

    async fetchAPI(endpoint, params = '') {
        const api = this.getAPI();
        if (typeof api.fetchAPI === 'function') {
            return api.fetchAPI(endpoint, params);
        }
        throw new Error('fetchAPI not supported by current provider');
    }

    prepareTrack(data) {
        const api = this.getAPI();
        return typeof api.prepareTrack === 'function' ? api.prepareTrack(data) : data;
    }

    prepareAlbum(data) {
        const api = this.getAPI();
        return typeof api.prepareAlbum === 'function' ? api.prepareAlbum(data) : data;
    }

    prepareArtist(data) {
        const api = this.getAPI();
        return typeof api.prepareArtist === 'function' ? api.prepareArtist(data) : data;
    }

    // Search methods
    async search(query, options = {}) {
        const api = this.getAPI();
        if (typeof api.search === 'function') {
            return api.search(query, options);
        }

        // Fallback for providers that don't implement unified search
        const [tracksResult, videosResult, artistsResult, albumsResult, playlistsResult] = await Promise.all([
            api.searchTracks(query, options),
            api.searchVideos ? api.searchVideos(query, options) : Promise.resolve({ items: [] }),
            api.searchArtists(query, options),
            api.searchAlbums(query, options),
            api.searchPlaylists ? api.searchPlaylists(query, options) : Promise.resolve({ items: [] }),
        ]);

        return {
            tracks: tracksResult,
            videos: videosResult,
            artists: artistsResult,
            albums: albumsResult,
            playlists: playlistsResult,
        };
    }

    async searchTracks(query, options = {}) {
        const api = this.getAPI();
        if (typeof api.searchTracks === 'function') return api.searchTracks(query, options);
        const res = await api.search(query, options);
        return res?.tracks || { items: [] };
    }

    async searchArtists(query, options = {}) {
        const api = this.getAPI();
        if (typeof api.searchArtists === 'function') return api.searchArtists(query, options);
        const res = await api.search(query, options);
        return res?.artists || { items: [] };
    }

    async searchAlbums(query, options = {}) {
        const api = this.getAPI();
        if (typeof api.searchAlbums === 'function') return api.searchAlbums(query, options);
        const res = await api.search(query, options);
        return res?.albums || { items: [] };
    }

    async searchPlaylists(query, options = {}) {
        const api = this.getAPI();
        if (typeof api.searchPlaylists === 'function') {
            return api.searchPlaylists(query, options);
        }
        return { items: [] };
    }

    async searchVideos(query, options = {}) {
        const api = this.getAPI();
        if (typeof api.searchVideos === 'function') {
            return api.searchVideos(query, options);
        }
        return { items: [] };
    }

    async searchPodcasts(query, options = {}) {
        return this.podcastsAPI.searchPodcasts(query, options);
    }

    async getPodcast(id, options = {}) {
        return this.podcastsAPI.getPodcastById(id, options);
    }

    async getPodcastEpisodes(id, options = {}) {
        return this.podcastsAPI.getPodcastEpisodes(id, options);
    }

    async getTrendingPodcasts(options = {}) {
        return this.podcastsAPI.getTrendingPodcasts(options);
    }

    // Get methods
    async getTrack(id, quality) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getTrack(cleanId, quality);
    }

    async getTrackMetadata(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getTrackMetadata(cleanId);
    }

    async getAlbum(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getAlbum(cleanId);
    }

    async getArtist(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getArtist(cleanId);
    }

    async getArtistBiography(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        if (typeof api.getArtistBiography === 'function') {
            return api.getArtistBiography(cleanId);
        }
        return null;
    }

    async getVideo(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getVideo(cleanId);
    }

    async getVideoStreamUrl(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        if (typeof api.getVideoStreamUrl === 'function') {
            return api.getVideoStreamUrl(cleanId);
        }
    }

    async getArtistSocials(artistName) {
        const api = this.getAPI();
        if (typeof api.getArtistSocials === 'function') {
            return api.getArtistSocials(artistName);
        }
        return [];
    }

    async getPlaylist(id, _provider = null) {
        // Local playlists only
        return null;
    }

    async getMix() {
        return null;
    }

    async getTrackRecommendations(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        if (typeof api.getTrackRecommendations === 'function') {
            return api.getTrackRecommendations(cleanId);
        }
        return [];
    }

    async getHomeContent() {
        const api = this.getAPI();
        if (typeof api.getHomeContent === 'function') {
            return api.getHomeContent();
        }
        return [];
    }

    // Stream methods
    async getStreamUrl(id, quality) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getStreamUrl(cleanId, quality);
    }

    // Cover/artwork methods
    getCoverUrl(id, size = '320') {
        if (typeof id === 'string' && id.startsWith('blob:')) {
            return id;
        }
        const api = this.getAPI();
        if (typeof api.getCoverUrl === 'function') {
            return api.getCoverUrl(this.stripProviderPrefix(id), size);
        }
        return 'assets/1024w_new.png';
    }

    getCoverSrcset(id) {
        if (typeof id === 'string' && id.startsWith('blob:')) {
            return '';
        }
        const api = this.getAPI();
        if (typeof api.getCoverSrcset === 'function') {
            return api.getCoverSrcset(this.stripProviderPrefix(id));
        }
        return '';
    }

    getVideoCoverUrl(imageId, size = '1280') {
        if (!imageId) {
            return null;
        }
        if (typeof imageId === 'string' && imageId.startsWith('blob:')) {
            return imageId;
        }
        const api = this.getAPI();
        if (typeof api.getVideoCoverUrl === 'function') {
            return api.getVideoCoverUrl(this.stripProviderPrefix(imageId), size);
        }
        return 'assets/1024w_new.png';
    }

    async getVideoArtwork(title, artist) {
        return null; // Disabled for offline-first mode
    }

    async getLyrics(id) {
        const api = this.getAPI();
        if (typeof api.getLyrics === 'function') {
            return api.getLyrics(id);
        }
        return null;
    }

    getArtistPictureUrl(id, size = '320') {
        const api = this.getAPI();
        if (typeof api.getArtistPictureUrl === 'function') {
            return api.getArtistPictureUrl(this.stripProviderPrefix(id), size);
        }
        return 'assets/1024w_new.png';
    }

    getArtistPictureSrcset(id) {
        const api = this.getAPI();
        if (typeof api.getArtistPictureSrcset === 'function') {
            return api.getArtistPictureSrcset(this.stripProviderPrefix(id));
        }
        return '';
    }

    async getArtistBanner(artistName) {
        return null; // Disabled for offline-first mode
    }

    extractStreamUrlFromManifest(manifest) {
        return this.tidalAPI.extractStreamUrlFromManifest(manifest);
    }

    // Helper methods
    getProviderFromId(id) {
        if (typeof id === 'string') {
            if (id.startsWith('t:')) return 'tidal';
        }
        return null;
    }

    stripProviderPrefix(id) {
        if (typeof id === 'string') {
            if (id.startsWith('q:') || id.startsWith('t:')) {
                return id.slice(2);
            }
        }
        return id;
    }

    // Download methods
    async downloadTrack(id, quality, filename, options = {}) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.downloadTrack(cleanId, quality, filename, options);
    }

    // Similar/recommendation methods
    async getSimilarArtists(artistId) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(artistId);
        return api.getSimilarArtists(cleanId);
    }

    async getArtistTopTracks(artistId, options = {}) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(artistId);
        if (typeof api.getArtistTopTracks === 'function') return api.getArtistTopTracks(cleanId, options);
        return [];
    }

    async getSimilarAlbums(albumId) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(albumId);
        return api.getSimilarAlbums(cleanId);
    }

    async getRecommendedTracksForPlaylist(tracks, limit = 20, options = {}) {
        const api = this.getAPI();
        if (typeof api.getRecommendedTracksForPlaylist === 'function') {
            return api.getRecommendedTracksForPlaylist(tracks, limit, options);
        }
        return [];
    }

    // Cache methods
    async clearCache() {
        // No-op for local mode
    }

    getCacheStats() {
        return {};
    }

    // Settings accessor for compatibility
    get settings() {
        return this._settings;
    }
}

// Neutralized for offline-first local media ecosystem

export class MultiScrobbler {
    constructor() {
        this.lastfm = { isAuthenticated: () => false };
        this.librefm = { isAuthenticated: () => false };
    }
    getLastFM() { return this.lastfm; }
    getLibreFm() { return this.librefm; }
    isAuthenticated() { return false; }
    async updateNowPlaying(track) {}
    async onTrackChange(track) {}
    onPlaybackStop() {}
    async loveTrack(track) {}
}

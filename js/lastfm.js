export class LastFmScrobbler {
    constructor() {
        this.enabled = false;
    }
    async scrobble() {}
    async nowPlaying() {}
    async getSession() { return null; }
    init() {}
}

export const lastfm = new LastFmScrobbler();

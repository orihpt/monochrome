export class LibreFmScrobbler {
    constructor() {
        this.enabled = false;
    }
    async scrobble() {}
    async nowPlaying() {}
    async getSession() { return null; }
}

export const librefm = new LibreFmScrobbler();

export class MalojaScrobbler {
    constructor() {
        this.enabled = false;
    }
    async scrobble() {}
    async nowPlaying() {}
}

export const maloja = new MalojaScrobbler();

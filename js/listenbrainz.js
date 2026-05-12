export class ListenBrainzScrobbler {
    constructor() {
        this.enabled = false;
    }
    async scrobble() {}
    async nowPlaying() {}
}

export const listenbrainz = new ListenBrainzScrobbler();

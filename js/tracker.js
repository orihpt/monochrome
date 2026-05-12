// Neutralized for offline-first local media ecosystem
export const listeningTracker = {
    init: () => {},
    onTrackStart: () => {},
    onTrackEnd: () => {},
    forceFlush: () => {},
    updateActivity: () => {},
};
export async function initTracker() {}

export async function renderUnreleasedPage() {}
export async function renderTrackerArtistPage() {}
export async function renderTrackerProjectPage() {}
export async function renderTrackerTrackPage() {}
export async function findTrackerArtistByName() { return null; }
export async function getArtistUnreleasedProjects() { return []; }
export function createProjectCardHTML() { return ''; }
export function createTrackFromSong() { return null; }

import { describe, expect, test } from 'vitest';
import { HiFiClient } from './HiFi';

describe('HiFiClient offline mode', () => {
    test('does not fetch a TIDAL token when offline APIs are disabled', async () => {
        const client = new HiFiClient();

        await expect(client.fetchToken()).resolves.toBeNull();
        expect(client.token).toBeNull();
    });

    test.each([
        ['track info', () => new HiFiClient().getInfo(463900720)],
        ['track playback', () => new HiFiClient().getTrack(31097949)],
        ['similar artists', () => new HiFiClient().getSimilarArtists(3523908)],
        ['similar albums', () => new HiFiClient().getSimilarAlbums(433360012)],
        ['artist info', () => new HiFiClient().getArtist(3523908)],
        ['search', () => new HiFiClient().search({ q: 'deadmau5' })],
        ['album info', () => new HiFiClient().getAlbum(433360012)],
        ['playlist info', () => new HiFiClient().getPlaylist('36ea71a8-445e-41a4-82ab-6628c581535d')],
        ['video playback', () => new HiFiClient().getVideo(466464180)],
        ['track manifest', () => new HiFiClient().getTrackManifest(31097949)],
    ])('blocks external %s requests', async (_name, request) => {
        await expect(request()).rejects.toThrow('External API calls disabled in offline mode');
    });
});

import { afterEach, describe, expect, test, vi } from 'vitest';
import { SubsonicAPI } from './subsonic-api.js';

describe('SubsonicAPI recommendations capability', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    test('does not request recommendation endpoints when backend disables recommendations', async () => {
        localStorage.setItem('subsonic_user', 'admin');
        localStorage.setItem('subsonic_pass', 'password');
        localStorage.setItem('navidrome_native_token', 'token');

        const fetchMock = vi.fn(async (url) => {
            if (url === '/api/features') {
                return new Response(JSON.stringify({ id: 'features', features: { recommendations: false } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`Unexpected request: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const api = new SubsonicAPI();

        await expect(api.checkRecommendationStatus()).resolves.toBe(false);
        await expect(api.getRecommendedTracksForPlaylist([{ id: 'track-1' }])).resolves.toEqual([]);
        await expect(api.getSimilarAlbums('album-1')).resolves.toEqual([]);
        await expect(api.getSimilarArtists('artist-1')).resolves.toEqual([]);
        await expect(api.getTrackRecommendations('track-1')).resolves.toEqual([]);
        await expect(api.recordRecommendationEvent({ track_id: 'track-1' })).resolves.toBeNull();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/api/features', expect.any(Object));
    });
});

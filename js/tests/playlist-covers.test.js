import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MusicDatabase } from '../db.js';
import {
    applyPlaylistCoverMetadata,
    createAlbumGridHTML,
    createStylishCoverHTML,
    normalizePlaylistCover,
    PlaylistCoverPicker,
    PLAYLIST_COVER_TYPE_ALBUM_GRID,
    PLAYLIST_COVER_TYPE_STYLISH,
    PLAYLIST_COVER_TYPE_UPLOADED,
} from '../playlist-covers.js';

describe('playlist covers', () => {
    let db;
    const api = { getCoverUrl: (id) => `/cover/${id}` };

    beforeEach(async () => {
        db = new MusicDatabase();
        db.dbName = `PlaylistCoverTest-${crypto.randomUUID()}`;
        await db.open();
        document.body.innerHTML = '';
    });

    test('default cover is album grid and existing playlists without metadata render as album grid', async () => {
        const playlist = await db.createPlaylist('Grid', [{ id: 't1', album: { cover: 'a1' } }]);

        expect(playlist.coverMetadata.coverType).toBe(PLAYLIST_COVER_TYPE_ALBUM_GRID);
        expect(normalizePlaylistCover({ name: 'Legacy', tracks: [] }).coverType).toBe(PLAYLIST_COVER_TYPE_ALBUM_GRID);
        expect(createAlbumGridHTML(playlist, api)).toContain('playlist-cover-album-grid');
        expect(createAlbumGridHTML(playlist, api)).toContain('/cover/a1');
    });

    test('album grid persists and updates dynamically when playlist songs change', async () => {
        const playlist = await db.createPlaylist('Dynamic', [{ id: 't1', album: { cover: 'a1' } }]);
        await db.addTrackToPlaylist(playlist.id, { id: 't2', album: { cover: 'a2' } });

        const updated = await db.getPlaylist(playlist.id);
        expect(updated.coverMetadata.coverType).toBe(PLAYLIST_COVER_TYPE_ALBUM_GRID);
        expect(updated.images).toEqual(['a1', 'a2']);
    });

    test('stylish cover persists only asset name and colors, and renders playlist name', async () => {
        const playlist = { name: 'Night Drive' };
        applyPlaylistCoverMetadata(playlist, {
            coverType: PLAYLIST_COVER_TYPE_STYLISH,
            stylishAssetName: 'clockish',
            gradientColorA: '#ffffff',
            gradientColorB: '#000000',
        });

        expect(playlist.coverMetadata).toEqual({
            coverType: PLAYLIST_COVER_TYPE_STYLISH,
            stylishAssetName: 'clockish',
            gradientColorA: '#ffffff',
            gradientColorB: '#000000',
        });
        expect(JSON.stringify(playlist.coverMetadata)).not.toContain('data:image');
        const html = createStylishCoverHTML(playlist, playlist.coverMetadata);
        expect(html).toContain('/assets/playlists/clockish.png');
        expect(html).toContain('Night Drive');
    });

    test('uploaded image metadata persists and deleting playlist does not delete songs or stylish assets', async () => {
        const blob = new Blob(['cover'], { type: 'image/jpeg' });
        await db.putPlaylistCoverBlob('indexeddb:cover-1', blob);
        const track = { id: 'song-1', album: { cover: 'album-1' } };
        const playlist = await db.createPlaylist('Uploaded', [track], '', '', {
            coverType: PLAYLIST_COVER_TYPE_UPLOADED,
            uploadedCoverId: 'indexeddb:cover-1',
        });

        expect(playlist.coverMetadata.uploadedCoverId).toBe('indexeddb:cover-1');
        expect((await db.getPlaylistCoverBlob('indexeddb:cover-1')).type).toBe('image/jpeg');
        await db.deletePlaylist(playlist.id);
        expect(track.id).toBe('song-1');
        expect('/assets/playlists/clockish.png').toContain('clockish');
    });

    test('modal picker selection, color picker visibility, checkmark, and live stylish title update', async () => {
        mountPickerDom();
        const picker = new PlaylistCoverPicker({ db, api });
        picker.bind();
        await picker.reset({ name: 'Start', tracks: [{ album: { cover: 'a1' } }] });

        expect(document.querySelector('.playlist-cover-picker')).toBeTruthy();
        expect(document.querySelector('.playlist-cover-color-picker').closest('[hidden]')).toBeTruthy();
        expect(document.querySelector('.playlist-cover-option-selected .playlist-cover-checkmark')).toBeTruthy();

        document.querySelector('[data-cover-type="stylish"][data-asset-name="clockish"]').click();
        expect(picker.getMetadata().coverType).toBe(PLAYLIST_COVER_TYPE_STYLISH);
        expect(document.getElementById('playlist-cover-color-controls').hidden).toBe(false);
        expect(document.querySelector('.playlist-cover-option-selected .playlist-cover-checkmark')).toBeTruthy();

        document.getElementById('playlist-name-input').value = 'Live Title';
        document.getElementById('playlist-name-input').dispatchEvent(new Event('input'));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(document.querySelector('.playlist-cover-option-selected .playlist-cover-stylish-title').textContent).toBe(
            'Live Title'
        );

        document.querySelector('[data-cover-type="albumGrid"]').click();
        expect(document.getElementById('playlist-cover-color-controls').hidden).toBe(true);
    });

    test('uploaded image flow opens crop dialog and saving creates a 1:1 uploaded cover option', async () => {
        mountPickerDom();
        const picker = new PlaylistCoverPicker({ db, api });
        picker.bind();
        await picker.reset({ name: 'Crop' });
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect: vi.fn(),
            drawImage: vi.fn(),
            fillStyle: '',
        });
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
            callback(new Blob(['cropped'], { type: 'image/jpeg' }));
        });

        picker.openCropDialog(tinyPng());
        expect(document.querySelector('.playlist-cover-crop-dialog.active')).toBeTruthy();
        picker.cropState.naturalWidth = 10;
        picker.cropState.naturalHeight = 10;
        Object.defineProperty(document.querySelector('.playlist-cover-crop-frame'), 'clientWidth', { value: 100 });
        await picker.saveCrop();

        const metadata = picker.getMetadata();
        expect(metadata.coverType).toBe(PLAYLIST_COVER_TYPE_UPLOADED);
        expect(metadata.uploadedCoverId).toMatch(/^indexeddb:/);
        expect(document.querySelector('[data-cover-type="uploaded"]')).toBeTruthy();
        expect(document.querySelector('.playlist-cover-crop-dialog.active')).toBeFalsy();
        expect((await db.getPlaylistCoverBlob(metadata.uploadedCoverId)).type).toBe('image/jpeg');
    });
});

function mountPickerDom() {
    document.body.innerHTML = `
        <section class="playlist-cover-picker">
            <div id="playlist-cover-options"></div>
            <div id="playlist-cover-color-controls" hidden>
                <label class="playlist-cover-color-picker"><input id="playlist-cover-color-a" type="color" value="#00a6c8"></label>
                <label class="playlist-cover-color-picker"><input id="playlist-cover-color-b" type="color" value="#ff8f98"></label>
            </div>
        </section>
        <input id="playlist-name-input" value="">
        <input id="playlist-cover-file-input" type="file">
        <div id="playlist-cover-crop-dialog" class="modal playlist-cover-crop-dialog" aria-hidden="true">
            <div class="playlist-cover-crop-frame"><img id="playlist-cover-crop-image"></div>
            <input id="playlist-cover-crop-zoom" type="range" value="1">
            <button id="playlist-cover-crop-save"></button>
            <button id="playlist-cover-crop-cancel"></button>
        </div>
    `;
}

function tinyPng() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
}

import { SVG_CHECK, SVG_UPLOAD } from './icons.js';

export const PLAYLIST_COVER_TYPE_ALBUM_GRID = 'albumGrid';
export const PLAYLIST_COVER_TYPE_UPLOADED = 'uploaded';
export const PLAYLIST_COVER_TYPE_STYLISH = 'stylish';

export const STYLISH_PLAYLIST_ASSETS = [
    'blob',
    'clockish',
    'mesh',
    'splitlit',
    'thelight',
    'circles',
    'discus',
    'skylines',
    'squarewaves',
];

const DEFAULT_COLOR_A = '#00a6c8';
const DEFAULT_COLOR_B = '#ff8f98';
const UPLOADED_PREFIX = 'indexeddb:';

export function stylishAssetUrl(assetName) {
    const safeName = STYLISH_PLAYLIST_ASSETS.includes(assetName) ? assetName : STYLISH_PLAYLIST_ASSETS[0];
    return `/assets/playlists/${safeName}.png`;
}

export function normalizePlaylistCover(playlist = {}) {
    const legacyCover = playlist.cover || playlist.image || '';
    const raw = playlist.coverMetadata || playlist.coverMeta || playlist.playlistCover || null;
    const coverType = raw?.coverType || playlist.coverType || (legacyCover ? PLAYLIST_COVER_TYPE_UPLOADED : PLAYLIST_COVER_TYPE_ALBUM_GRID);
    if (coverType === PLAYLIST_COVER_TYPE_STYLISH) {
        const stylishAssetName = STYLISH_PLAYLIST_ASSETS.includes(raw?.stylishAssetName || playlist.stylishAssetName)
            ? raw?.stylishAssetName || playlist.stylishAssetName
            : STYLISH_PLAYLIST_ASSETS[0];
        return {
            coverType: PLAYLIST_COVER_TYPE_STYLISH,
            stylishAssetName,
            gradientColorA: normalizeHex(raw?.gradientColorA || playlist.gradientColorA, DEFAULT_COLOR_A),
            gradientColorB: normalizeHex(raw?.gradientColorB || playlist.gradientColorB, DEFAULT_COLOR_B),
        };
    }
    if (coverType === PLAYLIST_COVER_TYPE_UPLOADED && (raw?.uploadedCoverId || playlist.uploadedCoverId || legacyCover)) {
        const uploadedCoverId = raw?.uploadedCoverId || playlist.uploadedCoverId || legacyCover;
        return {
            coverType: PLAYLIST_COVER_TYPE_UPLOADED,
            uploadedCoverId,
        };
    }
    return { coverType: PLAYLIST_COVER_TYPE_ALBUM_GRID };
}

export function applyPlaylistCoverMetadata(playlist, metadata) {
    const normalized = normalizePlaylistCover({ coverMetadata: metadata });
    playlist.coverMetadata = normalized;
    playlist.coverType = normalized.coverType;
    playlist.stylishAssetName = normalized.stylishAssetName || '';
    playlist.gradientColorA = normalized.gradientColorA || '';
    playlist.gradientColorB = normalized.gradientColorB || '';
    playlist.uploadedCoverId = normalized.uploadedCoverId || '';
    playlist.cover = normalized.coverType === PLAYLIST_COVER_TYPE_UPLOADED ? normalized.uploadedCoverId : '';
    return playlist;
}

export function makeUploadedCoverId(id = crypto.randomUUID()) {
    return `${UPLOADED_PREFIX}${id}`;
}

export function isIndexedDbCoverId(id) {
    return typeof id === 'string' && id.startsWith(UPLOADED_PREFIX);
}

export function uploadedCoverStorageKey(id) {
    return isIndexedDbCoverId(id) ? id.slice(UPLOADED_PREFIX.length) : id;
}

export function playlistTitleColor(colorA, colorB) {
    const a = relativeLuminance(hexToRgb(normalizeHex(colorA, DEFAULT_COLOR_A)));
    const b = relativeLuminance(hexToRgb(normalizeHex(colorB, DEFAULT_COLOR_B)));
    return (a + b) / 2 > 0.58 ? '#101010' : '#ffffff';
}

export function getPlaylistAlbumCovers(playlist = []) {
    const tracks = Array.isArray(playlist) ? playlist : playlist.tracks || [];
    const uniqueCovers = [...(Array.isArray(playlist.images) ? playlist.images : [])];
    const seen = new Set(uniqueCovers.filter(Boolean));
    for (const track of tracks) {
        const cover = track?.album?.cover || track?.image || track?.cover;
        if (cover && !seen.has(cover)) {
            seen.add(cover);
            uniqueCovers.push(cover);
            if (uniqueCovers.length >= 4) break;
        }
    }
    return uniqueCovers.filter(Boolean).slice(0, 4);
}

export function createAlbumGridHTML(playlist, api, loading = 'lazy') {
    const covers = getPlaylistAlbumCovers(playlist);
    const tiles = [];
    for (let i = 0; i < 4; i += 1) {
        const cover = covers.length ? covers[i % covers.length] : null;
        if (cover) {
            tiles.push(`<img src="${api.getCoverUrl(cover)}" alt="" loading="${loading}" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className: 'playlist-cover-grid-placeholder'}))">`);
        } else {
            tiles.push('<div class="playlist-cover-grid-placeholder"></div>');
        }
    }
    return `<div class="playlist-cover-album-grid">${tiles.join('')}</div>`;
}

export function createStylishCoverHTML(playlist, metadata = normalizePlaylistCover(playlist), extraClass = '') {
    const name = escapeHtml(playlist?.name || playlist?.title || 'פלייליסט חדש');
    const colorA = normalizeHex(metadata.gradientColorA, DEFAULT_COLOR_A);
    const colorB = normalizeHex(metadata.gradientColorB, DEFAULT_COLOR_B);
    const titleColor = playlistTitleColor(colorA, colorB);
    const titleSize = stylishTitleSize(playlist?.name || playlist?.title || 'פלייליסט חדש', extraClass);
    return `
        <div class="playlist-cover-stylish ${extraClass}" style="--cover-color-a: ${colorA}; --cover-color-b: ${colorB}; --cover-title-color: ${titleColor}; --cover-title-size: ${titleSize};">
            <img src="${stylishAssetUrl(metadata.stylishAssetName)}" alt="" loading="lazy">
            <div class="playlist-cover-stylish-title">${name}</div>
        </div>
    `;
}

export async function createStylishCoverDataUrl(playlist, metadata = normalizePlaylistCover(playlist), size = 640) {
    if (typeof document === 'undefined') return '';
    const colorA = normalizeHex(metadata.gradientColorA, DEFAULT_COLOR_A);
    const colorB = normalizeHex(metadata.gradientColorB, DEFAULT_COLOR_B);
    const title = playlist?.name || playlist?.title || 'פלייליסט חדש';
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const gradient = ctx.createLinearGradient(0, 0, size, size * 1.85);
    gradient.addColorStop(0, colorA);
    gradient.addColorStop(1, colorB);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const img = await loadImage(stylishAssetUrl(metadata.stylishAssetName)).catch(() => null);
    if (img) {
        ctx.globalAlpha = 0.72;
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img, 0, 0, size, size);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = playlistTitleColor(colorA, colorB);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `800 ${parseInt(stylishTitleSize(title, 'playlist-cover-detail-rendered'), 10) * 2.5}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
    wrapCanvasText(ctx, title, size - 48, 44, size - 88, size * 0.5);
    return canvas.toDataURL('image/png');
}

export async function createPlaylistCoverHTML(playlist, api, db, className = 'card-image', loading = 'lazy') {
    const metadata = normalizePlaylistCover(playlist);
    const safeName = escapeHtml(playlist?.name || playlist?.title || '');
    if (metadata.coverType === PLAYLIST_COVER_TYPE_STYLISH) {
        return createStylishCoverHTML(playlist, metadata, `${className} playlist-cover-rendered playlist-cover-preview`);
    }
    if (metadata.coverType === PLAYLIST_COVER_TYPE_UPLOADED && metadata.uploadedCoverId) {
        const src = await resolveUploadedCoverUrl(metadata.uploadedCoverId, db);
        if (src) {
            return `<img src="${src}" alt="${safeName}" class="${className} playlist-cover-rendered playlist-cover-uploaded" loading="${loading}" onerror="this.src='/assets/no_album_cover.png'; this.classList.add('playlist-cover-broken')">`;
        }
    }
    return `<div class="${className} playlist-cover-rendered playlist-cover-preview">${createAlbumGridHTML(playlist, api, loading)}</div>`;
}

export async function resolveUploadedCoverUrl(id, db) {
    if (!id) return '';
    if (!isIndexedDbCoverId(id)) return id;
    const blob = await db.getPlaylistCoverBlob(id).catch(() => null);
    return blob ? URL.createObjectURL(blob) : '';
}

export class PlaylistCoverPicker {
    constructor({ db, api, onChange = () => {} }) {
        this.db = db;
        this.api = api;
        this.onChange = onChange;
        this.playlist = {};
        this.metadata = { coverType: PLAYLIST_COVER_TYPE_ALBUM_GRID };
        this.uploadedCoverId = '';
        this.cropState = null;
        this.dragState = null;
    }

    bind() {
        this.optionsEl = document.getElementById('playlist-cover-options');
        this.nameInput = document.getElementById('playlist-name-input');
        this.fileInput = document.getElementById('playlist-cover-file-input');
        this.colorControls = document.getElementById('playlist-cover-color-controls');
        this.colorAInput = document.getElementById('playlist-cover-color-a');
        this.colorBInput = document.getElementById('playlist-cover-color-b');
        this.cropDialog = document.getElementById('playlist-cover-crop-dialog');
        this.cropImage = document.getElementById('playlist-cover-crop-image');
        this.cropFrame = this.cropDialog?.querySelector('.playlist-cover-crop-frame');
        this.cropZoom = document.getElementById('playlist-cover-crop-zoom');
        this.cropSave = document.getElementById('playlist-cover-crop-save');
        this.cropCancel = document.getElementById('playlist-cover-crop-cancel');

        this.optionsEl?.addEventListener('click', (event) => this.handleOptionClick(event));
        this.fileInput?.addEventListener('change', (event) => this.handleFileChange(event));
        this.nameInput?.addEventListener('input', () => this.render());
        this.colorAInput?.addEventListener('input', () => this.updateStylishColors());
        this.colorBInput?.addEventListener('input', () => this.updateStylishColors());
        this.cropZoom?.addEventListener('input', () => this.updateCropTransform());
        this.cropSave?.addEventListener('click', () => this.saveCrop());
        this.cropCancel?.addEventListener('click', () => this.closeCropDialog());
        this.cropFrame?.addEventListener('pointerdown', (event) => this.startCropDrag(event));
        window.addEventListener('pointermove', (event) => this.moveCropDrag(event));
        window.addEventListener('pointerup', () => this.endCropDrag());
    }

    async reset(playlist = {}) {
        this.playlist = playlist || {};
        this.metadata = normalizePlaylistCover(playlist);
        this.uploadedCoverId = this.metadata.coverType === PLAYLIST_COVER_TYPE_UPLOADED ? this.metadata.uploadedCoverId : '';
        this.colorAInput && (this.colorAInput.value = this.metadata.gradientColorA || DEFAULT_COLOR_A);
        this.colorBInput && (this.colorBInput.value = this.metadata.gradientColorB || DEFAULT_COLOR_B);
        await this.render();
    }

    getMetadata() {
        if (this.metadata.coverType === PLAYLIST_COVER_TYPE_STYLISH) {
            return {
                coverType: PLAYLIST_COVER_TYPE_STYLISH,
                stylishAssetName: this.metadata.stylishAssetName || STYLISH_PLAYLIST_ASSETS[0],
                gradientColorA: this.colorAInput?.value || DEFAULT_COLOR_A,
                gradientColorB: this.colorBInput?.value || DEFAULT_COLOR_B,
            };
        }
        if (this.metadata.coverType === PLAYLIST_COVER_TYPE_UPLOADED && this.uploadedCoverId) {
            return {
                coverType: PLAYLIST_COVER_TYPE_UPLOADED,
                uploadedCoverId: this.uploadedCoverId,
            };
        }
        return { coverType: PLAYLIST_COVER_TYPE_ALBUM_GRID };
    }

    async render() {
        if (!this.optionsEl) return;
        const selected = this.getMetadata();
        this.metadata = selected;
        if (this.colorControls) this.colorControls.hidden = selected.coverType !== PLAYLIST_COVER_TYPE_STYLISH;
        const draft = {
            ...this.playlist,
            name: this.nameInput?.value || this.playlist.name || 'פלייליסט חדש',
            coverMetadata: selected,
        };
        const uploadHTML = this.uploadedCoverId
            ? `<button type="button" class="playlist-cover-option ${selected.coverType === PLAYLIST_COVER_TYPE_UPLOADED ? 'playlist-cover-option-selected' : ''}" data-cover-type="${PLAYLIST_COVER_TYPE_UPLOADED}">
                    <div class="playlist-cover-preview playlist-cover-uploaded">${await uploadedImgHTML(this.uploadedCoverId, this.db)}</div>${checkmarkHTML()}
                </button>`
            : `<button type="button" class="playlist-cover-option playlist-cover-upload-btn" data-cover-action="upload">
                    <div class="playlist-cover-preview">${SVG_UPLOAD(32)}</div>${checkmarkHTML()}
                </button>`;
        const albumGridHTML = `<button type="button" class="playlist-cover-option ${selected.coverType === PLAYLIST_COVER_TYPE_ALBUM_GRID ? 'playlist-cover-option-selected' : ''}" data-cover-type="${PLAYLIST_COVER_TYPE_ALBUM_GRID}">
                <div class="playlist-cover-preview">${createAlbumGridHTML(draft, this.api)}</div>${checkmarkHTML()}
            </button>`;
        const stylishHTML = STYLISH_PLAYLIST_ASSETS.map((assetName) => {
            const isSelected = selected.coverType === PLAYLIST_COVER_TYPE_STYLISH && selected.stylishAssetName === assetName;
            const metadata = {
                coverType: PLAYLIST_COVER_TYPE_STYLISH,
                stylishAssetName: assetName,
                gradientColorA: this.colorAInput?.value || selected.gradientColorA || DEFAULT_COLOR_A,
                gradientColorB: this.colorBInput?.value || selected.gradientColorB || DEFAULT_COLOR_B,
            };
            return `<button type="button" class="playlist-cover-option ${isSelected ? 'playlist-cover-option-selected' : ''}" data-cover-type="${PLAYLIST_COVER_TYPE_STYLISH}" data-asset-name="${assetName}">
                    <div class="playlist-cover-preview">${createStylishCoverHTML(draft, metadata)}</div>${checkmarkHTML()}
                </button>`;
        }).join('');
        this.optionsEl.innerHTML = `${albumGridHTML}${uploadHTML}${stylishHTML}`;
        this.onChange(this.getMetadata());
    }

    handleOptionClick(event) {
        const option = event.target.closest('.playlist-cover-option');
        if (!option) return;
        if (option.dataset.coverAction === 'upload') {
            this.fileInput?.click();
            return;
        }
        const coverType = option.dataset.coverType;
        if (coverType === PLAYLIST_COVER_TYPE_STYLISH) {
            this.metadata = {
                coverType,
                stylishAssetName: option.dataset.assetName,
                gradientColorA: this.colorAInput?.value || DEFAULT_COLOR_A,
                gradientColorB: this.colorBInput?.value || DEFAULT_COLOR_B,
            };
        } else if (coverType === PLAYLIST_COVER_TYPE_UPLOADED) {
            this.metadata = { coverType, uploadedCoverId: this.uploadedCoverId };
        } else {
            this.metadata = { coverType: PLAYLIST_COVER_TYPE_ALBUM_GRID };
        }
        this.render();
    }

    updateStylishColors() {
        if (this.metadata.coverType !== PLAYLIST_COVER_TYPE_STYLISH) return;
        this.metadata.gradientColorA = this.colorAInput?.value || DEFAULT_COLOR_A;
        this.metadata.gradientColorB = this.colorBInput?.value || DEFAULT_COLOR_B;
        this.render();
    }

    handleFileChange(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => this.openCropDialog(reader.result);
        reader.readAsDataURL(file);
    }

    openCropDialog(src) {
        this.cropState = { src, zoom: 1, x: 0, y: 0, naturalWidth: 1, naturalHeight: 1 };
        this.cropImage.src = src;
        this.cropZoom.value = '1';
        this.cropImage.onload = () => {
            this.cropState.naturalWidth = this.cropImage.naturalWidth;
            this.cropState.naturalHeight = this.cropImage.naturalHeight;
            this.updateCropTransform();
        };
        this.cropDialog.classList.add('active');
        this.cropDialog.setAttribute('aria-hidden', 'false');
    }

    closeCropDialog() {
        this.cropDialog.classList.remove('active');
        this.cropDialog.setAttribute('aria-hidden', 'true');
        this.fileInput.value = '';
        this.cropState = null;
    }

    updateCropTransform() {
        if (!this.cropState || !this.cropFrame) return;
        const frameSize = this.cropFrame.clientWidth || 320;
        const baseScale = Math.max(frameSize / this.cropState.naturalWidth, frameSize / this.cropState.naturalHeight);
        const zoom = Number(this.cropZoom.value || 1);
        this.cropState.zoom = zoom;
        const width = this.cropState.naturalWidth * baseScale * zoom;
        const height = this.cropState.naturalHeight * baseScale * zoom;
        this.cropImage.style.width = `${width}px`;
        this.cropImage.style.height = `${height}px`;
        this.cropImage.style.transform = `translate(calc(-50% + ${this.cropState.x}px), calc(-50% + ${this.cropState.y}px))`;
    }

    startCropDrag(event) {
        if (!this.cropState) return;
        this.cropFrame.classList.add('dragging');
        this.dragState = {
            startX: event.clientX,
            startY: event.clientY,
            x: this.cropState.x,
            y: this.cropState.y,
        };
        this.cropFrame.setPointerCapture?.(event.pointerId);
    }

    moveCropDrag(event) {
        if (!this.dragState || !this.cropState) return;
        this.cropState.x = this.dragState.x + event.clientX - this.dragState.startX;
        this.cropState.y = this.dragState.y + event.clientY - this.dragState.startY;
        this.updateCropTransform();
    }

    endCropDrag() {
        this.cropFrame?.classList.remove('dragging');
        this.dragState = null;
    }

    async saveCrop() {
        if (!this.cropState || !this.cropFrame) return;
        const frameSize = this.cropFrame.clientWidth || 320;
        const outputSize = 640;
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');
        const image = this.cropImage;
        const drawnWidth = parseFloat(image.style.width);
        const drawnHeight = parseFloat(image.style.height);
        const scale = outputSize / frameSize;
        const dx = (frameSize - drawnWidth) / 2 + this.cropState.x;
        const dy = (frameSize - drawnHeight) / 2 + this.cropState.y;
        ctx.fillStyle = '#181818';
        ctx.fillRect(0, 0, outputSize, outputSize);
        ctx.drawImage(image, dx * scale, dy * scale, drawnWidth * scale, drawnHeight * scale);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        if (!blob) return;
        const id = makeUploadedCoverId();
        await this.db.putPlaylistCoverBlob(id, blob);
        this.uploadedCoverId = id;
        this.metadata = { coverType: PLAYLIST_COVER_TYPE_UPLOADED, uploadedCoverId: id };
        this.closeCropDialog();
        await this.render();
    }
}

async function uploadedImgHTML(id, db) {
    const src = await resolveUploadedCoverUrl(id, db);
    return src
        ? `<img src="${src}" alt="" loading="lazy">`
        : '<div class="playlist-cover-grid-placeholder" style="width:100%;height:100%"></div>';
}

function checkmarkHTML() {
    return `<span class="playlist-cover-checkmark">${SVG_CHECK(16)}</span>`;
}

function stylishTitleSize(title, extraClass = '') {
    const length = String(title || '').trim().length;
    const isDetail = extraClass.includes('playlist-cover-detail-rendered');
    const isSidebar = extraClass.includes('sidebar-library-item-cover') || extraClass.includes('pinned-item-cover');
    const max = isDetail ? 34 : isSidebar ? 9 : 16;
    const min = isDetail ? 18 : isSidebar ? 6 : 9;
    const divisor = isDetail ? 1.9 : isSidebar ? 4.4 : 2.6;
    const size = Math.max(min, Math.min(max, Math.round(max - Math.max(0, length - 12) / divisor)));
    return `${size}px`;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

function wrapCanvasText(ctx, text, x, y, maxWidth, maxHeight) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = testLine;
        }
    }
    if (line) lines.push(line);
    const lineHeight = parseInt(ctx.font.match(/(\d+)px/)?.[1] || '48', 10) * 1.05;
    const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
    lines.slice(0, maxLines).forEach((lineText, index) => ctx.fillText(lineText, x, y + index * lineHeight, maxWidth));
}

function normalizeHex(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
}

function hexToRgb(hex) {
    const value = normalizeHex(hex, '#000000').slice(1);
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
    };
}

function relativeLuminance({ r, g, b }) {
    const convert = (channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
}

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

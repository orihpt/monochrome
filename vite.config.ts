import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import authGatePlugin from './vite-plugin-auth-gate.js';
import blobAssetPlugin from './vite-plugin-blob.js';
import svgUse from './vite-plugin-svg-use.js';
import uploadPlugin from './vite-plugin-upload.js';
// import purgecss from 'vite-plugin-purgecss';
import { playwright } from '@vitest/browser-playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import purgecss from 'vite-plugin-purgecss';

const navidromeUrl = process.env.NAVIDROME_URL || 'http://127.0.0.1:4533';

function proxyAudioPlugin() {
    return {
        name: 'proxy-audio-dev',
        configureServer(server) {
            // No longer needed: local proxy-audio middleware replaced by remote proxy
        },
    };
}

function getGitCommitHash() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return 'unknown';
    }
}

export default defineConfig((_options) => {
    const commitHash = getGitCommitHash();
    const offlineMode = true;
    const enableTidalApi = false;
    const enableExternalApiInstances = false;
    const enableExternalAuth = false;
    const enableExternalUploads = false;

    return {
        test: {
            // https://vitest.dev/guide/browser/
            browser: {
                enabled: true,
                provider: playwright(),
                headless: !!process.env.HEADLESS,
                instances: [{ browser: 'chromium' }],
            },
        },
        base: './',
        define: {
            __COMMIT_HASH__: JSON.stringify(commitHash),
            __VITEST__: !!process.env.VITEST,
            __OFFLINE_MODE__: JSON.stringify(offlineMode),
            __ENABLE_TIDAL_API__: JSON.stringify(enableTidalApi),
            __ENABLE_EXTERNAL_API_INSTANCES__: JSON.stringify(enableExternalApiInstances),
            __ENABLE_EXTERNAL_AUTH__: JSON.stringify(enableExternalAuth),
            __ENABLE_EXTERNAL_UPLOADS__: JSON.stringify(enableExternalUploads),
            __ABOUT_MD_CONTENT__: JSON.stringify((() => {
                const envPath = process.env.WAVES_MUSIC_ABOUT_MD_PATH;
                if (envPath && fs.existsSync(envPath)) {
                    return fs.readFileSync(envPath, 'utf-8');
                }
                const defaultPaths = [
                    path.resolve(__dirname, 'about.md'),
                    path.resolve(__dirname, 'about.MD'),
                    path.resolve(process.cwd(), 'about.md'),
                    path.resolve(process.cwd(), 'about.MD')
                ];
                for (const p of defaultPaths) {
                    if (fs.existsSync(p)) {
                        return fs.readFileSync(p, 'utf-8');
                    }
                }
                return '# About Waves Music\n\nAbout page content not configured.';
            })()),
        },
        worker: {
            format: 'es',
        },
        resolve: {
            alias: {
                '!lucide': '/node_modules/lucide-static/icons',
                '!simpleicons': '/node_modules/simple-icons/icons',
                '!': '/node_modules',

                events: '/node_modules/events/events.js',
                pocketbase: '/node_modules/pocketbase/dist/pocketbase.es.js',
                stream: path.resolve(__dirname, 'stream-stub.js'), // Stub for stream module
            },
        },
        optimizeDeps: {
            exclude: ['pocketbase', '@ffmpeg/ffmpeg', '@ffmpeg/util'],
        },
        server: {
            fs: {
                allow: ['.', 'node_modules'],
            },
            proxy: {
                '/api/v1/recommend': {
                    target: navidromeUrl,
                    changeOrigin: true,
                },
                '/rest': {
                    target: 'http://127.0.0.1:4533',
                    changeOrigin: true,
                }
            }
        },
        // preview: {
        //     host: true,
        //     allowedHosts: ['<your_tailscale_hostname>'], // e.g. pi5.tailf5f622.ts.net
        // },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: true,
            minify: 'terser',
            terserOptions: {
                compress: {
                    drop_console: true,
                    drop_debugger: true,
                },
            },
            rollupOptions: {
                treeshake: true,
            },
        },
        plugins: [
            proxyAudioPlugin(),
            purgecss({
                variables: false, // DO NOT REMOVE UNUSED VARIABLES (breaks web components like am-lyrics)
                safelist: {
                    standard: [
                        /^am-lyrics/,
                        /^lyplus-/,
                        'sidepanel',
                        'side-panel',
                        'active',
                        'show',
                        /^data-/,
                        /^modal-/,
                    ],
                    deep: [/^am-lyrics/],
                    greedy: [/^lyplus-/, /sidepanel/, /side-panel/],
                },
            }),
            authGatePlugin(),
            uploadPlugin(),
            blobAssetPlugin(),
            svgUse(),
            VitePWA({
                registerType: 'prompt',
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
                    cleanupOutdatedCaches: true,
                    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB limit
                    // Define runtime caching strategies
                    runtimeCaching: [
                        {
                            urlPattern: ({ request }) => request.destination === 'image',
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'images',
                                expiration: {
                                    maxEntries: 100,
                                    maxAgeSeconds: 60 * 24 * 60 * 60, // 60 Days
                                },
                            },
                        },
                        {
                            urlPattern: ({ request }) =>
                                request.destination === 'audio' || request.destination === 'video',
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'media',
                                expiration: {
                                    maxEntries: 50,
                                    maxAgeSeconds: 60 * 24 * 60 * 60, // 60 Days
                                },
                                rangeRequests: true, // Support scrubbing
                            },
                        },
                    ],
                },
                includeAssets: ['discord.html'],
                manifest: false, // Use existing public/manifest.json
            }),
        ],
    };
});

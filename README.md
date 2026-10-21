# LAYALI — Movy edition

A private personal cinema using Movy's public catalog and playback metadata, with an interface matching its full-width billboard, floating navigation, ranked cards, and content rows.

## Local development

Node.js 22+; no installation or private API keys needed.

```sh
npm run build
npm run dev
```

Open http://127.0.0.1:4173. Rebuild and restart after source edits.

## Features

- Movy home catalog scraped from its server-rendered page data, with a saved catalog snapshot if the source cannot be reached.
- Full catalog search and paginated movies/shows/animation browsing through the same public data service used by Movy.
- Details, show seasons, episode selection, and a browser-local watchlist.
- Direct video playback with best available quality by default, manual resolution selection and playback position preservation.
- Arabic subtitles selected by default when available, an explicit unavailable message otherwise, and subtitle/off controls.
- SRT subtitles converted to WebVTT. Video manifests and segments are streamed through the backend using the provider's normal request headers.
- No Movy page scripts, advertising scripts, pop-ups, or provider iframes are loaded in the interface.

## Source

- `page.html`: interface, catalog interactions, player, quality and subtitle controls.
- `backend.mjs`: catalog scraping, data/playback API access, media and subtitle proxying.
- `movy-codec.js`: Movy's public response transport codec; per-request public seeds are obtained through its normal endpoint. No private credentials are embedded.
- `movy-seed.json`: initial catalog snapshot.
- `vendor/`: bundled hls.js and its license.
- `scripts/assemble.mjs`: builds `worker/index.js` from the source files.

## Limitations

Arabic subtitles and specific quality versions depend on upstream availability. Subtitle timing varies by release. Some 4K formats may not work in every browser; best-quality mode tries a lower quality when a fatal stream error occurs. Watchlists are stored in this browser and do not sync between devices. Provider APIs, domains and markup can change and may require maintenance.

## Validation

Live 4K playback of Project Hail Mary verified in Chromium, with Arabic subtitles enabled and 1,720 loaded cues. Home/catalog rendering, remote search, media manifest rewriting and SRT-to-VTT conversion verified.

Additional checks: 4K → 720p switching preserved playback time, volume, speed and Arabic captions; captions can be turned off. Breaking Bad season 2 episode 2 played successfully after selecting the season/episode. Desktop and mobile screenshots reviewed. Run API regression checks with `node --test tests/movy.test.mjs`.

## Media proxy authorization

`MEDIA_PROXY_SECRET` is a server-only secret configured in Sites runtime settings. Keep it out of client code, source, and the hosting manifest. Localhost development uses a temporary process-local key if this variable is absent.

Media links carry expiring HMAC grants scoped to the video CDN origin. Each trusted playlist's initialization files, child playlists and video chunks receive grants for their actual origins, so new provider CDNs do not require additions to a fixed hostname list. Altered hosts and expired/unsigned grants are rejected. Range requests and partial responses remain supported.

The player has a bounded stall timer with automatic quality fallback in Best available mode. Manually selected qualities show a retry message on failure.

Playback discovery now runs through the provider's normal public browser endpoints, avoiding shared-server source-discovery rate limits. `/api/prepare` validates the resulting CDN URLs and issues server-signed proxy grants. The source transport codec is served locally; advertising/player page scripts are still excluded. Hosted outbound requests use an AbortController-based timeout compatible with the production runtime.

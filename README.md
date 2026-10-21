# LAYALI

A personal, Netflix-inspired cinema interface backed by the public EgyDead catalog. The deployed Site is owner-private.

## Run locally

Requires Node.js 22 or newer. No dependencies or API keys.

```sh
npm run build
npm run dev
```

Open http://127.0.0.1:4173. After editing the source, run `npm run build` and restart the development server.

## Features

- Live server-side catalog scraping, Arabic/English search, pagination, and source posters.
- Movies, series and anime filters, alphabetical/year sorting and title details.
- My List stored in this browser's localStorage, with Arabic/RTL interface support.
- No scripts, analytics, advertising frames or HTML from source pages are executed in the main interface.
- Direct HLS playback when the public provider metadata exposes a compatible stream; native HLS or bundled hls.js handles playback without provider page/ad scripts.
- Quality picker defaults to Best available, with Auto and the actual source resolutions. Preferences persist per browser; switching keeps playback position, volume, playback speed, and pause state. Native HLS browsers and hls.js are supported.
- Direct StreamRuby links are resolved even when another provider appears first, including the rubyvidhub.com domain used by older titles.
- The embed fallback lists StreamRuby only. Incompatible providers are excluded; titles without a compatible source show an unavailable message. Pop-up and redirect protection stays enabled.
- Snapshot of 88 source titles displayed if the live source is unavailable.

## Playback limits

The source supplies external video servers. Where compatible public stream metadata is available, the app plays the video directly without executing provider scripts. The iframe sandbox excludes pop-ups, downloads, forms, and top-page navigation. Providers can still show advertising within their own iframe and may refuse sandboxed playback. This is **not a guarantee of completely ad-free video**. No DRM or provider access protections are bypassed. Direct playback of the spotlight film was verified in Chromium: currentTime advanced past one second, readyState was 4, paused was false, and no media error occurred. Provider availability can vary.

The upstream domain, markup, availability and host policies can change. These changes may require scraper maintenance. Watchlist storage is per browser; it is not synced between devices.

## Source files

- `page.html`: responsive UI, styling and browser interactions.
- `backend.mjs`: Worker request handler, scraper, proxy and playback discovery.
- `seed.json`: initial catalog snapshot.
- `scripts/assemble.mjs`: assembles the page and backend into `worker/index.js`.
- `scripts/build.sh`: produces the deployable Worker under `dist/`.

## Checks performed

Live catalog retrieval, remote search, title details, video server discovery, image proxy, and pagination with newly discovered titles passed locally. Client/server JavaScript syntax checked. Browser regression checks passed for one-click player loading, delayed metadata, retry, poster clicks, detail-page playback, source errors, close-during-fetch, and mobile layout. The actual upstream player and direct HLS playback were verified.

Quality controls verified with live 1080p playback, switching to 480p, retained position/volume/speed, paused switching, Auto selection, and mobile layout.

Playback resolver regressions: `node --test tests/playback.test.mjs`. Covers Ruby after an incompatible first server, alternate Ruby domain, no compatible source, and compatible iframe fallback.

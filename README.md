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
- Native video playback when the source exposes a direct MP4; otherwise explicit opt-in to restricted third-party players.
- Snapshot of 88 source titles displayed if the live source is unavailable.

## Playback limits

The source currently supplies external embedded video servers. The iframe sandbox excludes pop-ups, downloads, forms, and top-page navigation. Providers can still show advertising within their own iframe and may refuse sandboxed playback. This is **not a guarantee of completely ad-free video**. No DRM or provider access protections are bypassed. Full video playback has not been verified.

The upstream domain, markup, availability and host policies can change. These changes may require scraper maintenance. Watchlist storage is per browser; it is not synced between devices.

## Source files

- `page.html`: responsive UI, styling and browser interactions.
- `backend.mjs`: Worker request handler, scraper, proxy and playback discovery.
- `seed.json`: initial catalog snapshot.
- `scripts/assemble.mjs`: assembles the page and backend into `worker/index.js`.
- `scripts/build.sh`: produces the deployable Worker under `dist/`.

## Checks performed

Live catalog retrieval, remote search, title details, video server discovery, image proxy, and pagination with newly discovered titles passed locally. Client/server JavaScript syntax checked. Graphical browser verification was unavailable on this host.

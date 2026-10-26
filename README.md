# LAYALI

A personal, Netflix-inspired cinema interface backed by the public EgyDead catalog, with a selectable TopCinema catalog. Runs locally on your computer.

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
- HLS playlists, quality variants, encryption keys and video chunks stream through a same-origin backend proxy restricted to StreamRuby CDN hosts and the observed TopCinema CDNs (`*.cloudcdn.casa`, `*.cdn-video.xyz`, `*.gamescdn.online`, `*.cdn-tnmr.org`). Browser Origin/Referer/cookies are not forwarded to the video CDN. VideoTube and UpDown CDNs receive their fixed public player origin as the media referrer, as required for normal playback.
- Direct HLS playback when the public provider metadata exposes a compatible stream; native HLS or bundled hls.js handles playback without provider page/ad scripts.
- Quality picker defaults to Best available, with Auto and the actual source resolutions. Preferences persist per browser; switching keeps playback position, volume, playback speed, and pause state. Native HLS browsers and hls.js are supported.
- Direct StreamRuby links are resolved even when another provider appears first, including the rubyvidhub.com domain used by older titles.
- EgyDead keeps its StreamRuby embed fallback. TopCinema offers its complete per-title server list, with direct playback where supported and a protected external iframe fallback for other mirrors. Pop-up and redirect protection stays enabled; some external players may reject the sandbox.
- Snapshot of 88 source titles displayed if the live source is unavailable.

## Source selection

Use **Source** above the catalog to switch between **EgyDead** and **TopCinema**. The browser remembers your choice. Search and pagination use the selected site; My List retains the source of each saved title. Choose a title and playback starts automatically. No pasted playback links are required.

TopCinema uses its `/recent/` catalog, `/recent/page/<n>/` pagination, and `/search/?query=...` search. The scraper reads lazy-loaded poster URLs, Arabic stories and the selected season's episode list. Playback follows the selected title's own `/watch/` page, reads its full server list and uses the site's ordinary server-selection endpoint to switch mirrors. It reads the public stream metadata without executing provider scripts. HLS playlists and video chunks use the restricted same-origin stream proxy; normal quality controls remain available.

Fasel and the manual Aflamy link form were removed. The **Video server** buttons above the player select the actual mirror for the current episode. VideoTube, OkStream, UpDown and LuluStream have direct adapters; the other listed servers use a sandboxed iframe fallback. Server choices stay visible when a stream fails. Retry reloads the chosen mirror, and opening another episode resets the selection. TopCinema titles without an available mirror show the unavailable message; the title dialog can search the other catalog for a matching title or episode. Actual quality comes from the video manifest and may differ from a source page's quality badge.

Regression checks: `node --test tests/*.test.mjs` covers catalog routing, source isolation, episode links, challenge errors, direct playback resolution, ordinary server selection, blocked external destinations and stream-proxy behavior. The source adapter fixtures use small synthetic HTML examples; live checks separately verify TopCinema catalog retrieval, search, distinct pagination results, stories, episode links and playback.

The title dialog labels the current **Video source** explicitly (for example, `TopCinema · OkStream`). **Search another site** is a separate collapsed section with a named search button; it does not change playback. Playback requests include their expected source, and the backend rejects a title URL from a different source. Watermarks embedded in upstream video files are retained; the displayed source identifies where the stream was resolved, not who encoded the file.

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

Stream proxy regressions: `node --test tests/*.test.mjs`. Covers nested playlist rewriting, range responses, blocked upstream requests and unsafe redirect rejection. Loading failures show a persistent retry message rather than an indefinite spinner.

Lanterns regressions cover pages without OkStream, all per-title mirror choices, explicit server selection, direct MP4, invalid server rejection, protected iframe fallback, fixed CDN referrers and Cloudflare telemetry on otherwise accessible pages.

Live Lanterns S01E07 verification: VideoTube played at 960p with 640p, 424p and 216p variants also exposed; switching to LuluStream played at 960p. All nine original mirror names were visible and selectable. UpDown resolved and served MP4 range responses, but buffered heavily in the browser test; availability and speed remain provider-dependent. No external provider/ad requests were made by the browser during verified direct playback.

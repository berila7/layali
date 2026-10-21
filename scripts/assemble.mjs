import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const html = (await read('page.html')).replace('__SEED__', await read('seed.json'));
await writeFile(new URL('worker/index.js', root), 'const HLS_LIBRARY=' + JSON.stringify(await read('vendor/hls.min.js')) + ';\nconst PAGE=' + JSON.stringify(html) + ';\n' + await read('backend.mjs'));

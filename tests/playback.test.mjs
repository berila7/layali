import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
const source = 'https://tv10.egydead.live/test-title/';
const ruby = 'https://rubyvidhub.com/embed-example.html';
const media = 'https://test.streamruby.net/master.m3u8';
const sourceRows = '<li data-link="https://hgcloud.to/e/test"><span>StreamHG</span></li>';
const rubyRow = '<li data-link="' + ruby + '"><span>StreamRuby</span></li>';
const packed = "eval(function(p,a,c,k,e,d){return p}('0({1:[{2:\"3\"}]})',36,4,'setup|sources|file|" + media + "'.split('|')))";
async function requestWith(upstream) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    const key = String(url); calls.push(key);
    if (!(key in upstream)) throw new Error('Unexpected upstream: ' + key);
    return new Response(upstream[key], {headers: {'content-type': 'text/html'}});
  };
  try {
    const response = await worker.fetch(new Request('http://localhost/api/play?url=' + encodeURIComponent(source)));
    assert.equal(response.status, 200);
    return {data: await response.json(), calls};
  } finally { globalThis.fetch = original; }
}
test('finds direct Ruby after an incompatible first server and handles its alternate domain', async () => {
  const {data, calls} = await requestWith({[source]: sourceRows + rubyRow, [ruby]: packed});
  assert.equal(data.media, media);
  assert.equal(data.format, 'hls');
  assert.deepEqual(data.servers.map(s => s.name), ['StreamRuby']);
  assert.deepEqual(calls, [source, ruby]);
});
test('does not offer incompatible players when no Ruby source exists', async () => {
  const {data, calls} = await requestWith({[source]: sourceRows});
  assert.equal(data.media, null);
  assert.deepEqual(data.servers, []);
  assert.equal(data.reason, 'incompatible_providers');
  assert.deepEqual(calls, [source]);
});
test('retains Ruby iframe fallback if its direct stream cannot be resolved', async () => {
  const {data} = await requestWith({[source]: sourceRows + rubyRow, [ruby]: '<html>Unavailable direct manifest</html>'});
  assert.equal(data.media, null);
  assert.deepEqual(data.servers.map(s => s.name), ['StreamRuby']);
});

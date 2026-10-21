"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRatingsService, parseLieferando, PLACE_ID } = require("../server/ratings.cjs");
const { createServer } = require("../server/index.cjs");
const providerHTML = '<h1>Ristorante Pizzeria Alberto Holzmattenweg</h1><p>Lieferando.de</p><h2>Aktuelle Bewertungen</h2><p>5 Sterne aus <b>178</b> Bewertungen</p>';
test("Lieferando reads only the labelled restaurant aggregate", () => {
  assert.deepEqual(parseLieferando(providerHTML), { rating: 5, count: 178 });
  assert.deepEqual(parseLieferando(providerHTML.replace('5 Sterne', '4,8 Sterne').replace('178','1.234')), { rating: 4.8, count: 1234 });
  for (const html of [providerHTML.replace('Alberto','Another restaurant'),providerHTML.replace('5 Sterne aus <b>178</b> Bewertungen','Individual review: 5 stars'),providerHTML.replace('178','0'),'<html>Access denied</html>']) assert.throws(() => parseLieferando(html));
});
test("Google stays unavailable without configuration and never fabricates a rating", async () => {
  const service = createRatingsService({ googleKey: '', fetchImpl: () => { throw Error('Must not fetch'); } });
  assert.deepEqual(await service('google'), { provider: 'google', status: 'unavailable' });
});
test("Google requests the confirmed place; key stays on server; provider data is validated", async () => {
  const requests=[];
  const service=createRatingsService({googleKey:'test-only-key',fetchImpl:async (url,options)=>{requests.push({url,options});return new Response(JSON.stringify({id:PLACE_ID,rating:4.7,userRatingCount:248,attributions:[{provider:'Attribution',providerUri:'https://example.com'}]}));}});
  const result=await service('google');
  assert.equal(result.rating,4.7);assert.equal(result.count,248);assert.equal(requests[0].options.headers['X-Goog-Api-Key'],'test-only-key');assert.ok(requests[0].url.includes(PLACE_ID));assert.ok(!JSON.stringify(result).includes('test-only-key'));
  for(const data of [{id:'wrong',rating:5,userRatingCount:100},{id:PLACE_ID,rating:9,userRatingCount:100},{id:PLACE_ID,rating:4.7,userRatingCount:-1}]) {
    const invalid=createRatingsService({googleKey:'test',fetchImpl:async()=>new Response(JSON.stringify(data))});
    assert.equal((await invalid('google')).status,'unavailable');
  }
});
test("Provider updates are retrieved again, outages never reuse previous successful values", async () => {
  let calls=0;
  const service=createRatingsService({fetchImpl:async()=>{calls++;if(calls===3)throw Error('offline');return new Response(providerHTML.replace('5 Sterne',calls===1?'5 Sterne':'4,9 Sterne'));}});
  assert.equal((await service('lieferando')).rating,5);assert.equal((await service('lieferando')).rating,4.9);assert.deepEqual(await service('lieferando'),{provider:'lieferando',status:'unavailable'});
});
test("HTTP adapter injects only the same-origin endpoint, disables API caching and hides private files", async () => {
  const server=createServer({getRating:async provider=>({provider,status:'unavailable'})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try {
    assert.match(await (await fetch(base)).text(),/name="alberto-ratings-endpoint" content="\/api\/ratings"/);
    const api=await fetch(base+'/api/ratings?provider=google');assert.equal(api.headers.get('cache-control'),'no-store');assert.equal((await api.json()).status,'unavailable');
    assert.equal((await fetch(base+'/api/ratings?provider=unknown')).status,400);
    for(const file of ['/server/ratings.cjs','/.env','/.git/config','/tests/ratings.cjs','/assets/../server/ratings.cjs','/assets/%2e%2e%2fserver%2fratings.cjs']) assert.equal((await fetch(base+file)).status,404,file);
    assert.equal((await fetch(base+'/api/ratings?provider=google',{method:'POST'})).status,405);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

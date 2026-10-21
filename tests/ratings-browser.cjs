"use strict";
const assert=require('node:assert/strict');const fs=require('node:fs');
const {createServer}=require('../server/index.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 let rating=5,unavailable=false,offset=0;
 const calls=[];const errors=[];
 const server=createServer({getRating:async provider=>{calls.push(provider);return unavailable?{provider,status:'unavailable'}:{provider,status:'ok',rating:provider==='google'?4.7:rating,count:123,checkedAt:new Date(Date.now()+offset).toISOString(),attributions:[]};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const out='/workspace/alberto-reviews-qa';fs.mkdirSync(out,{recursive:true});
 try {
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   page.on('pageerror',e=>errors.push(e.message));
   for(const [slug,provider] of [['index','google'],['bestellen','lieferando']]){
    await page.goto(`${base}/${slug}.html`);const card=page.locator(`[data-rating-provider="${provider}"]`);await card.scrollIntoViewIfNeeded();await page.waitForFunction(p=>!document.querySelector(`[data-rating-provider="${p}"] [data-rating-live]`).hidden,provider);
    assert.equal(await card.locator('[data-rating-score]').textContent(),provider==='google'?'4,7':'5,0');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(provider==='lieferando')assert.equal(await card.locator('[data-rating-headline]').textContent(),'Mit 5 Sternen bewertet.');
    else assert.match(await card.locator('a.button').getAttribute('href'),/writereview\?placeid=ChIJvxMbe4y5kUcRX1GLsx9MlT0$/);
   }await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await page.clock.install();
  await page.goto(base+'/bestellen.html');await page.locator('.delivery-reviews').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('[data-rating-live]').hidden);
  rating=4.8;offset=300100;await page.clock.fastForward(300100);
  await page.waitForFunction(()=>document.querySelector('[data-rating-score]').textContent==='4,8');
  assert.equal(await page.locator('[data-rating-headline]').textContent(),'Von unseren Gästen geschätzt.');
  unavailable=true;offset+=300100;await page.clock.fastForward(300100);await page.waitForFunction(()=>document.querySelector('[data-rating-live]').hidden);
  assert.equal(await page.locator('[data-rating-fallback]').isVisible(),true);
  assert.ok(await page.locator('.delivery-reviews a.button').isVisible());
  await page.close();
  // Real fallback previews, without manufactured scores, for the owner's review.
  for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});for(const slug of ['index','bestellen']){await page.goto(`${base}/${slug}.html`);const card=page.locator('[data-rating-provider]');await card.scrollIntoViewIfNeeded();await card.screenshot({path:`${out}/${slug}-${width}.png`});}await page.close();}
  assert.equal(calls.includes('google'),false,'Manual Google rating must not request the paid API');assert.deepEqual(errors,[]);console.log('PASS live ratings: desktop/mobile layout, direct Google review link, automatic score refresh, changing five-star claim, outage fallback, no browser errors');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

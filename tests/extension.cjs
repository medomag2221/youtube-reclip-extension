const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dir=path.resolve(__dirname, '..');
function event(){return {addListener(){}};}
async function workerTest(){
 let store={};let downloaded;
 const chrome={storage:{local:{get:async()=>structuredClone(store),set:async value=>{store=structuredClone(value);}}},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},alarms:{get:async()=>null,create:async()=>{},onAlarm:event()},runtime:{onMessage:event(),onInstalled:event(),onStartup:event()},downloads:{download:async value=>{downloaded=value;return 42;},search:async()=>[{state:'complete'}],onChanged:event()}};
 const ctx=vm.createContext({chrome,URL,AbortController,setTimeout,clearTimeout,console,fetch:async(url,opts)=>({ok:true,json:async()=>url.includes('/download')?{job_id:'123456abcd'}:{status:'done',filename:'title.mp4'}})});
 vm.runInContext(fs.readFileSync(path.join(dir,'background.js'),'utf8'),ctx);
 assert.equal(vm.runInContext('safeFilename("Русское название: тест?", "mp4")',ctx),'YouTube/Русское название тест.mp4');
 assert.equal(vm.runInContext('safeFilename("CON", "mp4")',ctx),'YouTube/_CON.mp4');
 assert.throws(()=>vm.runInContext('videoUrl("https://example.com/watch?v=abcdefghijk")',ctx));
 await vm.runInContext('start({url:"https://www.youtube.com/shorts/abcdefghijk",title:"Тест кириллицы"})',ctx);
 await assert.rejects(()=>vm.runInContext('start({url:"https://www.youtube.com/watch?v=abcdefghijk",title:"дубль"})',ctx));
 await vm.runInContext('poll()',ctx);
 assert.equal(downloaded.filename,'YouTube/Тест кириллицы.mp4');assert.equal(store.jobs[0].state,'done');
 // Simulate service-worker restart: jobs survive in chrome.storage.
 store.jobs[0].state='preparing';
 const ctx2=vm.createContext({...ctx});vm.runInContext(fs.readFileSync(path.join(dir,'background.js'),'utf8'),ctx2);await vm.runInContext('poll()',ctx2);
 assert.equal(store.jobs[0].state,'done');
 console.log('PASS worker: Cyrillic, safe filenames, URL validation, duplicate task, persistent queue, download completion');
}
async function domTest(){
 const dom=new JSDOM(`<ytd-watch-metadata><h1>Русский ролик</h1><div id="actions"><div id="top-level-buttons-computed"><button>Нравится</button><button>Сохранить</button></div></div></ytd-watch-metadata><ytd-rich-item-renderer><a id="video-title" href="/watch?v=ZYXWVUTSRQP" title="Ролик из меню">Ролик из меню</a><ytd-menu-renderer><button id="dots">⋮</button></ytd-menu-renderer></ytd-rich-item-renderer><ytd-menu-popup-renderer><div id="items"><ytd-menu-service-item-renderer>Добавить в очередь</ytd-menu-service-item-renderer></div></ytd-menu-popup-renderer>`,{url:'https://www.youtube.com/watch?v=abcdefghijk',runScripts:'outside-only'});
 const w=dom.window;const messages=[];w.HTMLElement.prototype.getClientRects=function(){return [1];};w.chrome={runtime:{sendMessage:async data=>{messages.push(data);return {ok:true};}}};
 w.eval(fs.readFileSync(path.join(dir,'content.js'),'utf8'));
 const group=w.document.querySelector('#top-level-buttons-computed');assert.equal(group.children[1].className,'reclip-save-button');
 w.document.querySelector('#dots').click();await new Promise(r=>setTimeout(r,180));
 const first=w.document.querySelector('#items').firstElementChild;assert.equal(first.className,'reclip-menu-button');first.click();await new Promise(r=>setTimeout(r,20));
 assert.equal(messages[0].url,'https://www.youtube.com/watch?v=ZYXWVUTSRQP');assert.equal(messages[0].title,'Ролик из меню');
 group.querySelector('.reclip-save-button').click();await new Promise(r=>setTimeout(r,20));assert.equal(messages[1].title,'Русский ролик');
 assert.equal(w.document.querySelectorAll('.reclip-save-button').length,1);
 assert.equal(first.querySelector('svg').getAttribute('viewBox'),'0 0 24 24');
 dom.window.close();console.log('PASS DOM: beside Save, first menu item, selected card URL/title, current-video button, SVG icon');
}
async function nestedMenuTest(){
 const dom=new JSDOM(`<ytd-rich-item-renderer><a id="video-title" href="/watch?v=ZYXWVUTSRQP">Другой ролик</a><button id="dots">⋮</button></ytd-rich-item-renderer><yt-sheet-view-model><yt-list-view-model><div class="yt-list-view-model__items"><yt-list-item-view-model>Добавить в очередь</yt-list-item-view-model></div></yt-list-view-model></yt-sheet-view-model>`,{url:'https://www.youtube.com/',runScripts:'outside-only'});
 const w=dom.window;w.HTMLElement.prototype.getClientRects=function(){return [1];};w.chrome={runtime:{sendMessage:async()=>({ok:true})}};
 w.eval(fs.readFileSync(path.join(dir,'content.js'),'utf8'));
 w.document.querySelector('#dots').click();await new Promise(r=>setTimeout(r,180));
 const root=w.document.querySelector('yt-sheet-view-model');
 assert.equal(root.querySelectorAll('.reclip-menu-button').length,1);
 const items=root.querySelector('.yt-list-view-model__items');assert.equal(items.firstElementChild.className,'reclip-menu-button');
 // Reproduce the reported outer-wrapper + inner-list duplicate, then let observer repair it.
 root.prepend(items.firstElementChild.cloneNode(true));await new Promise(r=>setTimeout(r,180));
 assert.equal(root.querySelectorAll('.reclip-menu-button').length,1);
 assert.equal(items.firstElementChild.className,'reclip-menu-button');
 dom.window.close();console.log('PASS nested menu: one button across sheet/list wrappers, first position, stale duplicate repaired');
}
(async()=>{await workerTest();await domTest();await nestedMenuTest();})().catch(e=>{console.error(e);process.exitCode=1;});

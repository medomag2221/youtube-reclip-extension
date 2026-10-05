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
 // Limit terminal history, never evict active downloads, and keep chronological order.
 store.jobs=Array.from({length:14},(_,i)=>({id:String(i).padStart(10,'0'),state:i%2?'error':'done'}));
 store.jobs.splice(1,0,{id:'active0001',state:'preparing'});
 store.jobs.push({id:'active0002',state:'saving'});
 await vm.runInContext('jobs().then(save)',ctx);
 assert.equal(store.jobs.filter(j=>['done','error'].includes(j.state)).length,8);
 assert.equal(store.jobs.filter(j=>['preparing','saving'].includes(j.state)).length,2);
 assert.equal(store.jobs.find(j=>j.state==='done'||j.state==='error').id,'0000000006');
 await vm.runInContext('clearHistory("0000000013")',ctx);
 assert.equal(store.jobs.length,9);assert.ok(!store.jobs.some(j=>j.id==='0000000013'));
 await vm.runInContext('clearHistory("active0001")',ctx);assert.ok(store.jobs.some(j=>j.id==='active0001'));
 await vm.runInContext('clearHistory()',ctx);
 assert.deepEqual(store.jobs.map(j=>j.state),['preparing','saving']);
 console.log('PASS worker: Cyrillic, safe filenames, URL validation, duplicate task, persistent queue, download completion');
}
async function popupTest(){
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'popup.html'),'utf8'),{url:'chrome-extension://test/popup.html',runScripts:'outside-only'});
 const w=dom.window;let list=[{id:'0000000001',title:'Готовое',state:'done',downloadId:42},{id:'0000000002',title:'Ошибка',state:'error',error:'403'},{id:'0000000003',title:'Активное',state:'preparing'}];
 let shown;
 w.chrome={runtime:{sendMessage:async data=>{
  if(data.type==='list')return {jobs:structuredClone(list)};
  list=list.filter(j=>['preparing','saving'].includes(j.state)||(data.type==='removeHistory'&&j.id!==data.id));return {ok:true};
 }},storage:{onChanged:event()},downloads:{show:id=>{shown=id;}}};
 w.eval(fs.readFileSync(path.join(dir,'popup.js'),'utf8'));await new Promise(r=>setTimeout(r,20));
 assert.equal(w.document.querySelectorAll('.remove-history').length,2);
 const done=Array.from(w.document.querySelectorAll('article')).find(a=>a.textContent.includes('Готовое'));
 done.querySelector('button').click();assert.equal(shown,42);
 done.querySelector('.remove-history').click();await new Promise(r=>setTimeout(r,20));
 assert.equal(list.length,2);assert.ok(!list.some(j=>j.title==='Готовое'));
 w.document.querySelector('#clear-history').click();await new Promise(r=>setTimeout(r,20));
 assert.equal(list.length,1);assert.equal(list[0].state,'preparing');
 assert.equal(w.document.querySelector('#clear-history').disabled,true);
 dom.window.close();console.log('PASS popup: per-entry removal, clear history, active task preservation, show in folder');
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
(async()=>{await workerTest();await popupTest();await domTest();await nestedMenuTest();})().catch(e=>{console.error(e);process.exitCode=1;});

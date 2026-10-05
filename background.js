const API = 'http://server-home.lan/reclip/api/';
const ALARM = 'reclip-poll';
const HISTORY_LIMIT = 8;
const isActive = job => ['preparing', 'saving'].includes(job.state);
let lock = Promise.resolve();
function serialized(fn) {
  const next = lock.then(fn, fn);
  lock = next.catch(() => {});
  return next;
}
function videoUrl(input) {
  const url = new URL(input);
  if (!['www.youtube.com', 'm.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname)) throw new Error('Нужна ссылка YouTube.');
  const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|live)\/([\w-]+)/)?.[1];
  if (!/^[\w-]{11}$/.test(id || '')) throw new Error('Не удалось определить видео.');
  return `https://www.youtube.com/watch?v=${id}`;
}
function safeFilename(title, ext) {
  const name = String(title || 'Видео YouTube').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, 150).replace(/[. ]+$/g, '') || 'Видео YouTube';
  const safe = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' + name : name;
  return `YouTube/${safe}.${/^(mp4|mkv|webm|mp3|m4a)$/i.test(ext) ? ext.toLowerCase() : 'mp4'}`;
}
async function request(path, data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API + path, {method: data ? 'POST' : 'GET', headers: data ? {'Content-Type':'application/json'} : {}, body: data ? JSON.stringify(data) : undefined, signal: controller.signal});
    const value = await response.json();
    if (!response.ok || value.error) throw new Error(value.error || `HTTP ${response.status}`);
    return value;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('ReClip недоступен. Проверь домашнюю сеть и server-home.lan.');
    throw error;
  } finally { clearTimeout(timer); }
}
async function jobs() { return (await chrome.storage.local.get('jobs')).jobs || []; }
async function save(list) {
  // Retain active tasks until completion; trimming history must not lose downloads.
  const history = new Set(list.filter(j => !isActive(j)).slice(-HISTORY_LIMIT).map(j => j.id));
  const retained = list.filter(j => isActive(j) || history.has(j.id));
  if (JSON.stringify(await jobs()) !== JSON.stringify(retained)) {
    await chrome.storage.local.set({jobs: retained});
  }
  const active = retained.filter(isActive).length;
  await chrome.action.setBadgeText({text: active ? String(active) : ''});
  await chrome.action.setBadgeBackgroundColor({color:'#b3261e'});
}
async function clearHistory(id) {
  const list = await jobs();
  await save(list.filter(job => isActive(job) || (id && job.id !== id)));
  return {ok:true};
}
async function ensureAlarm() {
  if (!(await chrome.alarms.get(ALARM))) await chrome.alarms.create(ALARM, {periodInMinutes:0.5});
}
async function start(data) {
  const url = videoUrl(data.url);
  const list = await jobs();
  if (list.some(j => j.url === url && ['preparing','saving'].includes(j.state))) throw new Error('Это видео уже скачивается.');
  const title = String(data.title || '').trim().slice(0,300) || 'Видео YouTube ' + new URL(url).searchParams.get('v');
  const result = await request('download', {url, title, format:'video'});
  if (!/^[a-f0-9]{10}$/.test(result.job_id || '')) throw new Error('ReClip вернул неверный номер задачи.');
  list.push({id:result.job_id,url,title,state:'preparing',created:Date.now(),failures:0});
  await save(list);
  await ensureAlarm();
  return {ok:true};
}
async function poll() {
  const list = await jobs();
  for (const job of list.filter(j => j.state === 'preparing')) {
    try {
      const status = await request('status/' + job.id);
      job.failures = 0;
      if (status.status === 'error') throw new Error(status.error || 'Скачивание не удалось.');
      if (status.status === 'done') {
        const ext = String(status.filename || '').split('.').pop();
        job.filename = safeFilename(job.title, ext);
        job.downloadId = await chrome.downloads.download({url: API + 'file/' + job.id, filename:job.filename, conflictAction:'uniquify', saveAs:false});
        job.state = 'saving';
      } else if (Date.now() - job.created > 20*60*1000) throw new Error('ReClip слишком долго готовит файл.');
    } catch(error) {
      job.failures++;
      job.error = error.message;
      // Retry temporary LAN outages; server-side failures are terminal.
      if (!error.message.startsWith('ReClip недоступен') || job.failures >= 10) job.state = 'error';
    }
  }
  // Also reconcile events missed while the browser was closed.
  for (const job of list.filter(j => j.state === 'saving')) {
    const [item] = await chrome.downloads.search({id:job.downloadId});
    if (item?.state === 'complete') job.state = 'done';
    else if (!item || item.state === 'interrupted') { job.state = 'error'; job.error = 'Загрузка на ПК прервана. Повтори скачивание.'; }
  }
  await save(list);
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'download') {
    // Only our YouTube content script or extension pages can start a task.
    if (sender.tab && !/^https:\/\/(www|m)\.youtube\.com\//.test(sender.url || '')) return;
    serialized(() => start(message)).then(respond, error => respond({ok:false,error:error.message}));
    return true;
  }
  if (message.type === 'list') { serialized(async () => { await save(await jobs()); return {jobs:await jobs()}; }).then(respond, error => respond({error:error.message})); return true; }
  if (message.type === 'clearHistory' || message.type === 'removeHistory') {
    // Destructive history actions are allowed only from our extension popup.
    if (sender.tab || !String(sender.url || '').startsWith(chrome.runtime.getURL(''))) return;
    if (message.type === 'removeHistory' && !/^[a-f0-9]{10}$/.test(message.id || '')) {
      respond({ok:false,error:'Неверный номер записи.'}); return;
    }
    serialized(() => clearHistory(message.type === 'removeHistory' ? message.id : null))
      .then(respond, error => respond({ok:false,error:error.message}));
    return true;
  }
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) serialized(poll).catch(console.error); });
chrome.downloads.onChanged.addListener(delta => {
  if (delta.state) serialized(async () => {
    const list = await jobs(); const job = list.find(j => j.downloadId === delta.id);
    if (job) { if (delta.state.current === 'complete') job.state = 'done'; else if (delta.state.current === 'interrupted') {job.state='error';job.error='Загрузка на ПК прервана.';} await save(list); }
  }).catch(console.error);
});
chrome.runtime.onInstalled.addListener(() => { ensureAlarm().then(() => serialized(async () => save(await jobs()))).catch(console.error); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm().then(() => serialized(poll)).catch(console.error); });

(() => {
  let selected = null;
  let scheduled = false;
  const CARD = 'ytd-rich-item-renderer,ytd-video-renderer,ytd-grid-video-renderer,ytd-compact-video-renderer,ytd-playlist-video-renderer,yt-lockup-view-model,ytd-reel-item-renderer';
  const POPUP = 'ytd-menu-popup-renderer, yt-sheet-view-model, yt-list-view-model';
  function parseLink(link) {
    try {
      const u = new URL(link, location.href);
      const id = u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})/)?.[1];
      return /^[\w-]{11}$/.test(id || '') ? `https://www.youtube.com/watch?v=${id}` : null;
    } catch { return null; }
  }
  function current() {
    const url = parseLink(location.href);
    if (!url) return null;
    const title = document.querySelector('ytd-watch-metadata h1, #title h1')?.textContent.trim() || document.title.replace(/\s*[-–]\s*YouTube$/, '').trim();
    return {url,title};
  }
  function fromCard(card) {
    if (!card) return null;
    const link = [...card.querySelectorAll('a[href]')].find(a => parseLink(a.href));
    if (!link) return null;
    const titleEl = card.querySelector('#video-title, #video-title-link, .yt-lockup-metadata-view-model__title, h3');
    return {url:parseLink(link.href), title:(titleEl?.getAttribute('title') || titleEl?.textContent || link.getAttribute('title') || '').trim()};
  }
  function toast(text, bad=false) {
    let box = document.getElementById('reclip-toast');
    if (!box) { box=document.createElement('div');box.id='reclip-toast';box.setAttribute('role','status');document.documentElement.append(box); }
    box.textContent=text;box.dataset.error=String(bad);box.hidden=false;
    clearTimeout(box.timer);box.timer=setTimeout(() => {box.hidden=true;},9000);
  }
  async function download(video, button) {
    if (!video?.url) {toast('Не удалось определить видео. Открой его страницу.',true);return;}
    button.disabled=true;
    toast('Передаю видео домашнему ReClip…');
    try {
      const result=await chrome.runtime.sendMessage({type:'download',...video});
      toast(result?.ok ? 'Видео готовится. Оно появится в Загрузки/YouTube. Статус — по значку расширения.' : result?.error || 'Не удалось запустить скачивание.', !result?.ok);
    } catch {toast('Расширение перезагружено. Обнови вкладку YouTube.',true);}
    finally {button.disabled=false;}
  }
  function button(menu) {
    const b=document.createElement('button');b.type='button';b.className=menu?'reclip-menu-button':'reclip-save-button';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('reclip-download-icon');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d','M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4');
    svg.append(path);
    const label=document.createElement('span');label.textContent='Скачать на ПК';
    b.append(svg,label);b.title='Скачать через домашний ReClip в Загрузки/YouTube';
    if (menu) b.setAttribute('role','menuitem');
    return b;
  }
  function visible(el) {return !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';}
  function update() {
    const video=current();
    const actions=document.querySelector('ytd-watch-metadata #top-level-buttons-computed, #menu-container #top-level-buttons-computed');
    if (actions && video && !actions.querySelector('.reclip-save-button')) {
      const b=button(false);b.onclick=() => download(current(),b);
      const save=[...actions.children].find(el => /^(сохранить|save)$|сохранить в плейлист/i.test(el.textContent.trim()) || /сохранить|save/i.test(el.querySelector('button')?.getAttribute('aria-label') || ''));
      actions.insertBefore(b,save || null);
    }
    // YouTube uses either Polymer popup renderers or the newer view-model menu.
    const popups=document.querySelectorAll(POPUP);
    for (const popup of popups) {
      // A sheet/list may wrap another matching renderer: process one menu root.
      if (popup.parentElement?.closest(POPUP)) continue;
      if (!visible(popup) || popup.closest('ytd-dialog, ytd-add-to-playlist-renderer')) continue;
      const first=popup.querySelector('ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, yt-list-item-view-model');
      if (!first) continue;
      const items=first.closest('#items, .yt-list-view-model__items') || first.parentElement;
      // Avoid adding to account/settings menus unrelated to a selected video.
      if (!selected && !video) continue;
      const existing=[...popup.querySelectorAll('.reclip-menu-button')];
      const b=existing.shift() || button(true);
      // Also repair duplicates left by reused YouTube menus or older content scripts.
      existing.forEach(duplicate => duplicate.remove());
      b.onclick=e => {e.stopPropagation();download(selected || current(),b);};
      if (items.firstElementChild !== b) items.prepend(b);
    }
  }
  document.addEventListener('click',event => {
    if (event.target.closest('.reclip-menu-button,.reclip-save-button')) return;
    const card=event.target.closest(CARD);
    if (card && event.target.closest('button,ytd-menu-renderer,yt-icon-button,yt-button-shape')) selected=fromCard(card);
    else if (event.target.closest('ytd-watch-metadata #actions')) selected=current();
    else if (!event.target.closest('ytd-menu-popup-renderer,yt-sheet-view-model,yt-list-view-model')) selected=null;
    schedule();
  },true);
  function schedule() {if(!scheduled){scheduled=true;setTimeout(() => {scheduled=false;update();},120);}}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('yt-navigate-finish',() => {selected=null;schedule();});
  update();
})();

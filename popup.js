const labels={preparing:'Готовится на сервере',saving:'Скачивается на ПК',done:'Скачано',error:'Ошибка'};
async function render(){
 const root=document.getElementById('jobs');
 try {
  const result=await chrome.runtime.sendMessage({type:'list'});
  if(result.error)throw new Error(result.error);
  root.replaceChildren();
  document.getElementById('clear-history').disabled=!result.jobs.some(j=>['done','error'].includes(j.state));
  if(!result.jobs.length){root.textContent='Нажми «Скачать на ПК» на YouTube.';return;}
  for(const job of [...result.jobs].reverse()){
   const item=document.createElement('article');const title=document.createElement('strong');title.textContent=job.title;item.append(title);
   const status=document.createElement('small');status.textContent=labels[job.state];item.append(status);
   if(job.error && job.state!=='done'){const error=document.createElement('small');error.className='error';error.textContent=job.error;item.append(error);}
   if(job.state==='done'){const b=document.createElement('button');b.textContent='Показать в папке';b.onclick=()=>chrome.downloads.show(job.downloadId);item.append(b);}
   if(['done','error'].includes(job.state)){
    const remove=document.createElement('button');remove.className='remove-history';remove.textContent='Удалить запись';
    remove.onclick=async()=>{remove.disabled=true;try{const result=await chrome.runtime.sendMessage({type:'removeHistory',id:job.id});if(!result?.ok)throw new Error(result?.error||'Не удалось удалить запись');await render();}catch(error){remove.disabled=false;status.textContent=error.message;}};
    item.append(remove);
   }
   root.append(item);
  }
 }catch(error){root.textContent=error.message;}
}
document.getElementById('clear-history').onclick=async()=>{
 const button=document.getElementById('clear-history');button.disabled=true;
 try{const result=await chrome.runtime.sendMessage({type:'clearHistory'});if(!result?.ok)throw new Error(result?.error||'Не удалось очистить историю');await render();}
 catch(error){document.getElementById('jobs').textContent=error.message;button.disabled=false;}
};
render();chrome.storage.onChanged.addListener(render);

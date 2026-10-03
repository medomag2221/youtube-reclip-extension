const labels={preparing:'Готовится на сервере',saving:'Скачивается на ПК',done:'Скачано',error:'Ошибка'};
async function render(){
 const root=document.getElementById('jobs');
 try {
  const result=await chrome.runtime.sendMessage({type:'list'});
  if(result.error)throw new Error(result.error);
  root.replaceChildren();
  if(!result.jobs.length){root.textContent='Нажми «Скачать на ПК» на YouTube.';return;}
  for(const job of [...result.jobs].reverse()){
   const item=document.createElement('article');const title=document.createElement('strong');title.textContent=job.title;item.append(title);
   const status=document.createElement('small');status.textContent=labels[job.state];item.append(status);
   if(job.error && job.state!=='done'){const error=document.createElement('small');error.className='error';error.textContent=job.error;item.append(error);}
   if(job.state==='done'){const b=document.createElement('button');b.textContent='Показать в папке';b.onclick=()=>chrome.downloads.show(job.downloadId);item.append(b);}
   root.append(item);
  }
 }catch(error){root.textContent=error.message;}
}
render();chrome.storage.onChanged.addListener(render);

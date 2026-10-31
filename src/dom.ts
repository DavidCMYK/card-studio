// Browser and download helpers.
export const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3200)};
export const download=(blob,name)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)};
export const jsonDownload=(obj,name)=>download(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),name);


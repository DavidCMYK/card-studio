/** Optional installable/offline shell. Project documents remain in user files/IndexedDB. */
if(typeof window!=='undefined'&&typeof navigator!=='undefined'&&
 'serviceWorker' in navigator &&
 (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
 window.addEventListener('load',()=>{
  void navigator.serviceWorker.register('./service-worker.js',{scope:'./'})
   .catch(error=>console.warn('Card Studio offline shell unavailable',error));
 });
}

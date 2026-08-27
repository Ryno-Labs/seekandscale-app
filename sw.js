/* Seek & Scale service worker: cache the app shell, never cache auth/API/payment responses. */
var CACHE='seek-scale-prod-v1';
var STATIC=[
  './','./index.html','./join.html','./signup.html','./success.html','./home.html','./directory.html','./shop.html','./forum.html','./helpdesk.html','./me.html','./article.html','./manifest.json',
  './assets/app.css','./assets/app.js','./assets/data.js','./assets/config.js',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/icon-512-maskable.png','./assets/icons/apple-touch-icon.png','./assets/icons/favicon-32.png'
];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(STATIC);}).then(function(){return self.skipWaiting();}));});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  var url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;                 // Supabase/CDN/Stripe: browser handles it
  if(url.search)return;                                       // never cache session ids, invite links or query data
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(function(res){return res;}).catch(function(){return caches.match(e.request,{ignoreSearch:true}).then(function(hit){return hit||caches.match('./index.html');});}));
    return;
  }
  if(STATIC.some(function(p){try{return new URL(p,self.registration.scope).pathname===url.pathname;}catch(_){return false;}})){
    e.respondWith(caches.match(e.request).then(function(hit){return hit||fetch(e.request);}));
  }
});

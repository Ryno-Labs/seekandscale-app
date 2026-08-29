var CACHE='seek-scale-community-v1-20260829';
var STATIC=[
  './assets/app.css?v=community-v1',
  './assets/app.js?v=community-v1',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png'
];

self.addEventListener('install',function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){
      return Promise.all(STATIC.map(function(url){return cache.add(url).catch(function(){});}));
    }).then(function(){return self.skipWaiting();})
  );
});

self.addEventListener('activate',function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){if(key!==CACHE)return caches.delete(key);}));
    }).then(function(){return self.clients.claim();})
  );
});

self.addEventListener('fetch',function(event){
  var request=event.request;
  if(request.method!=='GET')return;

  var url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request,{cache:'no-store'}).then(function(response){
        return response;
      }).catch(function(){
        return caches.match('./home.html').then(function(hit){
          return hit || new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then(function(response){
      if(response&&response.ok){
        var copy=response.clone();
        caches.open(CACHE).then(function(cache){cache.put(request,copy);});
      }
      return response;
    }).catch(function(){return caches.match(request);})
  );
});
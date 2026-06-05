const CACHE_NAME = 'depl-bom-ui-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    'https://i.postimg.cc/W3hvjn4q/CAPCO-HR-LOGO.jpg',
    'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(cacheNames.map(cacheName => {
                if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
            }));
        })
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('script.google.com') || event.request.url.includes('script.googleusercontent.com')) return; 
    
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request); 
        })
    );
});

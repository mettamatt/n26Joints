const CACHE_NAME = 'n26-pdf-to-csv-v1';
const urlsToCache = [
    'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js',
    'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.asm.wasm',
    'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.asm.data',
    'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.asm.js',
    'index.html',
    'script.js',
    'service-worker.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; // Cache hit - return response
                }
                return fetch(event.request).then(response => {
                    // Check if we received a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // IMPORTANT: Clone the response. A response is a stream
                    // and because we want the browser to consume the response
                    // as well as the cache consuming the response, we need
                    // to clone it so we have two streams.
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

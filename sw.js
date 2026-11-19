/**
 * KEEP MASTER PRO - Service Worker
 * Cache API, offline-first app shell, notifications & offline sync support.
 */

const CACHE_NAME = 'keep-master-v1.0.0';

// App shell assets to pre-cache
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './css/theme.css',
  './css/layout.css',
  './css/components.css',
  './css/responsive.css',
  './css/main.css',
  './js/config.js',
  './js/app.js',
  './js/utils/event-bus.js',
  './js/utils/helpers.js',
  './js/utils/sanitize.js',
  './js/utils/notifications.js',
  './js/database/schema.js',
  './js/database/indexeddb.js',
  './js/database/backup.js',
  './js/services/firebase.js',
  './js/services/auth.js',
  './js/services/storage.js',
  './js/sync/conflict-manager.js',
  './js/sync/sync-queue.js',
  './js/sync/sync-engine.js',
  './js/modules/notes.js',
  './js/modules/checklist.js',
  './js/modules/labels.js',
  './js/modules/reminders.js',
  './js/modules/search.js',
  './js/modules/drawing.js',
  './js/modules/audio.js',
  './js/modules/archive.js',
  './js/modules/trash.js',
  './js/modules/share.js',
  './js/components/header.js',
  './js/components/sidebar.js',
  './js/components/note-card.js',
  './js/components/note-editor.js',
  './js/components/drawing-modal.js',
  './js/components/audio-modal.js',
  './js/components/label-modal.js',
  './js/components/settings-modal.js',
  './js/components/auth-modal.js',
  './js/components/toast.js',
  './js/components/dialog.js'
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des ressources statiques');
      // Use addAll with error resilience
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Échec mise en cache de ${url}:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Suppression de l\'ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for static assets, network-only for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass Cache API for Firebase API, Firestore websockets, or Google APIs
  if (
    url.origin.includes('firebase') ||
    url.origin.includes('googleapis') ||
    url.origin.includes('firestore')
  ) {
    return;
  }

  // Bypass non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle app requests: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and requesting an HTML navigation, return cached index.html
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const noteId = event.notification.data?.noteId;
  const targetUrl = noteId ? `./index.html?note=${noteId}` : './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Background Sync if available
self.addEventListener('sync', (event) => {
  if (event.tag === 'keep-master-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_BACKGROUND_SYNC' });
        });
      })
    );
  }
});

const CACHE_NAME = 'planner-v3';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([
        './',
        './index.html',
        './css/app.css',
        './js/app.js',
        './manifest.webmanifest',
        './icons/icon.svg',
        './icons/icon-192.png',
        './icons/icon-512.png'
      ]).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── Notification scheduling ───────────────────────────────
let schedule = [];
let scheduleDate = '';
let notifiedSet = new Set();
const scheduledTimers = new Map();

self.addEventListener('message', event => {
  if (event.data?.type !== 'SCHEDULE_UPDATE') return;

  schedule = event.data.schedule || [];
  scheduleDate = event.data.date || '';
  notifiedSet = new Set(event.data.notified || []);
  rescheduleAll();
});

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToMsToday(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function clearScheduledTimers() {
  scheduledTimers.forEach(timer => clearTimeout(timer));
  scheduledTimers.clear();
}

function scheduleAt(key, ms, title, body) {
  if (scheduledTimers.has(key)) clearTimeout(scheduledTimers.get(key));

  const delay = ms - Date.now();
  if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;

  const timer = setTimeout(() => {
    scheduledTimers.delete(key);
    if (!notifiedSet.has(key)) {
      self.registration.showNotification(title, {
        body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: key
      });
      notifiedSet.add(key);
    }
  }, delay);

  scheduledTimers.set(key, timer);
}

function rescheduleAll() {
  clearScheduledTimers();
  if (scheduleDate !== todayKey()) return;

  schedule.forEach(item => {
    const startId = `${item.id}-start`;
    const endId = `${item.id}-end`;

    if (!notifiedSet.has(startId)) {
      scheduleAt(startId, timeToMsToday(item.start), `Time for ${item.name}!`, `Your ${item.name} session starts now.`);
    }
    if (!notifiedSet.has(endId)) {
      scheduleAt(endId, timeToMsToday(item.end), `${item.name} finished`, `Your ${item.name} session is over.`);
    }
  });
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});

self.addEventListener('push', event => {
  let data = {}; try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification('Confirm & Remind', { body: data.body || 'You have a reminder. Open Confirm & Remind.', icon: '/icon.svg', tag: data.tag || 'reminder', data: { url: data.url || '/' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) target.href = self.location.origin;
  event.waitUntil(clients.openWindow(target.href));
});

/**
 * ObraMaster - Activar / desactivar notificaciones push en este dispositivo.
 * El permiso solo se puede pedir tras pulsar un botón (en iPhone, además, con la app instalada).
 */

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function registerServiceWorker() {
  if (!pushSupported()) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('[push] No se pudo registrar el service worker:', err));
}

function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** 'activo' | 'inactivo' | 'bloqueado' | 'no_disponible' */
export async function getPushStatus() {
  if (!pushSupported()) return 'no_disponible';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? 'activo' : 'inactivo';
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Este navegador no admite notificaciones. En iPhone, instala primero la app en la pantalla de inicio.');
  const keyRes = await fetch('/api/push/public-key');
  const keyData = await keyRes.json().catch(() => ({}));
  if (!keyRes.ok || !keyData.enabled) throw new Error('El servidor no tiene configuradas las claves VAPID.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Has denegado el permiso de notificaciones en este navegador.');

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(keyData.publicKey) });
  }
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON())
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo guardar la suscripción.');
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint })
  }).catch(() => undefined);
  await sub.unsubscribe();
}

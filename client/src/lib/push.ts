import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const isPushConfigured = Boolean(VAPID_PUBLIC_KEY) && 'serviceWorker' in navigator && 'PushManager' in window;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw.split('').map((c) => c.charCodeAt(0)));
}

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushConfigured) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing ? 'subscribed' : 'unsubscribed';
}

// Asks for OS/browser permission, subscribes this device to push, and
// saves the subscription in Supabase so the server can target it later.
export async function subscribeToPush(userId: string): Promise<{ error: string | null }> {
  if (!isPushConfigured) return { error: 'Push no está configurado (falta VITE_VAPID_PUBLIC_KEY).' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { error: 'Permiso de notificaciones denegado.' };

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
  });

  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh!,
      auth: json.keys!.auth!,
    },
    { onConflict: 'endpoint' }
  );

  if (error) return { error: error.message };
  return { error: null };
}

export async function unsubscribeFromPush(): Promise<{ error: string | null }> {
  if (!isPushConfigured) return { error: null };
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { error: null };

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return { error: error ? error.message : null };
}

import api from '../../services/api';

/** Convierte la clave VAPID base64-url a Uint8Array (formato que pide PushManager). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
}

export function isPushSupported(): boolean {
    return typeof navigator !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

export function getPermission(): NotificationPermission | 'unsupported' {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker.ready;
}

export async function isSubscribed(): Promise<boolean> {
    try {
        const reg = await getRegistration();
        if (!reg) return false;
        const sub = await reg.pushManager.getSubscription();
        return !!sub;
    } catch {
        return false;
    }
}

export type SubscribeResult = { ok: boolean; reason?: 'unsupported' | 'denied' | 'not_configured' | 'no_sw' | 'error' };

/** Pide permiso, se suscribe vía PushManager y guarda la suscripción en el backend. */
export async function subscribeToPush(): Promise<SubscribeResult> {
    if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

    try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return { ok: false, reason: 'denied' };

        const { data } = await api.get('/push/public-key');
        if (!data?.publicKey || !data?.configured) return { ok: false, reason: 'not_configured' };

        const reg = await getRegistration();
        if (!reg) return { ok: false, reason: 'no_sw' };

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(data.publicKey) as BufferSource,
            });
        }

        const json = sub.toJSON() as { keys?: { p256dh: string; auth: string } };
        await api.post('/push/subscribe', { endpoint: sub.endpoint, keys: json.keys });
        return { ok: true };
    } catch (e) {
        console.error('[push] subscribe error:', e);
        return { ok: false, reason: 'error' };
    }
}

/** Cancela la suscripción de este dispositivo (local + backend). */
export async function unsubscribeFromPush(): Promise<void> {
    try {
        const reg = await getRegistration();
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
            const endpoint = sub.endpoint;
            await sub.unsubscribe().catch(() => {});
            await api.post('/push/unsubscribe', { endpoint }).catch(() => {});
        }
    } catch {
        /* noop */
    }
}

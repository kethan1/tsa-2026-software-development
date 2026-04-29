import { useEffect, useState } from 'react';

import { resolveEvent } from './data';
import type { SoundEvent } from './types';

// The beforeinstallprompt event isn't in the standard lib typings.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Register the service worker. Only runs for production builds so the dev server
 * (Vite middleware + HMR) is never shadowed by a stale cache.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SenseSync service worker registration failed:', err);
    });
  });
}

/** True when the app is running as an installed/standalone PWA. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

/**
 * Hook that surfaces the Add-to-Home-Screen install flow.
 * `canInstall` is true once the browser fires beforeinstallprompt (Android/Chromium);
 * `promptInstall` shows the native install dialog.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return { canInstall: !!deferred && !installed, installed, promptInstall };
}

export async function requestSoundNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export async function notifySoundEvent(event: SoundEvent) {
  if (!('Notification' in window)) return;
  const permission = await requestSoundNotificationPermission();
  if (permission !== 'granted') return;

  const resolved = resolveEvent(event);
  const title = resolved.isCritical ? `Critical sound: ${resolved.name}` : `Sound detected: ${resolved.name}`;
  const body = `${Math.round(event.confidence * 100)}% confidence · ${event.directionDeg}° direction`;
  const options: NotificationOptions = {
    body,
    tag: `sound-${event.id}`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/', eventId: event.id },
    requireInteraction: resolved.isCritical,
    silent: false,
  };

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
    } catch {
      // Fall through to the page-level notification path in dev or unsupported browsers.
    }
  }

  new Notification(title, options);
}

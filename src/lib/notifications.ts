import { soundEffects } from './audio/soundEffects';

// Helper to detect iOS device
export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

// Helper to check if running as installed standalone PWA
export const isStandalonePWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
};

// Helper to check if browser supports notifications
export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

// Get current permission status
export const getNotificationPermissionStatus = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export type PermissionResult =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported'
  | 'ios_pwa_required';

// Request notification permission safely for iOS PWA and all modern browsers
export const requestPushNotificationPermission = async (): Promise<PermissionResult> => {
  if (typeof window === 'undefined') return 'unsupported';

  // iOS 16.4+ requires the app to be added to the Home Screen (standalone) for Web Push
  if (isIOSDevice() && !isStandalonePWA()) {
    return 'ios_pwa_required';
  }

  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
};

// Display push notification using ServiceWorker (mandatory for iOS PWA) with desktop fallback
export const showPushNotification = async (
  title: string,
  options: NotificationOptions & { playSound?: boolean } = {}
): Promise<boolean> => {
  const { playSound = true, ...notificationOptions } = options;

  // Play subtle in-app sound chime if requested
  if (playSound) {
    try {
      soundEffects.playMessageSound();
    } catch {
      // Audio autoplay policy
    }
  }

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const payload: any = {
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    ...notificationOptions,
  };

  // 1. Try Service Worker showNotification (strictly required on iOS Safari / PWA)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, payload);
        return true;
      }
    } catch (swErr) {
      console.warn('Service worker showNotification error:', swErr);
    }
  }

  // 2. Desktop fallback: new Notification constructor (not supported on iOS WebKit)
  try {
    new Notification(title, payload);
    return true;
  } catch (notifErr) {
    console.warn('Desktop Notification constructor error:', notifErr);
    return false;
  }
};

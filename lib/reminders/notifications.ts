const REMINDER_NOTIFICATION_TAG = "endotrack-weekly-reminder";

function parseIsoDate(isoDate: string): Date {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Ungültiges Datum für die Erinnerung.");
  }
  return date;
}

export async function requestWeeklyReminderPermission(): Promise<"granted" | "denied" | "default"> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.warn("Benachrichtigungsberechtigung konnte nicht angefragt werden", error);
    return "denied";
  }
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return null;
  }

  if (typeof window !== "undefined") {
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      return null;
    }
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      return existing;
    }
  } catch (error) {
    console.warn("Vorhandene Service-Worker-Registrierung konnte nicht ermittelt werden", error);
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    return registration;
  } catch (error) {
    console.warn("Service Worker konnte nicht registriert werden", error);
    return null;
  }
}

function formatReminderTime(date: Date): Date {
  const scheduled = new Date(date);
  scheduled.setHours(18, 0, 0, 0);
  return scheduled;
}

export async function scheduleLocalWeeklyReminder(nextSundayISO: string): Promise<void> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    throw new Error("Benachrichtigungen werden von diesem Browser nicht unterstützt.");
  }

  const baseDate = parseIsoDate(nextSundayISO);
  const scheduledAt = formatReminderTime(baseDate);

  const registration = await ensureServiceWorkerRegistration();
  if (!registration) {
    throw new Error("Service Worker sind nicht verfügbar, Benachrichtigungen können nicht geplant werden.");
  }

  type TimestampTriggerCtor = new (timestamp: number) => { timestamp: number };

  const triggerCtor = (window as typeof window & {
    TimestampTrigger?: TimestampTriggerCtor;
  }).TimestampTrigger;

  if (!triggerCtor) {
    throw new Error("Geplante Benachrichtigungen werden von diesem Browser nicht unterstützt.");
  }

  interface ScheduledNotificationOptions extends NotificationOptions {
    renotify?: boolean;
    showTrigger?: InstanceType<TimestampTriggerCtor>;
  }

  const options: ScheduledNotificationOptions = {
    body: "Zeit für deinen wöchentlichen EndoTrack Check-in.",
    tag: REMINDER_NOTIFICATION_TAG,
    badge: "/icon-192.png",
    icon: "/icon-192.png",
    data: {
      url: "/weekly",
      scheduledAt: scheduledAt.toISOString(),
    },
    renotify: true,
    requireInteraction: false,
    showTrigger: new triggerCtor(scheduledAt.getTime()),
  };

  try {
    await registration.showNotification("EndoTrack Check-in", options);
  } catch (error) {
    console.warn("Benachrichtigung konnte nicht geplant werden", error);
    throw new Error("Die Benachrichtigung konnte nicht geplant werden.");
  }
}

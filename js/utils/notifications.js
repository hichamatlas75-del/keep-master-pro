/**
 * KEEP MASTER PRO - Notifications & Reminders Manager
 * Web Notifications API, Service Worker notifications, and reminder scheduler.
 *
 * DOCUMENTATION DES LIMITES PWA :
 * Les notifications Web en mode PWA dépendent du navigateur et du système d'exploitation :
 * 1. Sur ordinateur (Chrome, Edge, Firefox) et Android : les notifications fonctionnent si le Service Worker est actif
 *    ou si le navigateur est ouvert en arrière-plan.
 * 2. Sur iOS (Safari / PWA iOS 16.4+) : les Web Push requièrent une installation PWA sur l'écran d'accueil
 *    et une action utilisateur explicite pour accorder l'autorisation.
 * 3. Lorsque l'application est entièrement fermée sans serveur Web Push VAPID distant, les rappels locaux
 *    sont vérifiés automatiquement dès la prochaine ouverture ou réactivation de l'application via IndexedDB.
 */

class NotificationManager {
  constructor() {
    this.permission = 'default';
    this.activeTimers = new Map();
    this.init();
  }

  init() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Request browser notification permission
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('[Notifications] L\'API Web Notification n\'est pas supportée sur ce navigateur.');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result === 'granted';
    } catch (error) {
      console.error('[Notifications] Erreur lors de la demande d\'autorisation :', error);
      return false;
    }
  }

  /**
   * Display a notification (via Service Worker if available, or Notification constructor)
   */
  async show(title, options = {}) {
    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) return false;
    }

    const defaultOptions = {
      icon: './icons/icon-192.png',
      badge: './icons/favicon.svg',
      vibrate: [100, 50, 100],
      tag: 'keep-master-reminder',
      renotify: true,
      ...options
    };

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, defaultOptions);
          return true;
        }
      } catch (e) {
        console.warn('[Notifications] Échec via Service Worker, repli sur Notification standard :', e);
      }
    }

    try {
      new Notification(title, defaultOptions);
      return true;
    } catch (e) {
      console.error('[Notifications] Impossible d\'afficher la notification :', e);
      return false;
    }
  }

  /**
   * Schedule a reminder at a specific ISO date/time
   */
  scheduleReminder(note) {
    if (!note || !note.reminder || !note.reminder.date) return;
    const reminderDate = new Date(note.reminder.date);
    const now = new Date();
    const delay = reminderDate.getTime() - now.getTime();

    // Cancel existing timer for this note if any
    if (this.activeTimers.has(note.$id)) {
      clearTimeout(this.activeTimers.get(note.$id));
      this.activeTimers.delete(note.$id);
    }

    // If reminder is already in the past, do not schedule future timer
    if (delay <= 0) return;

    // JavaScript setTimeout has a 32-bit integer limit (~24.8 days)
    const MAX_DELAY = 2147483647;
    if (delay > MAX_DELAY) return;

    const timer = setTimeout(() => {
      this.triggerReminder(note);
      this.activeTimers.delete(note.$id);
    }, delay);

    this.activeTimers.set(note.$id, timer);
  }

  /**
   * Trigger note reminder
   */
  async triggerReminder(note) {
    const title = note.title || 'Rappel Keep Master';
    const body = note.content || (note.checklist?.length ? `${note.checklist.length} élément(s) dans la liste` : 'Vous avez un rappel programmé.');

    await this.show(`🔔 ${title}`, {
      body,
      data: { noteId: note.$id }
    });

    // Mark reminder as triggered in note
    import('../database/indexeddb.js').then(async ({ db }) => {
      if (note.reminder) {
        note.reminder.completed = true;
        note.updatedAt = new Date().toISOString();
        await db.saveNote(note);
      }
    });
  }

  /**
   * Cancel scheduled reminder
   */
  cancelReminder(noteId) {
    if (this.activeTimers.has(noteId)) {
      clearTimeout(this.activeTimers.get(noteId));
      this.activeTimers.delete(noteId);
    }
  }
}

export const notifications = new NotificationManager();

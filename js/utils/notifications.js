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
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Request browser notification permission
   */
  async requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
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

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
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
      if (typeof Notification !== 'undefined') {
        new Notification(title, defaultOptions);
        return true;
      }
      return false;
    } catch (e) {
      console.error('[Notifications] Impossible d\'afficher la notification :', e);
      return false;
    }
  }

  /**
   * Play an in-app audio chime using the Web Audio API
   */
  playReminderChime() {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      // Pleasant melodic two-tone chime (D5 -> A5)
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {
      // Audio autoplay policy or AudioContext unavailable
    }
  }

  /**
   * Schedule a reminder at a specific ISO date/time
   */
  scheduleReminder(note) {
    if (!note || !note.reminder || !note.reminder.date || note.reminder.completed) return;
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

    // 1. Play in-app audio chime
    this.playReminderChime();

    // 2. Try native system notification
    await this.show(`🔔 ${title}`, {
      body,
      data: { noteId: note.$id }
    });

    // 3. Fallback & guarantee: In-app Toast alert with direct action to open note
    try {
      const { Toast } = await import('../components/toast.js');
      const { eventBus } = await import('./event-bus.js');
      Toast.show(`🔔 Rappel : ${title}`, {
        duration: 8000,
        actionText: 'Ouvrir',
        onAction: () => {
          eventBus.emit('note:open', { noteId: note.$id });
        }
      });
    } catch (toastErr) {}

    // 4. Update reminder status: Advance date if recurring (daily/weekly) or mark completed
    if (note.reminder) {
      const repeat = note.reminder.repeat || 'none';
      let nextDate = null;
      let completed = true;

      if (repeat === 'daily') {
        const d = new Date(note.reminder.date);
        const now = new Date();
        while (d.getTime() <= now.getTime()) {
          d.setDate(d.getDate() + 1);
        }
        nextDate = d.toISOString();
        completed = false;
      } else if (repeat === 'weekly') {
        const d = new Date(note.reminder.date);
        const now = new Date();
        while (d.getTime() <= now.getTime()) {
          d.setDate(d.getDate() + 7);
        }
        nextDate = d.toISOString();
        completed = false;
      }

      import('../modules/notes.js').then(({ NotesModule }) => {
        NotesModule.updateNote(note.$id, {
          reminder: {
            ...note.reminder,
            date: nextDate || note.reminder.date,
            completed
          }
        });
      }).catch((err) => console.warn('[Notifications] Erreur mise à jour rappel :', err));
    }
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

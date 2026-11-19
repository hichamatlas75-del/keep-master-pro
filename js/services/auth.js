/**
 * KEEP MASTER PRO - Appwrite Authentication Service
 * User registration, login, session management & Guest mode fallback.
 */

import { appwrite } from './appwrite.js';
import { db } from '../database/indexeddb.js';
import { eventBus } from '../utils/event-bus.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isGuest = true;
  }

  async init() {
    const isAppwriteReady = await appwrite.init();
    if (!isAppwriteReady) {
      await this.setGuestUser();
      return this.currentUser;
    }

    try {
      const user = await appwrite.account.get();
      this.currentUser = user;
      this.isGuest = false;
      await db.setSetting('current_user_id', user.$id);
    } catch (err) {
      // 401 or not logged in -> use guest session
      await this.setGuestUser();
    }

    eventBus.emit('auth:change', { user: this.currentUser, isGuest: this.isGuest });
    return this.currentUser;
  }

  async setGuestUser() {
    const savedGuestId = await db.getSetting('guest_user_id');
    const guestId = savedGuestId || 'guest_' + Math.random().toString(36).substring(2, 9);
    if (!savedGuestId) {
      await db.setSetting('guest_user_id', guestId);
    }

    this.currentUser = {
      $id: guestId,
      name: 'Utilisateur Local',
      email: '',
      isAnonymous: true
    };
    this.isGuest = true;
  }

  /**
   * Register a new user with Appwrite
   */
  async register(email, password, name) {
    if (!appwrite.isConfigured) {
      throw new Error('Appwrite Cloud n\'est pas encore configuré. Veuillez renseigner le Project ID dans les Paramètres.');
    }

    const { ID } = appwrite.SDK;
    const user = await appwrite.account.create(ID.unique(), email, password, name);
    // Auto-login after registration
    await this.login(email, password);
    return user;
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    if (!appwrite.isConfigured) {
      throw new Error('Appwrite Cloud n\'est pas encore configuré. Vérifiez vos paramètres.');
    }

    // If an active session exists, delete it first
    try {
      await appwrite.account.deleteSession('current');
    } catch (e) {
      // Ignore if no session
    }

    // Appwrite SDK v14/v16 uses createEmailPasswordSession
    let session;
    if (appwrite.account.createEmailPasswordSession) {
      session = await appwrite.account.createEmailPasswordSession(email, password);
    } else if (appwrite.account.createEmailSession) {
      session = await appwrite.account.createEmailSession(email, password);
    }

    const user = await appwrite.account.get();
    this.currentUser = user;
    this.isGuest = false;
    await db.setSetting('current_user_id', user.$id);

    eventBus.emit('auth:change', { user: this.currentUser, isGuest: false });
    eventBus.emit('sync:trigger');

    return user;
  }

  /**
   * Logout
   */
  async logout() {
    if (appwrite.isConfigured && !this.isGuest) {
      try {
        await appwrite.account.deleteSession('current');
      } catch (err) {
        console.warn('[Auth] Erreur de déconnexion distante :', err);
      }
    }

    await this.setGuestUser();
    await db.setSetting('current_user_id', this.currentUser.$id);

    eventBus.emit('auth:change', { user: this.currentUser, isGuest: true });
    return true;
  }

  getUser() {
    return this.currentUser;
  }

  getUserId() {
    return this.currentUser ? this.currentUser.$id : 'guest';
  }
}

export const auth = new AuthService();

/**
 * KEEP MASTER PRO - Firebase Authentication Service
 * User registration, login, session state with onAuthStateChanged & Guest mode fallback.
 */

import { firebase } from './firebase.js';
import { db } from '../database/indexeddb.js';
import { eventBus } from '../utils/event-bus.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isGuest = true;
    this.authUnsubscribe = null;
  }

  async init() {
    const isFirebaseReady = await firebase.init();
    if (!isFirebaseReady) {
      await this.setGuestUser();
      return this.currentUser;
    }

    return new Promise((resolve) => {
      const { onAuthStateChanged } = firebase.SDK.auth;

      this.authUnsubscribe = onAuthStateChanged(firebase.auth, async (user) => {
        if (user) {
          this.currentUser = {
            $id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
            email: user.email || '',
            isAnonymous: user.isAnonymous
          };
          this.isGuest = false;
          await db.setSetting('current_user_id', user.uid);
        } else {
          await this.setGuestUser();
        }

        eventBus.emit('auth:change', { user: this.currentUser, isGuest: this.isGuest });
        eventBus.emit('sync:trigger');
        resolve(this.currentUser);
      }, (error) => {
        console.warn('[Auth] Erreur écoute état Firebase Auth :', error);
        this.setGuestUser().then(() => resolve(this.currentUser));
      });
    });
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
   * Register a new user with Firebase Authentication
   */
  async register(email, password, name) {
    if (!firebase.isConfigured) {
      throw new Error('Firebase n\'est pas encore configuré. Renseignez votre API Key et Project ID dans les Paramètres.');
    }

    const { createUserWithEmailAndPassword, updateProfile } = firebase.SDK.auth;
    const userCredential = await createUserWithEmailAndPassword(firebase.auth, email, password);

    if (name && updateProfile) {
      await updateProfile(userCredential.user, { displayName: name });
    }

    this.currentUser = {
      $id: userCredential.user.uid,
      name: name || email.split('@')[0],
      email: userCredential.user.email,
      isAnonymous: false
    };
    this.isGuest = false;
    await db.setSetting('current_user_id', userCredential.user.uid);

    eventBus.emit('auth:change', { user: this.currentUser, isGuest: false });
    eventBus.emit('sync:trigger');

    return this.currentUser;
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    if (!firebase.isConfigured) {
      throw new Error('Firebase n\'est pas encore configuré. Vérifiez vos paramètres.');
    }

    const { signInWithEmailAndPassword } = firebase.SDK.auth;
    const userCredential = await signInWithEmailAndPassword(firebase.auth, email, password);

    this.currentUser = {
      $id: userCredential.user.uid,
      name: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'Utilisateur',
      email: userCredential.user.email,
      isAnonymous: false
    };
    this.isGuest = false;
    await db.setSetting('current_user_id', userCredential.user.uid);

    eventBus.emit('auth:change', { user: this.currentUser, isGuest: false });
    eventBus.emit('sync:trigger');

    return this.currentUser;
  }

  /**
   * Logout
   */
  async logout() {
    if (firebase.isConfigured && !this.isGuest && firebase.auth) {
      try {
        const { signOut } = firebase.SDK.auth;
        await signOut(firebase.auth);
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

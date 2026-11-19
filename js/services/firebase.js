/**
 * KEEP MASTER PRO - Firebase Service
 * Initializes Firebase App, Firebase Authentication & Cloud Firestore (Modular ES SDK)
 * Designed for Spark Free Plan with offline resilience.
 */

import { APP_CONFIG } from '../config.js';
import { db } from '../database/indexeddb.js';

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.firestore = null;
    this.SDK = null;
    this.isConfigured = false;
    this.config = { ...APP_CONFIG.FIREBASE };
  }

  /**
   * Initialize Firebase SDK client
   */
  async init() {
    // 1. Retrieve saved Firebase configuration from IndexedDB settings
    const savedConfig = await db.getSetting('firebase_config');
    if (savedConfig && typeof savedConfig === 'object') {
      this.config = { ...this.config, ...savedConfig };
    }

    // Check if minimal required configuration exists (API Key + Project ID)
    if (!this.config.API_KEY || !this.config.PROJECT_ID) {
      this.isConfigured = false;
      return false;
    }

    // 2. Load Modular Firebase Web SDK dynamically from CDN
    if (!this.SDK) {
      try {
        const [appMod, authMod, firestoreMod] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
        ]);

        this.SDK = {
          app: appMod,
          auth: authMod,
          firestore: firestoreMod
        };
      } catch (err) {
        console.warn('[Firebase] Impossible de charger le SDK Firebase depuis le CDN (Mode hors-ligne ou réseau restreint) :', err.message);
        this.isConfigured = false;
        return false;
      }
    }

    try {
      const firebaseConfig = {
        apiKey: this.config.API_KEY,
        authDomain: this.config.AUTH_DOMAIN || `${this.config.PROJECT_ID}.firebaseapp.com`,
        projectId: this.config.PROJECT_ID,
        storageBucket: this.config.STORAGE_BUCKET || `${this.config.PROJECT_ID}.appspot.com`,
        messagingSenderId: this.config.MESSAGING_SENDER_ID || '',
        appId: this.config.APP_ID || ''
      };

      // Initialize or reuse Firebase App
      this.app = this.SDK.app.getApps().length > 0
        ? this.SDK.app.getApp()
        : this.SDK.app.initializeApp(firebaseConfig);

      this.auth = this.SDK.auth.getAuth(this.app);
      this.firestore = this.SDK.firestore.getFirestore(this.app);
      this.isConfigured = true;

      return true;
    } catch (err) {
      console.error('[Firebase] Erreur lors de l\'initialisation de Firebase :', err);
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Update Firebase configuration dynamically from Settings UI
   */
  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    await db.setSetting('firebase_config', this.config);
    return this.init();
  }

  /**
   * Check if Firebase is reachable
   */
  async ping() {
    if (!this.isConfigured || !this.firestore) return false;
    try {
      const { doc, getDoc } = this.SDK.firestore;
      // Lightweight check of a ping doc
      const testRef = doc(this.firestore, '_ping', 'status');
      await getDoc(testRef);
      return true;
    } catch (err) {
      // Permission-denied still means Firestore is reachable!
      if (err.code === 'permission-denied' || err.code === 'unauthenticated') {
        return true;
      }
      console.warn('[Firebase] Ping failed:', err.message);
      return false;
    }
  }
}

export const firebase = new FirebaseService();

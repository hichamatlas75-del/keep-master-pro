/**
 * KEEP MASTER PRO - Appwrite Cloud Service Client
 * TablesDB, Account, Storage, Realtime client initialization with offline fallback.
 */

import { APP_CONFIG } from '../config.js';
import { db } from '../database/indexeddb.js';

class AppwriteService {
  constructor() {
    this.client = null;
    this.account = null;
    this.databases = null;
    this.storage = null;
    this.SDK = null;
    this.isConfigured = false;
    this.endpoint = APP_CONFIG.APPWRITE.ENDPOINT;
    this.projectId = APP_CONFIG.APPWRITE.PROJECT_ID;
  }

  /**
   * Initialize Appwrite SDK client
   */
  async init() {
    // 1. Check local saved settings for custom endpoint/projectId
    const savedEndpoint = await db.getSetting('appwrite_endpoint');
    const savedProjectId = await db.getSetting('appwrite_project_id');

    if (savedEndpoint) this.endpoint = savedEndpoint;
    if (savedProjectId) this.projectId = savedProjectId;

    // 2. Load SDK dynamically from CDN with local graceful fallback
    if (!this.SDK) {
      try {
        // Official Appwrite Web SDK ES module from jsdelivr
        const sdkModule = await import('https://cdn.jsdelivr.net/npm/appwrite@16.1.0/+esm');
        this.SDK = sdkModule;
      } catch (err) {
        console.warn('[Appwrite] Impossible de charger le SDK Appwrite depuis le CDN (Mode hors-ligne ou réseau restreint). Repli sur le mode local :', err.message);
        return false;
      }
    }

    if (!this.SDK || !this.projectId) {
      this.isConfigured = false;
      return false;
    }

    try {
      const { Client, Account, Databases, Storage } = this.SDK;
      this.client = new Client();
      this.client
        .setEndpoint(this.endpoint)
        .setProject(this.projectId);

      this.account = new Account(this.client);
      this.databases = new Databases(this.client);
      this.storage = new Storage(this.client);
      this.isConfigured = true;

      return true;
    } catch (err) {
      console.error('[Appwrite] Erreur lors de l\'initialisation du client :', err);
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Update configuration dynamically from Settings UI
   */
  async updateConfig(endpoint, projectId) {
    this.endpoint = endpoint || APP_CONFIG.APPWRITE.ENDPOINT;
    this.projectId = projectId || APP_CONFIG.APPWRITE.PROJECT_ID;

    await db.setSetting('appwrite_endpoint', this.endpoint);
    await db.setSetting('appwrite_project_id', this.projectId);

    return this.init();
  }

  /**
   * Check if Appwrite is reachable
   */
  async ping() {
    if (!this.isConfigured || !this.account) return false;
    try {
      await this.account.get();
      return true;
    } catch (err) {
      // If error is 401 unauthorized, Appwrite is reachable! (just not logged in)
      if (err.code === 401) return true;
      return false;
    }
  }
}

export const appwrite = new AppwriteService();

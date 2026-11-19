/**
 * KEEP MASTER PRO - Global Configuration & Constants
 * Firebase Cloud & IndexedDB Offline-First
 */

export const APP_CONFIG = {
  APP_NAME: 'KEEP MASTER PRO',
  VERSION: '1.1.0',

  // IndexedDB Configuration (Local Primary Store)
  DB_NAME: 'KeepMasterProDB',
  DB_VERSION: 1,
  STORES: {
    NOTES: 'notes',
    LABELS: 'labels',
    REMINDERS: 'reminders',
    SHARES: 'shares',
    SYNC_QUEUE: 'sync_queue',
    SETTINGS: 'settings',
    MEDIA_BLOBS: 'media_blobs'
  },

  // Firebase Configuration Defaults (Pre-configured for KEEP MASTER PRO)
  FIREBASE: {
    API_KEY: 'AIzaSyAm2mOkPWlx1ACgYaMF0hHQH-GR0nz-SnE',
    AUTH_DOMAIN: 'keep-master-pro.firebaseapp.com',
    PROJECT_ID: 'keep-master-pro',
    STORAGE_BUCKET: 'keep-master-pro.firebasestorage.app',
    MESSAGING_SENDER_ID: '368689220471',
    APP_ID: '1:368689220471:web:b291bbfd16fdcb44502f72',
    COLLECTIONS: {
      NOTES: 'notes',
      LABELS: 'labels',
      REMINDERS: 'reminders',
      SHARES: 'shares'
    }
  },

  // 10 Note Colors matching Keep Aesthetics
  NOTE_COLORS: [
    { id: 'default', name: 'Par défaut', class: 'bg-default', hexLight: '#ffffff', hexDark: '#28292c' },
    { id: 'coral',   name: 'Corail',    class: 'bg-coral',   hexLight: '#f28b82', hexDark: '#5c2b29' },
    { id: 'peach',   name: 'Pêche',     class: 'bg-peach',   hexLight: '#fbbc04', hexDark: '#614a19' },
    { id: 'sand',    name: 'Sable',     class: 'bg-sand',    hexLight: '#fff475', hexDark: '#635d19' },
    { id: 'mint',    name: 'Menthe',    class: 'bg-mint',    hexLight: '#ccff90', hexDark: '#345920' },
    { id: 'sage',    name: 'Sauge',     class: 'bg-sage',    hexLight: '#a7ffeb', hexDark: '#16504b' },
    { id: 'fog',     name: 'Brume',     class: 'bg-fog',     hexLight: '#cbf0f8', hexDark: '#2d555e' },
    { id: 'storm',   name: 'Orage',     class: 'bg-storm',   hexLight: '#aecbfa', hexDark: '#1e3a5f' },
    { id: 'dusk',    name: 'Crépuscule', class: 'bg-dusk',   hexLight: '#d7aefb', hexDark: '#42275e' },
    { id: 'blossom', name: 'Fleur',     class: 'bg-blossom', hexLight: '#fdcfe8', hexDark: '#5b2245' }
  ],

  // Note Types
  NOTE_TYPES: {
    TEXT: 'text',
    CHECKLIST: 'checklist',
    DRAWING: 'drawing',
    AUDIO: 'audio'
  },

  // Sync operations
  SYNC_OPERATIONS: {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE'
  },

  // Sync Statuses
  SYNC_STATUS: {
    ONLINE: 'online',
    OFFLINE: 'offline',
    SYNCING: 'syncing',
    ERROR: 'error'
  }
};

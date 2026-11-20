/**
 * KEEP MASTER PRO - Utility Helpers
 */

/**
 * Generate a unique ID (RFC4122 v4 UUID with fallback)
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 20); // Standard unique ID format
  }
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Format timestamp into human readable French date/time
 */
export function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/**
 * Relative time description (e.g., "Il y a 5 min", "Hier", etc.)
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'À l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHour < 24) return `Il y a ${diffHour} h`;
  if (diffDay === 1) return 'Hier';
  if (diffDay < 7) return `Il y a ${diffDay} j`;

  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

/**
 * Debounce function to limit rapid calls (e.g. for search or auto-save)
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Safe deep clone
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Convert audio blob / image blob to base64 Data URL
 */
export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert dataURL to Blob
 */
export function dataURLToBlob(dataURL) {
  const parts = dataURL.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

let compressorWorker = null;

function getCompressorWorker() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return null;
  }
  if (!compressorWorker) {
    try {
      compressorWorker = new Worker(new URL('../workers/image-compressor.worker.js', import.meta.url), { type: 'module' });
    } catch (_) {
      try {
        compressorWorker = new Worker('./js/workers/image-compressor.worker.js');
      } catch (e) {
        compressorWorker = null;
      }
    }
  }
  return compressorWorker;
}

/**
 * Compress and resize an image blob off the main UI thread via Web Worker
 * with main-thread HTMLCanvas fallback.
 * Prevents exceeding Firestore 1MB document limit and eliminates UI stutter.
 */
export async function compressImage(fileOrBlob, maxWidth = 1280, maxHeight = 1280, quality = 0.82) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fileOrBlob;
  }
  if (!fileOrBlob || !fileOrBlob.type || !fileOrBlob.type.startsWith('image/') || fileOrBlob.type === 'image/gif' || fileOrBlob.type === 'image/svg+xml') {
    return fileOrBlob;
  }

  // Fallback function using main-thread Canvas
  const fallbackMainThread = () => {
    if (typeof Image === 'undefined') return Promise.resolve(fileOrBlob);

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(fileOrBlob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;

        if (width <= maxWidth && height <= maxHeight && fileOrBlob.size < 400 * 1024) {
          return resolve(fileOrBlob);
        }

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve(blob || fileOrBlob);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(fileOrBlob);
      };

      img.src = url;
    });
  };

  // 1. Try OffscreenCanvas background Web Worker
  const worker = getCompressorWorker();
  if (worker) {
    return new Promise((resolve) => {
      const id = 'comp_' + Math.random().toString(36).substring(2, 9);
      const timeout = setTimeout(() => {
        cleanup();
        fallbackMainThread().then(resolve);
      }, 5000);

      const handler = (e) => {
        if (e.data && e.data.id === id) {
          cleanup();
          if (e.data.success && e.data.blob) {
            resolve(e.data.blob);
          } else {
            fallbackMainThread().then(resolve);
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        worker.removeEventListener('message', handler);
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ id, blob: fileOrBlob, maxWidth, maxHeight, quality });
    });
  }

  // 2. Fallback to main-thread canvas
  return fallbackMainThread();
}

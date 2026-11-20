/**
 * KEEP MASTER PRO - OCR & Text Extraction Module
 * Extracts text from images, photos, and drawings client-side.
 * Uses native Shape Detection API (TextDetector) when available,
 * with resilient fallback to dynamic client-side Tesseract.js.
 */

export class OCRModule {
  /**
   * Check if OCR can be performed in the current browser
   */
  static isSupported() {
    return (
      (typeof window !== 'undefined' && 'TextDetector' in window) ||
      (typeof navigator !== 'undefined' && navigator.onLine)
    );
  }

  /**
   * Extract text from an image source (dataURL, Blob, or URL)
   * @param {string|Blob|File} imageSource
   * @param {Function} [onProgress]
   * @returns {Promise<string>} Extracted text
   */
  static async extractText(imageSource, onProgress) {
    if (!imageSource) {
      throw new Error('Aucune source d\'image fournie pour l\'OCR.');
    }

    if (typeof window === 'undefined') {
      return '';
    }

    // 1. Try Native Shape Detection TextDetector API (Fastest, 0 bundle size, offline-ready)
    if ('TextDetector' in window) {
      try {
        const detector = new window.TextDetector();
        const img = await this._loadImage(imageSource);
        const results = await detector.detect(img);
        if (results && results.length > 0) {
          const rawText = results.map(r => r.rawValue || '').filter(Boolean).join('\n').trim();
          if (rawText) {
            return rawText;
          }
        }
      } catch (nativeErr) {
        console.warn('[OCR] TextDetector natif a échoué ou non supporté pour cette image :', nativeErr);
      }
    }

    // 2. Fallback to client-side Tesseract.js (Modular ESM on-demand)
    try {
      if (onProgress) onProgress('Chargement du moteur OCR...');
      const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');

      if (onProgress) onProgress('Initialisation de la reconnaissance...');
      const worker = await createWorker('fra+eng', 1, {
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            onProgress(`Analyse du texte : ${pct}%`);
          }
        }
      });

      const ret = await worker.recognize(imageSource);
      await worker.terminate();

      return (ret.data?.text || '').trim();
    } catch (err) {
      console.warn('[OCR] Moteur Tesseract non disponible ou hors-ligne :', err);
      throw new Error('Impossible d\'extraire le texte de cette image (Mode hors-ligne ou texte non détecté).');
    }
  }

  /**
   * Helper to load an image into an HTMLImageElement
   */
  static _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      if (src instanceof Blob) {
        const url = URL.createObjectURL(src);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Échec de chargement du blob image.'));
        };
        img.src = url;
      } else if (typeof src === 'string') {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Échec de chargement de l\'URL image.'));
        img.src = src;
      } else {
        reject(new Error('Format d\'image non supporté.'));
      }
    });
  }
}

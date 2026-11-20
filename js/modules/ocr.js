/**
 * KEEP MASTER PRO - OCR & Text Extraction Module
 * Extracts text from images, photos, and drawings client-side.
 * Features:
 * - Adaptive canvas preprocessing (grayscale, contrast stretching, auto-inversion, upscaling)
 * - Native Shape Detection API (TextDetector) when available (fast & offline)
 * - Intelligent fallback to client-side Tesseract.js (fra+eng)
 * - OCR noise filtering and text cleanup
 */

export class OCRModule {
  /**
   * Check if OCR can be performed in the current browser
   */
  static isSupported() {
    return Boolean(
      (typeof window !== 'undefined' && 'TextDetector' in window) ||
      (typeof navigator !== 'undefined' && Boolean(navigator.onLine))
    );
  }

  /**
   * Preprocess image on an offscreen canvas to maximize OCR contrast and sharpness
   * - Upscales low-res images
   * - Converts to grayscale
   * - Stretches dynamic contrast & applies adaptive thresholding
   * - Inverts dark-mode images so text is dark on light background
   */
  static async preprocessImage(imgElement) {
    try {
      if (typeof document === 'undefined') return null;
      const w = imgElement.naturalWidth || imgElement.width;
      const h = imgElement.naturalHeight || imgElement.height;
      if (!w || !h) return null;

      // Upscale if image is small (characters < 20px tall fail OCR)
      const scale = Math.max(1, Math.min(2.5, 1200 / Math.min(w, h)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const totalPixels = data.length / 4;

      let sumLuma = 0;
      let minLuma = 255;
      let maxLuma = 0;

      // 1. Calculate luminance and min/max/average
      for (let i = 0; i < data.length; i += 4) {
        // ITU-R BT.601 luminance
        const luma = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = luma;
        data[i + 1] = luma;
        data[i + 2] = luma;

        sumLuma += luma;
        if (luma < minLuma) minLuma = luma;
        if (luma > maxLuma) maxLuma = luma;
      }

      const avgLuma = sumLuma / totalPixels;
      const lumaRange = maxLuma - minLuma || 1;
      const shouldInvert = avgLuma < 120; // If dark background with light text, invert

      // 2. High-contrast stretch and optional inversion
      for (let i = 0; i < data.length; i += 4) {
        let val = Math.round(((data[i] - minLuma) / lumaRange) * 255);

        // Contrast enhancement S-curve
        if (val < 110) {
          val = Math.max(0, val - 30);
        } else if (val > 145) {
          val = Math.min(255, val + 30);
        }

        if (shouldInvert) {
          val = 255 - val;
        }

        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imgData, 0, 0);
      return canvas;
    } catch (err) {
      console.warn('[OCR] Prétraitement de l\'image ignoré :', err);
      return null;
    }
  }

  /**
   * Post-process and sanitize raw OCR output
   */
  static cleanExtractedText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    return rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      // Filter out isolated typical OCR artifact characters on their own line
      .filter(line => !/^[_~|\u2022•\-\*\.]{1,2}$/.test(line))
      .join('\n')
      // Collapse excessive empty lines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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

    if (onProgress) onProgress('Chargement de l\'image...');
    const originalImg = await this._loadImage(imageSource);

    // 1. Preprocess image for high contrast & sharpness
    if (onProgress) onProgress('Optimisation du contraste et netteté...');
    const preprocessedCanvas = await this.preprocessImage(originalImg);
    const candidateSource = preprocessedCanvas || originalImg;

    // 2. Try Native Shape Detection TextDetector API (Fastest, 0 bundle size, offline-ready)
    if ('TextDetector' in window) {
      try {
        if (onProgress) onProgress('Détection rapide du texte...');
        const detector = new window.TextDetector();
        let results = await detector.detect(candidateSource);

        if ((!results || results.length === 0) && candidateSource !== originalImg) {
          // Retry with original image if preprocessed had no results
          results = await detector.detect(originalImg);
        }

        if (results && results.length > 0) {
          const rawText = results.map(r => r.rawValue || '').filter(Boolean).join('\n');
          const cleaned = this.cleanExtractedText(rawText);
          if (cleaned && cleaned.length >= 2) {
            return cleaned;
          }
        }
      } catch (nativeErr) {
        console.warn('[OCR] TextDetector natif a échoué ou non supporté pour cette image :', nativeErr);
      }
    }

    // 3. Fallback to client-side Tesseract.js (Modular ESM on-demand)
    try {
      if (onProgress) onProgress('Chargement du moteur OCR haute précision...');
      const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');

      if (onProgress) onProgress('Initialisation de la reconnaissance...');
      const worker = await createWorker('fra+eng', 1, {
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            onProgress(`Reconnaissance du texte : ${pct}%`);
          }
        }
      });

      const ret = await worker.recognize(candidateSource);
      await worker.terminate();

      const cleaned = this.cleanExtractedText(ret.data?.text || '');
      return cleaned;
    } catch (err) {
      console.warn('[OCR] Moteur Tesseract non disponible ou hors-ligne :', err);
      throw new Error('Impossible d\'extraire le texte de cette image (Vérifiez votre connexion internet ou la netteté de l\'image).');
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

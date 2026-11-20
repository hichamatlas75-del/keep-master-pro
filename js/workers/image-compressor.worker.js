/**
 * KEEP MASTER PRO - Offscreen Image Compression Web Worker
 * Performs asynchronous image decoding and compression off the main UI thread.
 */

self.onmessage = async (e) => {
  const { id, blob, maxWidth = 1280, maxHeight = 1280, quality = 0.82 } = e.data;

  try {
    if (!blob) {
      throw new Error('Aucun blob fourni au worker.');
    }

    // Decode image asynchronously off the main thread using createImageBitmap
    const bitmap = await createImageBitmap(blob);
    let { width, height } = bitmap;

    // Constrain dimensions maintaining aspect ratio
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

    // Use OffscreenCanvas for hardware-accelerated off-thread rendering
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');

    // Fill white background for transparent pngs converted to jpeg
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close(); // Free GPU memory immediately

    const compressedBlob = await offscreen.convertToBlob({
      type: 'image/jpeg',
      quality
    });

    self.postMessage({ id, success: true, blob: compressedBlob });
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};

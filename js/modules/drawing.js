/**
 * KEEP MASTER PRO - Drawing Engine (HTML5 Canvas)
 * Pen, eraser, stroke width, color selection, undo/redo & PNG export.
 */

import { dataURLToBlob } from '../utils/helpers.js';

export class DrawingEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isDrawing = false;
    this.currentTool = 'pen'; // 'pen' | 'eraser'
    this.currentColor = '#000000';
    this.currentWidth = 3;
    this.history = [];
    this.redoStack = [];
    this.lastX = 0;
    this.lastY = 0;
    this.logicalWidth = 0;
    this.logicalHeight = 0;
    this.activePointerId = null;
    this._resizeTimer = null;

    this._onPointerDown = (e) => this.startDrawing(e);
    this._onPointerMove = (e) => this.draw(e);
    this._onPointerUp = (e) => this.stopDrawing(e);
    this._onPointerCancel = (e) => this.stopDrawing(e);
    this._onPointerLeave = (e) => {
      if (this.activePointerId !== null && this.canvas.hasPointerCapture?.(this.activePointerId)) {
        return;
      }
      this.stopDrawing(e);
    };
    this._onWindowResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        const parent = this.canvas?.parentElement;
        if (!parent) return;
        const w = parent.clientWidth || Math.round(parent.getBoundingClientRect().width);
        const h = parent.clientHeight || Math.round(parent.getBoundingClientRect().height);
        if (w > 0 && h > 0 && (w !== this.logicalWidth || h !== this.logicalHeight)) {
          this.resizeCanvas();
        }
      }, 120);
    };

    this.init();
  }

  init() {
    this.resizeCanvas();
    this.saveState();

    // Event listeners for Pointer Events (supports mouse, stylus, and touch seamlessly)
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('pointercancel', this._onPointerCancel);
    this.canvas.addEventListener('pointerleave', this._onPointerLeave);
    window.addEventListener('resize', this._onWindowResize);
  }

  destroy() {
    clearTimeout(this._resizeTimer);
    this._resizeTimer = null;
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
      this.canvas.removeEventListener('pointerup', this._onPointerUp);
      this.canvas.removeEventListener('pointercancel', this._onPointerCancel);
      this.canvas.removeEventListener('pointerleave', this._onPointerLeave);
    }
    window.removeEventListener('resize', this._onWindowResize);
  }

  _getCanvasSize() {
    if (this.logicalWidth > 0 && this.logicalHeight > 0) {
      return { width: this.logicalWidth, height: this.logicalHeight };
    }
    const rect = this.canvas.getBoundingClientRect();
    return { width: rect.width || 300, height: rect.height || 300 };
  }

  _applyStrokeStyle() {
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    if (this.currentTool === 'eraser') {
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.lineWidth = this.currentWidth * 4;
    } else {
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.fillStyle = this.currentColor;
      this.ctx.lineWidth = this.currentWidth;
    }
  }

  _restoreSnapshot(dataUrl) {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const { width, height } = this._getCanvasSize();
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.drawImage(img, 0, 0, width, height);
    };
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth || Math.round(parent.getBoundingClientRect().width);
    const height = parent.clientHeight || Math.round(parent.getBoundingClientRect().height);
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const lastData = this.history && this.history.length > 0 ? this.history[this.history.length - 1] : null;

    this.logicalWidth = width;
    this.logicalHeight = height;

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Initial white background
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, width, height);

    if (lastData) {
      this._restoreSnapshot(lastData);
    }
  }

  getPointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.logicalWidth / (rect.width || this.logicalWidth || 1);
    const scaleY = this.logicalHeight / (rect.height || this.logicalHeight || 1);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  startDrawing(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();

    if (this.logicalWidth === 0 || this.logicalHeight === 0) {
      this.resizeCanvas();
    }

    this.isDrawing = true;
    this.activePointerId = e.pointerId ?? null;
    if (this.activePointerId !== null) {
      try {
        this.canvas.setPointerCapture?.(this.activePointerId);
      } catch (_) {}
    }

    const pos = this.getPointerPos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;

    this._applyStrokeStyle();
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x + 0.01, pos.y + 0.01);
    this.ctx.stroke();
  }

  draw(e) {
    if (!this.isDrawing) return;
    if (this.activePointerId !== null && e.pointerId !== undefined && e.pointerId !== this.activePointerId) {
      return;
    }
    e.preventDefault();

    const pos = this.getPointerPos(e);
    this._applyStrokeStyle();
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();

    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  stopDrawing(e) {
    if (!this.isDrawing) return;
    if (this.activePointerId !== null && e?.pointerId !== undefined && e.pointerId !== this.activePointerId) {
      return;
    }

    this.isDrawing = false;
    if (this.activePointerId !== null) {
      try {
        this.canvas.releasePointerCapture?.(this.activePointerId);
      } catch (_) {}
      this.activePointerId = null;
    }
    this.saveState();
  }

  setTool(tool) {
    this.currentTool = tool; // 'pen' | 'eraser'
  }

  setColor(hexColor) {
    this.currentColor = hexColor;
    if (this.currentTool === 'eraser') {
      this.currentTool = 'pen';
    }
  }

  setWidth(width) {
    this.currentWidth = Number(width) || 3;
  }

  clear() {
    const { width, height } = this._getCanvasSize();
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, width, height);
    this.saveState();
  }

  saveState() {
    if (this.canvas.width === 0 || this.canvas.height === 0) return;
    this.history.push(this.canvas.toDataURL('image/png'));
    if (this.history.length > 20) {
      this.history.shift();
    }
    this.redoStack = [];
  }

  undo() {
    if (this.history.length <= 1) return;
    const current = this.history.pop();
    this.redoStack.push(current);
    const prevState = this.history[this.history.length - 1];
    this._restoreSnapshot(prevState);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const nextState = this.redoStack.pop();
    this.history.push(nextState);
    this._restoreSnapshot(nextState);
  }

  /**
   * Export drawing as PNG Blob with DataURL fallback
   */
  async exportBlob() {
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      this.resizeCanvas();
    }

    return new Promise((resolve, reject) => {
      const fallbackFromDataUrl = () => {
        try {
          const dataUrl = this.canvas.toDataURL('image/png');
          resolve(dataURLToBlob(dataUrl));
        } catch (err) {
          reject(err);
        }
      };

      if (typeof this.canvas.toBlob === 'function') {
        try {
          this.canvas.toBlob((blob) => {
            if (blob && blob.size > 0) {
              resolve(blob);
            } else {
              fallbackFromDataUrl();
            }
          }, 'image/png');
        } catch (_) {
          fallbackFromDataUrl();
        }
      } else {
        fallbackFromDataUrl();
      }
    });
  }

  /**
   * Export drawing as dataURL
   */
  toDataURL() {
    return this.canvas.toDataURL('image/png');
  }
}

/**
 * KEEP MASTER PRO - Drawing Engine (HTML5 Canvas)
 * Pen, eraser, stroke width, color selection, undo/redo & PNG export.
 */

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

    this.init();
  }

  init() {
    this.resizeCanvas();
    this.saveState();

    // Event listeners for Pointer Events (supports mouse, stylus, and touch seamlessly)
    this.canvas.addEventListener('pointerdown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('pointermove', (e) => this.draw(e));
    this.canvas.addEventListener('pointerup', () => this.stopDrawing());
    this.canvas.addEventListener('pointerleave', () => this.stopDrawing());
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const lastData = this.history && this.history.length > 0 ? this.history[this.history.length - 1] : null;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    // Initial white background
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, rect.width, rect.height);

    if (lastData) {
      const img = new Image();
      img.src = lastData;
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
    }
  }

  getPointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  startDrawing(e) {
    this.isDrawing = true;
    const pos = this.getPointerPos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  draw(e) {
    if (!this.isDrawing) return;

    const pos = this.getPointerPos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x, pos.y);

    if (this.currentTool === 'eraser') {
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = this.currentWidth * 4;
    } else {
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.currentWidth;
    }

    this.ctx.stroke();
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  stopDrawing() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
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
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, rect.width, rect.height);
    this.saveState();
  }

  saveState() {
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

    const img = new Image();
    img.src = prevState;
    img.onload = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const nextState = this.redoStack.pop();
    this.history.push(nextState);

    const img = new Image();
    img.src = nextState;
    img.onload = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
  }

  /**
   * Export drawing as PNG Blob
   */
  async exportBlob() {
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  /**
   * Export drawing as dataURL
   */
  toDataURL() {
    return this.canvas.toDataURL('image/png');
  }
}

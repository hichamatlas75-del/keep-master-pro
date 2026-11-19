/**
 * KEEP MASTER PRO - Drawing Modal Component
 * Full-featured interactive HTML5 canvas drawing board.
 */

import { DrawingEngine } from '../modules/drawing.js';
import { storage } from '../services/storage.js';
import { eventBus } from '../utils/event-bus.js';
import { Toast } from './toast.js';

export class DrawingModal {
  constructor() {
    this.modalEl = null;
    this.engine = null;
    this.init();
  }

  init() {
    eventBus.on('modal:drawing', ({ onSave }) => {
      this.open(onSave);
    });
  }

  open(onSave) {
    const container = document.getElementById('modalsContainer');
    if (!container) return;

    if (this.modalEl) {
      this.engine?.destroy();
      this.engine = null;
      this.modalEl.remove();
      this.modalEl = null;
    }

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop';
    this.modalEl.addEventListener('click', (e) => e.stopPropagation());

    this.modalEl.innerHTML = `
      <div class="modal-content" style="max-width: 720px;">
        <div class="modal-header">
          <h3 class="modal-title">Dessin & Croquis</h3>
          <button id="closeDrawingModalBtn" class="btn-icon" aria-label="Fermer">×</button>
        </div>

        <div class="modal-body">
          <div class="drawing-container">
            <div class="drawing-toolbar">
              <div class="drawing-tools-group">
                <button id="drawPenBtn" class="btn-icon" style="background:var(--accent-subtle);color:var(--accent-text);" title="Stylo">✏️</button>
                <button id="drawEraserBtn" class="btn-icon" title="Gomme">🧹</button>
                <div style="width:1px;height:24px;background:var(--border-color);margin:0 4px;"></div>
                <input type="color" id="drawColorPicker" value="#000000" style="width:30px;height:30px;border:none;cursor:pointer;border-radius:50%;" title="Couleur">
                <div style="width:1px;height:24px;background:var(--border-color);margin:0 4px;"></div>
                <label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:4px;">
                  Taille:
                  <input type="range" id="drawStrokeWidth" min="1" max="25" value="3" style="width:80px;cursor:pointer;">
                </label>
              </div>

              <div class="drawing-tools-group">
                <button id="drawUndoBtn" class="btn-icon" title="Annuler">↩️</button>
                <button id="drawRedoBtn" class="btn-icon" title="Rétablir">↪️</button>
                <button id="drawClearBtn" class="btn-secondary" style="font-size:12px;padding:4px 8px;">Effacer</button>
              </div>
            </div>

            <div class="canvas-wrapper">
              <canvas id="drawingCanvas" class="canvas-element"></canvas>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button id="cancelDrawingBtn" class="btn-secondary">Annuler</button>
          <button id="saveDrawingBtn" class="btn-primary">Enregistrer le dessin</button>
        </div>
      </div>
    `;

    container.appendChild(this.modalEl);

    const canvas = this.modalEl.querySelector('#drawingCanvas');
    this.engine = new DrawingEngine(canvas);

    // Toolbar binds
    const penBtn = this.modalEl.querySelector('#drawPenBtn');
    const eraserBtn = this.modalEl.querySelector('#drawEraserBtn');
    const colorPicker = this.modalEl.querySelector('#drawColorPicker');
    const strokeSlider = this.modalEl.querySelector('#drawStrokeWidth');
    const saveBtn = this.modalEl.querySelector('#saveDrawingBtn');

    const syncToolButtons = (activeTool) => {
      if (activeTool === 'pen') {
        penBtn.style.background = 'var(--accent-subtle)';
        penBtn.style.color = 'var(--accent-text)';
        eraserBtn.style.background = 'transparent';
        eraserBtn.style.color = 'var(--text-secondary)';
      } else {
        eraserBtn.style.background = 'var(--accent-subtle)';
        eraserBtn.style.color = 'var(--accent-text)';
        penBtn.style.background = 'transparent';
        penBtn.style.color = 'var(--text-secondary)';
      }
    };

    penBtn.onclick = () => {
      this.engine.setTool('pen');
      syncToolButtons('pen');
    };

    eraserBtn.onclick = () => {
      this.engine.setTool('eraser');
      syncToolButtons('eraser');
    };

    colorPicker.oninput = (e) => {
      this.engine.setColor(e.target.value);
      syncToolButtons('pen');
    };
    strokeSlider.oninput = (e) => this.engine.setWidth(e.target.value);

    this.modalEl.querySelector('#drawUndoBtn').onclick = () => this.engine.undo();
    this.modalEl.querySelector('#drawRedoBtn').onclick = () => this.engine.redo();
    this.modalEl.querySelector('#drawClearBtn').onclick = () => this.engine.clear();

    // Close actions
    const close = () => {
      this.engine?.destroy();
      this.engine = null;
      this.modalEl?.remove();
      this.modalEl = null;
    };

    this.modalEl.querySelector('#closeDrawingModalBtn').onclick = close;
    this.modalEl.querySelector('#cancelDrawingBtn').onclick = close;

    // Save action
    saveBtn.onclick = async () => {
      if (saveBtn.disabled || !this.engine) return;

      saveBtn.disabled = true;
      saveBtn.textContent = 'Enregistrement...';

      try {
        const blob = await this.engine.exportBlob();
        if (!blob || blob.size === 0) {
          throw new Error('Le dessin est vide ou invalide.');
        }

        const filename = `drawing-${Date.now()}.png`;
        const attachment = await storage.saveAttachment(blob, filename, 'image/png', { kind: 'drawing' });
        if (onSave) await onSave(attachment);
        close();
      } catch (err) {
        console.error('[DrawingModal] Erreur sauvegarde dessin :', err);
        Toast.show(err.message || 'Impossible d\'enregistrer le dessin.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Enregistrer le dessin';
      }
    };
  }
}

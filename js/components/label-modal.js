/**
 * KEEP MASTER PRO - Labels Manager Modal Component
 * Add, rename, and delete custom tags/labels.
 */

import { LabelsModule } from '../modules/labels.js';
import { db } from '../database/indexeddb.js';
import { escapeHTML } from '../utils/sanitize.js';
import { eventBus } from '../utils/event-bus.js';
import { Dialog } from './dialog.js';

export class LabelModal {
  constructor() {
    this.modalEl = null;
    this.init();
  }

  init() {
    eventBus.on('modal:labels', () => this.open());
  }

  async open() {
    if (this.modalEl) {
      this.close();
    }

    const container = document.getElementById('modalsContainer');
    if (!container) return;

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop';

    this.modalEl.innerHTML = `
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">Modifier les libellés</h3>
          <button id="closeLabelModalBtn" class="btn-icon">×</button>
        </div>

        <div class="modal-body" style="gap:12px;">
          <!-- New Label Input -->
          <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-color);padding-bottom:10px;">
            <input type="text" id="newLabelInput" placeholder="Créer un libellé" style="flex:1;font-size:14px;padding:6px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-input);">
            <button id="addNewLabelBtn" class="btn-primary" style="padding:6px 14px;">Créer</button>
          </div>

          <!-- Existing labels list -->
          <div id="labelsListContainer" style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;"></div>
        </div>

        <div class="modal-footer">
          <button id="doneLabelModalBtn" class="btn-primary">Terminé</button>
        </div>
      </div>
    `;

    container.appendChild(this.modalEl);

    const input = this.modalEl.querySelector('#newLabelInput');
    const addBtn = this.modalEl.querySelector('#addNewLabelBtn');
    const listContainer = this.modalEl.querySelector('#labelsListContainer');

    const refreshList = async () => {
      const labels = await db.getLabels();
      listContainer.innerHTML = '';

      if (labels.length === 0) {
        listContainer.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:12px;">Aucun libellé pour l'instant.</div>`;
        return;
      }

      labels.forEach(lbl => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;gap:8px;';
        row.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;flex:1;">
            <span style="font-size:16px;">🏷️</span>
            <input type="text" class="label-name-input" value="${escapeHTML(lbl.name)}" style="flex:1;font-size:14px;padding:4px;border:1px solid transparent;border-radius:4px;">
          </div>
          <button class="btn-icon label-delete-btn" title="Supprimer le libellé" style="color:var(--danger-color);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        `;

        const nameInput = row.querySelector('.label-name-input');
        nameInput.onfocus = () => {
          nameInput.style.borderColor = 'var(--border-color)';
          nameInput.style.background = 'var(--bg-input)';
        };
        nameInput.onblur = () => {
          nameInput.style.borderColor = 'transparent';
          nameInput.style.background = 'transparent';
          if (nameInput.value.trim() && nameInput.value.trim() !== lbl.name) {
            LabelsModule.updateLabel(lbl.$id, nameInput.value.trim());
          }
        };

        row.querySelector('.label-delete-btn').onclick = async () => {
          const confirmed = await Dialog.confirm({
            title: `Supprimer le libellé "${lbl.name}" ?`,
            message: 'Ce libellé sera retiré de toutes vos notes associées. Les notes ne seront pas supprimées.',
            confirmText: 'Supprimer',
            isDanger: true
          });
          if (confirmed) {
            await LabelsModule.deleteLabel(lbl.$id);
            refreshList();
          }
        };

        listContainer.appendChild(row);
      });
    };

    const handleCreate = async () => {
      const val = input.value.trim();
      if (!val) return;
      try {
        await LabelsModule.createLabel(val);
        input.value = '';
        refreshList();
      } catch (err) {
        alert(err.message);
      }
    };

    addBtn.onclick = handleCreate;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') handleCreate();
    };

    const close = () => {
      this.modalEl.remove();
      this.modalEl = null;
    };

    this.modalEl.querySelector('#closeLabelModalBtn').onclick = close;
    this.modalEl.querySelector('#doneLabelModalBtn').onclick = close;

    let isMouseDownOnBackdrop = false;
    this.modalEl.addEventListener('mousedown', (e) => {
      isMouseDownOnBackdrop = (e.target === this.modalEl);
    });
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl && isMouseDownOnBackdrop) {
        close();
      }
      isMouseDownOnBackdrop = false;
    });

    refreshList();
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }
}

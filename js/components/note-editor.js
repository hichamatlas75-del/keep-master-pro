/**
 * KEEP MASTER PRO - Note Editor Component
 * Manages Note Creator bar and Full Modal Note Editor with live auto-save.
 */

import { NotesModule } from '../modules/notes.js';
import { ChecklistModule } from '../modules/checklist.js';
import { storage } from '../services/storage.js';
import { APP_CONFIG } from '../config.js';
import { debounce, deepClone } from '../utils/helpers.js';
import { escapeHTML, sanitizeUrl } from '../utils/sanitize.js';
import { eventBus } from '../utils/event-bus.js';
import { db } from '../database/indexeddb.js';

export class NoteEditor {
  constructor() {
    this.creatorBox = document.getElementById('noteCreator');
    this.collapsedBar = document.getElementById('creatorCollapsed');
    this.expandedBox = document.getElementById('creatorExpanded');
    this.titleInput = document.getElementById('creatorTitle');
    this.contentInput = document.getElementById('creatorContent');
    this.checklistContainer = document.getElementById('creatorChecklistContainer');
    this.attachmentsContainer = document.getElementById('creatorAttachments');
    this.chipsContainer = document.getElementById('creatorChips');
    this.pinBtn = document.getElementById('creatorPinBtn');
    this.closeBtn = document.getElementById('creatorCloseBtn');

    // State for creator
    this.currentNote = this.getDefaultState();
    this.modalBackdrop = null;

    this.init();
  }

  getDefaultState() {
    return {
      title: '',
      content: '',
      type: 'text',
      color: 'default',
      pinned: false,
      checklist: [],
      labels: [],
      reminder: null,
      attachments: []
    };
  }

  init() {
    // 1. Expand on click
    if (this.collapsedBar) {
      this.collapsedBar.onclick = () => this.expandCreator('text');
    }

    // Quick action buttons in collapsed state
    document.getElementById('quickListBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.expandCreator('checklist');
    });

    document.getElementById('quickDrawingBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.expandCreator('text');
      eventBus.emit('modal:drawing', {
        onSave: (att) => this.addAttachment(att)
      });
    });

    document.getElementById('quickImageBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.expandCreator('text');
      this.triggerImageUpload((att) => this.addAttachment(att));
    });

    document.getElementById('quickAudioBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.expandCreator('text');
      eventBus.emit('modal:audio', {
        onSave: (att) => this.addAttachment(att)
      });
    });

    // Close and save button
    if (this.closeBtn) {
      this.closeBtn.onclick = () => this.saveAndCollapse();
    }

    // Creator toolbar buttons
    this.bindCreatorTools();

    // Listen to open modal requests from NoteCard
    eventBus.on('editor:open', (note) => this.openEditModal(note));

    // Click outside creator to auto-save and collapse
    document.addEventListener('click', (e) => {
      if (this.creatorBox && !this.creatorBox.contains(e.target) && !this.expandedBox.classList.contains('hidden')) {
        this.saveAndCollapse();
      }
    });
  }

  expandCreator(type = 'text') {
    this.currentNote.type = type;
    this.collapsedBar.classList.add('hidden');
    this.expandedBox.classList.remove('hidden');

    if (type === 'checklist') {
      this.contentInput.classList.add('hidden');
      this.checklistContainer.classList.remove('hidden');
      if (this.currentNote.checklist.length === 0) {
        this.currentNote.checklist = [{ id: '1', text: '', completed: false }];
      }
      this.renderChecklist(this.checklistContainer, this.currentNote);
    } else {
      this.contentInput.classList.remove('hidden');
      this.checklistContainer.classList.add('hidden');
      this.contentInput.focus();
    }
  }

  saveAndCollapse() {
    this.currentNote.title = this.titleInput.value.trim();
    if (this.currentNote.type === 'text') {
      this.currentNote.content = this.contentInput.value.trim();
    }

    const hasChecklist = this.currentNote.type === 'checklist' && this.currentNote.checklist.some(i => i.text.trim());
    const hasContent = this.currentNote.title || this.currentNote.content || hasChecklist || this.currentNote.attachments.length > 0;

    if (hasContent) {
      // Filter out empty checklist items
      if (this.currentNote.type === 'checklist') {
        this.currentNote.checklist = this.currentNote.checklist.filter(i => i.text.trim());
      }
      NotesModule.createNote(this.currentNote);
    }

    // Reset creator state
    this.currentNote = this.getDefaultState();
    this.titleInput.value = '';
    this.contentInput.value = '';
    this.creatorBox.className = 'note-creator bg-default';
    this.attachmentsContainer.innerHTML = '';
    this.chipsContainer.innerHTML = '';
    this.checklistContainer.innerHTML = '';
    this.pinBtn.classList.remove('pinned');

    this.expandedBox.classList.add('hidden');
    this.collapsedBar.classList.remove('hidden');
  }

  bindCreatorTools() {
    // Pin toggle
    this.pinBtn?.addEventListener('click', () => {
      this.currentNote.pinned = !this.currentNote.pinned;
      this.pinBtn.classList.toggle('pinned', this.currentNote.pinned);
    });

    // Color popover
    document.getElementById('creatorColorBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openColorPopover(e.currentTarget, (col) => {
        this.currentNote.color = col;
        this.creatorBox.className = `note-creator bg-${col}`;
      });
    });

    // Drawing modal
    document.getElementById('creatorDrawingBtn')?.addEventListener('click', () => {
      eventBus.emit('modal:drawing', {
        onSave: (att) => this.addAttachment(att)
      });
    });

    // Audio modal
    document.getElementById('creatorAudioBtn')?.addEventListener('click', () => {
      eventBus.emit('modal:audio', {
        onSave: (att) => this.addAttachment(att)
      });
    });

    // Image upload
    document.getElementById('creatorImageBtn')?.addEventListener('click', () => {
      this.triggerImageUpload((att) => this.addAttachment(att));
    });

    // Reminder picker
    document.getElementById('creatorReminderBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openReminderPicker(e.currentTarget, (reminder) => {
        this.currentNote.reminder = reminder;
        this.renderChips(this.chipsContainer, this.currentNote);
      });
    });

    // Labels picker
    document.getElementById('creatorLabelsBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openLabelPicker(e.currentTarget, this.currentNote, () => {
        this.renderChips(this.chipsContainer, this.currentNote);
      });
    });

    // Archive in creator
    document.getElementById('creatorArchiveBtn')?.addEventListener('click', () => {
      this.currentNote.archived = true;
      this.currentNote.pinned = false;
      this.saveAndCollapse();
      Toast.show('Note créée et archivée', {
        actionText: 'Voir archives',
        onAction: () => {
          eventBus.emit('view:change', { view: 'archive', labelId: null });
        }
      });
    });
  }

  addAttachment(attachment) {
    this.currentNote.attachments.push(attachment);
    this.renderAttachments(this.attachmentsContainer, this.currentNote);
  }

  renderAttachments(container, note) {
    container.innerHTML = '';
    (note.attachments || []).forEach((att, idx) => {
      const item = document.createElement('div');
      item.className = 'attachment-preview-item';
      if (att.type.startsWith('image/')) {
        item.innerHTML = `
          <img src="${sanitizeUrl(att.url)}" alt="${escapeHTML(att.name)}">
          <button class="attachment-remove-btn" title="Supprimer">×</button>
        `;
      } else if (att.type.startsWith('audio/')) {
        item.innerHTML = `
          <div style="padding:10px;font-size:11px;text-align:center;">🎵 Audio</div>
          <button class="attachment-remove-btn" title="Supprimer">×</button>
        `;
      }
      item.querySelector('.attachment-remove-btn').onclick = (e) => {
        e.stopPropagation();
        note.attachments.splice(idx, 1);
        storage.deleteAttachment(att);
        this.renderAttachments(container, note);
      };
      container.appendChild(item);
    });
  }

  renderChips(container, note) {
    container.innerHTML = '';
    if (note.reminder && note.reminder.date) {
      const chip = document.createElement('div');
      chip.className = 'chip reminder-chip';
      chip.innerHTML = `
        <span>⏰ ${new Date(note.reminder.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        <span style="cursor:pointer;margin-left:4px;">×</span>
      `;
      chip.querySelector('span:last-child').onclick = () => {
        note.reminder = null;
        this.renderChips(container, note);
      };
      container.appendChild(chip);
    }

    db.getLabels().then(allLabels => {
      const labelMap = new Map(allLabels.map(l => [l.$id, l]));
      (note.labels || []).forEach(lblId => {
        const lbl = labelMap.get(lblId);
        if (lbl) {
          const chip = document.createElement('div');
          chip.className = 'chip';
          chip.innerHTML = `
            <span>🏷️ ${escapeHTML(lbl.name)}</span>
            <span style="cursor:pointer;margin-left:4px;">×</span>
          `;
          chip.querySelector('span:last-child').onclick = () => {
            note.labels = note.labels.filter(id => id !== lblId);
            this.renderChips(container, note);
          };
          container.appendChild(chip);
        }
      });
    });
  }

  renderChecklist(container, note) {
    container.innerHTML = '';
    note.checklist.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = `checklist-item ${item.completed ? 'checked' : ''}`;
      row.innerHTML = `
        <input type="checkbox" class="checklist-checkbox" ${item.completed ? 'checked' : ''}>
        <input type="text" class="checklist-text" value="${escapeHTML(item.text)}" placeholder="Élément de la liste">
        <button class="btn-icon checklist-delete-btn" style="width:24px;height:24px;">×</button>
      `;

      const checkbox = row.querySelector('.checklist-checkbox');
      const textInput = row.querySelector('.checklist-text');
      const delBtn = row.querySelector('.checklist-delete-btn');

      checkbox.onchange = () => {
        note.checklist = ChecklistModule.toggleItem(note.checklist, item.id);
        this.renderChecklist(container, note);
      };

      textInput.oninput = () => {
        item.text = textInput.value;
      };

      textInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          note.checklist = ChecklistModule.addItem(note.checklist, ' ');
          this.renderChecklist(container, note);
          // Focus last created item
          setTimeout(() => {
            const inputs = container.querySelectorAll('.checklist-text');
            inputs[inputs.length - 1]?.focus();
          }, 10);
        }
      };

      delBtn.onclick = () => {
        note.checklist = ChecklistModule.removeItem(note.checklist, item.id);
        this.renderChecklist(container, note);
      };

      container.appendChild(row);
    });

    // "Ajouter un élément" row
    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;color:var(--text-muted);cursor:pointer;font-size:13px;';
    addRow.innerHTML = `<span>+</span> <span>Ajouter un élément</span>`;
    addRow.onclick = () => {
      note.checklist.push({ id: Date.now().toString(36), text: '', completed: false });
      this.renderChecklist(container, note);
      setTimeout(() => {
        const inputs = container.querySelectorAll('.checklist-text');
        inputs[inputs.length - 1]?.focus();
      }, 10);
    };
    container.appendChild(addRow);
  }

  /**
   * Open Full Modal Editor for existing note
   */
  openEditModal(note) {
    const editNote = deepClone(note);
    const container = document.getElementById('modalsContainer');
    if (!container) return;

    this.modalBackdrop = document.createElement('div');
    this.modalBackdrop.className = 'modal-backdrop';

    this.modalBackdrop.innerHTML = `
      <div class="modal-content bg-${editNote.color || 'default'}" style="max-width: 650px;">
        <div class="modal-header" style="border:none;padding-bottom:0;">
          <input type="text" id="modalNoteTitle" class="note-title-input" value="${escapeHTML(editNote.title)}" placeholder="Titre" style="font-size:18px;">
          <button id="modalPinBtn" class="btn-icon ${editNote.pinned ? 'pinned' : ''}" title="Épingler">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${editNote.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M16 2l6 6-7 7-4-4 5-5z"></path><path d="M2 22l7-7"></path><path d="M7 11l-4 4 4 4 4-4"></path></svg>
          </button>
        </div>

        <div class="modal-body">
          <div id="modalAttachments" class="creator-attachments"></div>
          ${editNote.type === 'checklist' ? '<div id="modalChecklist" class="checklist-container"></div>' : `<textarea id="modalNoteContent" class="note-body-textarea" style="min-height:160px;" placeholder="Note...">${escapeHTML(editNote.content)}</textarea>`}
          <div id="modalChips" class="note-card-chips"></div>
        </div>

        <div class="modal-footer" style="justify-content:space-between;">
          <div class="creator-tools">
            <button id="modalColorBtn" class="btn-icon" title="Couleur"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 0 20v-2a8 8 0 0 0 0-16V2z"></path></svg></button>
            <button id="modalImageBtn" class="btn-icon" title="Image"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></button>
            <button id="modalDrawingBtn" class="btn-icon" title="Dessin"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg></button>
            <button id="modalReminderBtn" class="btn-icon" title="Rappel"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></button>
            <button id="modalLabelsBtn" class="btn-icon" title="Libellés"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg></button>
            <button id="modalArchiveBtn" class="btn-icon" title="${editNote.archived ? 'Désarchiver' : 'Archiver'}">
              ${editNote.archived ? `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><polyline points="10 13 12 11 14 13"></polyline><line x1="12" y1="11" x2="12" y2="17"></line></svg>
              ` : `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
              `}
            </button>
          </div>
          <button id="modalCloseBtn" class="btn-primary">Fermer</button>
        </div>
      </div>
    `;

    container.appendChild(this.modalBackdrop);

    const titleEl = this.modalBackdrop.querySelector('#modalNoteTitle');
    const contentEl = this.modalBackdrop.querySelector('#modalNoteContent');
    const attContainer = this.modalBackdrop.querySelector('#modalAttachments');
    const chipsCont = this.modalBackdrop.querySelector('#modalChips');
    const modalContent = this.modalBackdrop.querySelector('.modal-content');

    this.renderAttachments(attContainer, editNote);
    this.renderChips(chipsCont, editNote);

    if (editNote.type === 'checklist') {
      const chkContainer = this.modalBackdrop.querySelector('#modalChecklist');
      this.renderChecklist(chkContainer, editNote);
    }

    // Live auto-save on input with debounce
    const autoSave = debounce(() => {
      editNote.title = titleEl.value;
      if (contentEl) editNote.content = contentEl.value;
      NotesModule.updateNote(editNote.$id, editNote);
    }, 400);

    titleEl.oninput = autoSave;
    if (contentEl) contentEl.oninput = autoSave;

    // Pin toggle
    const pinBtn = this.modalBackdrop.querySelector('#modalPinBtn');
    pinBtn.onclick = () => {
      editNote.pinned = !editNote.pinned;
      pinBtn.classList.toggle('pinned', editNote.pinned);
      NotesModule.updateNote(editNote.$id, { pinned: editNote.pinned });
    };

    // Color popover
    this.modalBackdrop.querySelector('#modalColorBtn').onclick = (e) => {
      e.stopPropagation();
      this.openColorPopover(e.currentTarget, (col) => {
        editNote.color = col;
        modalContent.className = `modal-content bg-${col}`;
        NotesModule.updateNote(editNote.$id, { color: col });
      });
    };

    // Drawing in modal
    this.modalBackdrop.querySelector('#modalDrawingBtn').onclick = () => {
      eventBus.emit('modal:drawing', {
        onSave: (att) => {
          editNote.attachments.push(att);
          this.renderAttachments(attContainer, editNote);
          NotesModule.updateNote(editNote.$id, { attachments: editNote.attachments });
        }
      });
    };

    // Image upload in modal
    this.modalBackdrop.querySelector('#modalImageBtn').onclick = () => {
      this.triggerImageUpload((att) => {
        editNote.attachments.push(att);
        this.renderAttachments(attContainer, editNote);
        NotesModule.updateNote(editNote.$id, { attachments: editNote.attachments });
      });
    };

    // Reminder in modal
    this.modalBackdrop.querySelector('#modalReminderBtn').onclick = (e) => {
      e.stopPropagation();
      this.openReminderPicker(e.currentTarget, (reminder) => {
        editNote.reminder = reminder;
        this.renderChips(chipsCont, editNote);
        NotesModule.updateNote(editNote.$id, { reminder });
      });
    };

    // Labels in modal
    this.modalBackdrop.querySelector('#modalLabelsBtn').onclick = (e) => {
      e.stopPropagation();
      this.openLabelPicker(e.currentTarget, editNote, () => {
        this.renderChips(chipsCont, editNote);
        NotesModule.updateNote(editNote.$id, { labels: editNote.labels });
      });
    };

    // Archive in modal
    this.modalBackdrop.querySelector('#modalArchiveBtn').onclick = async () => {
      editNote.title = titleEl.value;
      if (contentEl) editNote.content = contentEl.value;
      await NotesModule.updateNote(editNote.$id, editNote);
      await NotesModule.toggleArchive(editNote.$id);
      Toast.show(editNote.archived ? 'Note désarchivée' : 'Note archivée', {
        actionText: 'Annuler',
        onAction: () => NotesModule.toggleArchive(editNote.$id)
      });
      this.modalBackdrop.remove();
    };

    // Close button
    const close = () => {
      editNote.title = titleEl.value;
      if (contentEl) editNote.content = contentEl.value;
      NotesModule.updateNote(editNote.$id, editNote);
      this.modalBackdrop.remove();
    };

    this.modalBackdrop.querySelector('#modalCloseBtn').onclick = close;
    this.modalBackdrop.onclick = (e) => {
      if (e.target === this.modalBackdrop) close();
    };
  }

  openColorPopover(triggerBtn, onSelect) {
    document.querySelectorAll('.color-popover').forEach(p => p.remove());
    const popover = document.createElement('div');
    popover.className = 'color-popover';

    APP_CONFIG.NOTE_COLORS.forEach(col => {
      const circle = document.createElement('div');
      circle.className = `color-option ${col.class}`;
      circle.title = col.name;
      circle.onclick = (e) => {
        e.stopPropagation();
        onSelect(col.id);
        popover.remove();
      };
      popover.appendChild(circle);
    });

    triggerBtn.parentElement.appendChild(popover);
    const closeHandler = (e) => {
      if (!popover.contains(e.target) && e.target !== triggerBtn) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  openReminderPicker(triggerBtn, onSelect) {
    document.querySelectorAll('.reminder-picker-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'reminder-picker-popover';
    popover.style.cssText = `
      position: absolute;
      bottom: 42px;
      left: 0;
      background: var(--bg-surface);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-color);
      padding: 12px;
      z-index: var(--z-dropdown);
      min-width: 220px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    const now = new Date();
    now.setHours(now.getHours() + 2);
    const defaultTime = now.toISOString().slice(0, 16);

    popover.innerHTML = `
      <div style="font-weight:600;font-size:13px;color:var(--text-primary);">Programmer un rappel</div>
      <input type="datetime-local" id="reminderDateInput" value="${defaultTime}" style="padding:6px;border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);background:var(--bg-input);">
      <select id="reminderRepeatSelect" style="padding:6px;border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);background:var(--bg-input);">
        <option value="none">Ne pas répéter</option>
        <option value="daily">Tous les jours</option>
        <option value="weekly">Toutes les semaines</option>
      </select>
      <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:4px;">
        <button id="saveReminderBtn" class="btn-primary" style="padding:4px 10px;font-size:12px;">Enregistrer</button>
      </div>
    `;

    popover.querySelector('#saveReminderBtn').onclick = (e) => {
      e.stopPropagation();
      const val = popover.querySelector('#reminderDateInput').value;
      const repeat = popover.querySelector('#reminderRepeatSelect').value;
      if (val) {
        onSelect({
          date: new Date(val).toISOString(),
          repeat,
          completed: false
        });
      }
      popover.remove();
    };

    triggerBtn.parentElement.appendChild(popover);
    const closeHandler = (e) => {
      if (!popover.contains(e.target) && e.target !== triggerBtn) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  async openLabelPicker(triggerBtn, note, onDone) {
    document.querySelectorAll('.label-picker-popover').forEach(p => p.remove());

    const allLabels = await db.getLabels();
    const popover = document.createElement('div');
    popover.className = 'label-picker-popover';
    popover.style.cssText = `
      position: absolute;
      bottom: 42px;
      left: 0;
      background: var(--bg-surface);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-color);
      padding: 10px;
      z-index: var(--z-dropdown);
      min-width: 200px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 220px;
      overflow-y: auto;
    `;

    if (allLabels.length === 0) {
      popover.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Aucun libellé créé.</div>`;
    } else {
      allLabels.forEach(lbl => {
        const isSelected = Array.isArray(note.labels) && note.labels.includes(lbl.$id);
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:3px 0;';
        row.innerHTML = `
          <input type="checkbox" ${isSelected ? 'checked' : ''}>
          <span>${escapeHTML(lbl.name)}</span>
        `;
        row.querySelector('input').onchange = (e) => {
          if (e.target.checked) {
            if (!note.labels) note.labels = [];
            note.labels.push(lbl.$id);
          } else {
            note.labels = (note.labels || []).filter(id => id !== lbl.$id);
          }
          if (onDone) onDone();
        };
        popover.appendChild(row);
      });
    }

    triggerBtn.parentElement.appendChild(popover);
    const closeHandler = (e) => {
      if (!popover.contains(e.target) && e.target !== triggerBtn) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  triggerImageUpload(onUploaded) {
    const fileInput = document.getElementById('imageFileInput');
    if (!fileInput) return;

    fileInput.onchange = async () => {
      const files = Array.from(fileInput.files);
      for (const file of files) {
        const attachment = await storage.saveAttachment(file, file.name, file.type);
        onUploaded(attachment);
      }
      fileInput.value = ''; // Reset
    };

    fileInput.click();
  }
}

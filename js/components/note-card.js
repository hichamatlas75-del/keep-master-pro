/**
 * KEEP MASTER PRO - Note Card Component
 * Renders individual note cards in Masonry or List view with interactive actions.
 */

import { APP_CONFIG } from '../config.js';
import { escapeHTML, sanitizeUrl } from '../utils/sanitize.js';
import { formatDateTime, toLocalDatetimeString } from '../utils/helpers.js';
import { NotesModule } from '../modules/notes.js';
import { ChecklistModule } from '../modules/checklist.js';
import { RemindersModule } from '../modules/reminders.js';
import { ArchiveModule } from '../modules/archive.js';
import { TrashModule } from '../modules/trash.js';
import { ShareModule } from '../modules/share.js';
import { OCRModule } from '../modules/ocr.js';
import { Toast } from './toast.js';
import { Dialog } from './dialog.js';
import { eventBus } from '../utils/event-bus.js';
import { storage } from '../services/storage.js';

export class NoteCard {
  /**
   * Render note card DOM element
   */
  static render(note, allLabels = []) {
    const card = document.createElement('div');
    card.className = `note-card bg-${note.color || 'default'}`;
    card.dataset.id = note.$id;
    card.draggable = !note.trashed;

    const labelMap = new Map(allLabels.map(l => [l.$id, l]));

    // 1. Pinned Button
    const pinHtml = !note.trashed ? `
      <button class="btn-icon note-pin-btn ${note.pinned ? 'pinned' : ''}" title="${note.pinned ? 'Désépingler' : 'Épingler'}" data-action="pin">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${note.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M16 2l6 6-7 7-4-4 5-5z"></path><path d="M2 22l7-7"></path><path d="M7 11l-4 4 4 4 4-4"></path></svg>
      </button>
    ` : '';

    // 2. Images / Drawings
    let imagesHtml = '';
    const visualAttachments = (note.attachments || []).filter(a => a?.type?.startsWith('image/'));
    if (visualAttachments.length > 0) {
      const imgElements = visualAttachments.slice(0, 4).map(a => `
        <img src="${sanitizeUrl(a.url)}" alt="${escapeHTML(a.name || 'Image')}" loading="lazy">
      `).join('');
      imagesHtml = `<div class="note-card-images">${imgElements}</div>`;
    }

    // 3. Audio Voice Note Widgets
    let audioHtml = '';
    const audioAttachments = (note.attachments || []).filter(a => a?.type?.startsWith('audio/'));
    if (audioAttachments.length > 0) {
      audioHtml = audioAttachments.map(att => {
        const durationText = att.duration ? ` • ${escapeHTML(att.duration)}` : '';
        const safeSrc = sanitizeUrl(att.url);
        return `
          <div class="audio-card-widget" data-action="audio-play" data-local-blob-id="${escapeHTML(att.localBlobId || '')}">
            <button class="btn-icon" style="width:28px;height:28px;" title="Écouter la note vocale">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <span class="audio-duration">Note vocale${durationText}</span>
            <audio ${safeSrc ? `src="${safeSrc}"` : ''} preload="metadata"></audio>
          </div>
        `;
      }).join('');
    }

    // 4. Checklist Items Preview
    let contentHtml = '';
    if (note.type === 'checklist' && Array.isArray(note.checklist) && note.checklist.length > 0) {
      const items = note.checklist.slice(0, 6).map(item => `
        <div class="checklist-preview-item ${item.completed ? 'completed' : ''}">
          <input type="checkbox" class="checklist-checkbox" ${item.completed ? 'checked' : ''} data-item-id="${item.id}" data-action="checklist-toggle">
          <span class="truncate">${escapeHTML(item.text)}</span>
        </div>
      `).join('');

      const remaining = note.checklist.length - 6;
      const moreHtml = remaining > 0 ? `<div class="checklist-more-badge">+ ${remaining} élément(s) de plus</div>` : '';

      contentHtml = `<div class="note-card-checklist">${items}${moreHtml}</div>`;
    } else if (note.content) {
      contentHtml = `<div class="note-card-text">${escapeHTML(note.content)}</div>`;
    }

    // 5. Chips (Reminder & Labels)
    let chipsHtml = '';
    const chips = [];

    if (note.reminder && note.reminder.date) {
      chips.push(`
        <div class="chip reminder-chip" title="Rappel prévu">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          <span>${formatDateTime(note.reminder.date)}</span>
        </div>
      `);
    }

    if (Array.isArray(note.labels)) {
      note.labels.forEach(lblId => {
        const lbl = labelMap.get(lblId);
        if (lbl) {
          chips.push(`
            <div class="chip" data-label-id="${lbl.$id}">
              <span>${escapeHTML(lbl.name)}</span>
            </div>
          `);
        }
      });
    }

    if (chips.length > 0) {
      chipsHtml = `<div class="note-card-chips">${chips.join('')}</div>`;
    }

    // 6. Action Footer Toolbar
    let actionsHtml = '';
    if (!note.trashed) {
      actionsHtml = `
        <div class="note-card-actions">
          <button class="btn-icon" data-action="reminder" title="Rappel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          </button>
          <button class="btn-icon" data-action="color" title="Changer de couleur">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 0 20v-2a8 8 0 0 0 0-16V2z"></path></svg>
          </button>
          <button class="btn-icon" data-action="archive" title="${note.archived ? 'Désarchiver' : 'Archiver'}">
            ${note.archived ? `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><polyline points="10 13 12 11 14 13"></polyline><line x1="12" y1="11" x2="12" y2="17"></line></svg>
            ` : `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
            `}
          </button>
          <button class="btn-icon" data-action="more" title="Plus d'actions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
          </button>
        </div>
      `;
    } else {
      // In Trash view: Restore & Permanent Delete
      actionsHtml = `
        <div class="note-card-actions" style="opacity:1;">
          <button class="btn-icon" data-action="restore" title="Restaurer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          </button>
          <button class="btn-icon" data-action="delete-forever" title="Supprimer définitivement">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      ${pinHtml}
      ${imagesHtml}
      <div class="note-card-body">
        ${note.title ? `<div class="note-card-title">${escapeHTML(note.title)}</div>` : ''}
        ${contentHtml}
        ${audioHtml}
        ${chipsHtml}
      </div>
      ${actionsHtml}
    `;

    // Bind event handlers
    this.bindEvents(card, note);

    return card;
  }

  static bindEvents(card, note) {
    // Drag & Drop note card reordering
    if (!note.trashed) {
      card.ondragstart = (e) => {
        if (e.target.closest('button, input, [data-action="audio-play"]')) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', note.$id);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      };

      card.ondragend = () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.note-card').forEach(c => c.classList.remove('drag-over'));
      };

      card.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      };

      card.ondragleave = () => {
        card.classList.remove('drag-over');
      };

      card.ondrop = (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const sourceNoteId = e.dataTransfer.getData('text/plain');
        if (sourceNoteId && sourceNoteId !== note.$id) {
          eventBus.emit('notes:reorder', { sourceId: sourceNoteId, targetId: note.$id });
        }
      };
    }

    // Click card body to open full note editor modal
    card.onclick = (e) => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('[data-action="audio-play"]')) return;
      if (note.trashed) return;
      eventBus.emit('editor:open', note);
    };

    // Pinned toggle
    const pinBtn = card.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.onclick = (e) => {
        e.stopPropagation();
        NotesModule.togglePin(note.$id);
      };
    }

    // Checklist item toggle directly on card
    card.querySelectorAll('[data-action="checklist-toggle"]').forEach(checkbox => {
      checkbox.onchange = (e) => {
        e.stopPropagation();
        const updatedList = ChecklistModule.toggleItem(note.checklist, checkbox.dataset.itemId);
        NotesModule.updateNote(note.$id, { checklist: updatedList });
      };
    });

    // Audio playback toggle (clicking anywhere on widget toggles audio without opening editor)
    const PLAY_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    const PAUSE_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

    card.querySelectorAll('[data-action="audio-play"]').forEach(audioWidget => {
      const audioEl = audioWidget.querySelector('audio');
      const btn = audioWidget.querySelector('button');
      if (!audioEl || !btn) return;

      audioEl.onplay = () => {
        btn.innerHTML = PAUSE_SVG;
      };
      audioEl.onpause = () => {
        btn.innerHTML = PLAY_SVG;
      };
      audioEl.onended = () => {
        btn.innerHTML = PLAY_SVG;
      };

      audioWidget.onclick = async (e) => {
        e.stopPropagation();
        if (audioEl.paused) {
          if (!audioEl.getAttribute('src') && audioWidget.dataset.localBlobId) {
            try {
              const record = await storage.getAttachment(audioWidget.dataset.localBlobId);
              const safeUrl = sanitizeUrl(record?.blob || '');
              if (safeUrl) {
                audioEl.src = safeUrl;
              }
            } catch (err) {
              console.warn('[NoteCard] Échec chargement blob audio :', err);
            }
          }

          if (!audioEl.getAttribute('src')) {
            Toast.show('Fichier audio indisponible.');
            return;
          }

          document.querySelectorAll('audio').forEach((other) => {
            if (other !== audioEl && !other.paused) {
              other.pause();
            }
          });

          audioEl.play().catch((err) => {
            console.warn('[NoteCard] Lecture audio impossible :', err);
            Toast.show('Impossible de lire la note vocale.');
          });
        } else {
          audioEl.pause();
        }
      };
    });

    // Reminder popover
    const reminderBtn = card.querySelector('[data-action="reminder"]');
    if (reminderBtn) {
      reminderBtn.onclick = (e) => {
        e.stopPropagation();
        this.openReminderPopover(reminderBtn, note);
      };
    }

    // Label chips direct navigation
    card.querySelectorAll('.chip[data-label-id]').forEach(chip => {
      chip.onclick = (e) => {
        e.stopPropagation();
        eventBus.emit('view:change', { view: 'label', labelId: chip.dataset.labelId });
      };
    });

    // Color popover
    const colorBtn = card.querySelector('[data-action="color"]');
    if (colorBtn) {
      colorBtn.onclick = (e) => {
        e.stopPropagation();
        this.openColorPopover(colorBtn, note);
      };
    }

    // Archive toggle
    const archiveBtn = card.querySelector('[data-action="archive"]');
    if (archiveBtn) {
      archiveBtn.onclick = (e) => {
        e.stopPropagation();
        NotesModule.toggleArchive(note.$id).then(() => {
          Toast.show(note.archived ? 'Note désarchivée' : 'Note archivée', {
            actionText: 'Annuler',
            onAction: () => NotesModule.toggleArchive(note.$id)
          });
        });
      };
    }

    // More menu
    const moreBtn = card.querySelector('[data-action="more"]');
    if (moreBtn) {
      moreBtn.onclick = (e) => {
        e.stopPropagation();
        this.openMoreMenu(moreBtn, note);
      };
    }

    // Trash actions
    const restoreBtn = card.querySelector('[data-action="restore"]');
    if (restoreBtn) {
      restoreBtn.onclick = (e) => {
        e.stopPropagation();
        TrashModule.restoreNote(note.$id).then(() => {
          Toast.show('Note restaurée');
        });
      };
    }

    const deleteForeverBtn = card.querySelector('[data-action="delete-forever"]');
    if (deleteForeverBtn) {
      deleteForeverBtn.onclick = async (e) => {
        e.stopPropagation();
        const confirmed = await Dialog.confirm({
          title: 'Supprimer définitivement la note ?',
          message: 'Cette action est irréversible. La note sera définitivement effacée.',
          confirmText: 'Supprimer',
          isDanger: true
        });
        if (confirmed) {
          TrashModule.deletePermanently(note.$id).then(() => {
            Toast.show('Note supprimée définitivement');
          });
        }
      };
    }
  }

  /**
   * Reminder picker popover for note card
   */
  static openReminderPopover(triggerBtn, note) {
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
    const defaultTime = note.reminder?.date ? toLocalDatetimeString(note.reminder.date) : toLocalDatetimeString(now);

    popover.innerHTML = `
      <div style="font-weight:600;font-size:13px;color:var(--text-primary);">Programmer un rappel</div>
      <input type="datetime-local" id="cardReminderDateInput" value="${defaultTime}" style="padding:6px;border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);background:var(--bg-input);">
      <select id="cardReminderRepeatSelect" style="padding:6px;border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);background:var(--bg-input);">
        <option value="none" ${note.reminder?.repeat === 'none' ? 'selected' : ''}>Ne pas répéter</option>
        <option value="daily" ${note.reminder?.repeat === 'daily' ? 'selected' : ''}>Tous les jours</option>
        <option value="weekly" ${note.reminder?.repeat === 'weekly' ? 'selected' : ''}>Toutes les semaines</option>
      </select>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
        ${note.reminder ? `<button id="deleteCardReminderBtn" class="btn-danger" style="padding:3px 8px;font-size:11px;">Supprimer</button>` : '<div></div>'}
        <button id="saveCardReminderBtn" class="btn-primary" style="padding:4px 10px;font-size:12px;">Enregistrer</button>
      </div>
    `;

    const saveBtn = popover.querySelector('#saveCardReminderBtn');
    saveBtn.onclick = (e) => {
      e.stopPropagation();
      const val = popover.querySelector('#cardReminderDateInput').value;
      const repeat = popover.querySelector('#cardReminderRepeatSelect').value;
      if (val) {
        RemindersModule.setReminder(note.$id, new Date(val).toISOString(), repeat).then(() => {
          Toast.show('Rappel enregistré');
        });
      }
      popover.remove();
    };

    const delBtn = popover.querySelector('#deleteCardReminderBtn');
    if (delBtn) {
      delBtn.onclick = (e) => {
        e.stopPropagation();
        RemindersModule.clearReminder(note.$id).then(() => {
          Toast.show('Rappel supprimé');
        });
        popover.remove();
      };
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

  /**
   * Color selector popover for note card
   */
  static openColorPopover(triggerBtn, note) {
    document.querySelectorAll('.color-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'color-popover';

    APP_CONFIG.NOTE_COLORS.forEach(col => {
      const circle = document.createElement('div');
      circle.className = `color-option ${col.class} ${note.color === col.id ? 'selected' : ''}`;
      circle.title = col.name;
      circle.onclick = (e) => {
        e.stopPropagation();
        NotesModule.setColor(note.$id, col.id);
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

  /**
   * More options menu popover
   */
  static openMoreMenu(triggerBtn, note) {
    document.querySelectorAll('.more-menu-popover').forEach(p => p.remove());

    const menu = document.createElement('div');
    menu.className = 'more-menu-popover';
    menu.style.cssText = `
      position: absolute;
      bottom: 42px;
      right: 0;
      background: var(--bg-surface);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      min-width: 170px;
      padding: 4px 0;
      z-index: var(--z-dropdown);
      animation: slideUp 120ms ease-out;
    `;

    const hasImages = Array.isArray(note.attachments) && note.attachments.some(a => a?.type?.startsWith('image/') && a.url);

    const items = [
      { text: 'Copier la note', icon: '📋', action: () => NoteCard.copyNoteToClipboard(note) },
      { text: note.archived ? 'Désarchiver' : 'Archiver', icon: note.archived ? '📤' : '📦', action: () => {
        NotesModule.toggleArchive(note.$id).then(() => {
          Toast.show(note.archived ? 'Note désarchivée' : 'Note archivée', {
            actionText: 'Annuler',
            onAction: () => NotesModule.toggleArchive(note.$id)
          });
        });
      }},
      { text: 'Supprimer la note', icon: '🗑️', action: () => NotesModule.moveToTrash(note.$id) },
      { text: 'Dupliquer', icon: '📄', action: () => NotesModule.duplicateNote(note.$id) },
      { text: 'Partager', icon: '🔗', action: () => ShareModule.shareNative(note).then(r => {
        if (r?.method === 'clipboard') Toast.show('Contenu copié dans le presse-papiers');
      }) }
    ];

    if (hasImages) {
      items.splice(1, 0, {
        text: 'Extraire le texte (OCR)',
        icon: '🔍',
        action: () => NoteCard.extractOcrFromNote(note)
      });
    }

    items.forEach(it => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        padding: 8px 14px;
        text-align: left;
        width: 100%;
        font-size: 13px;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      btn.innerHTML = `<span>${it.icon}</span> <span>${it.text}</span>`;
      btn.onmouseenter = () => btn.style.background = 'var(--bg-surface-hover)';
      btn.onmouseleave = () => btn.style.background = 'transparent';
      btn.onclick = (e) => {
        e.stopPropagation();
        menu.remove();
        it.action();
      };
      menu.appendChild(btn);
    });

    triggerBtn.parentElement.appendChild(menu);

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== triggerBtn) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  /**
   * Copy note content directly to system clipboard
   */
  static async copyNoteToClipboard(note) {
    try {
      await ShareModule.copyNote(note);
      Toast.show('Note copiée dans le presse-papiers');
    } catch (err) {
      Toast.show(err.message || 'Impossible de copier la note.');
    }
  }

  /**
   * Run OCR text extraction on image attachments of note
   */
  static async extractOcrFromNote(note) {
    const imgAtt = (note.attachments || []).find(a => a?.type?.startsWith('image/') && a.url);
    if (!imgAtt) {
      Toast.show('Aucune image exploitable trouvée sur cette note.');
      return;
    }

    Toast.show('Analyse OCR en cours...', { duration: 3000 });
    try {
      const extracted = await OCRModule.extractText(imgAtt.url, (msg) => {
        Toast.show(msg, { duration: 2500 });
      });

      if (!extracted) {
        Toast.show('Aucun texte lisible détecté sur cette image.');
        return;
      }

      imgAtt.extractedText = extracted;

      const previewSnippet = extracted.length > 150 ? extracted.slice(0, 150) + '...' : extracted;
      const shouldInsert = await Dialog.confirm({
        title: 'Texte détecté par l\'OCR',
        message: `Texte extrait :\n"${previewSnippet}"\n\nSouhaitez-vous insérer ce texte dans le corps de votre note ?`,
        confirmText: 'Insérer dans la note',
        cancelText: 'Garder pour la recherche'
      });

      let updatedContent = note.content || '';
      if (shouldInsert) {
        updatedContent = (updatedContent ? updatedContent + '\n\n' : '') + extracted;
      }

      await NotesModule.updateNote(note.$id, {
        attachments: note.attachments,
        content: updatedContent
      });

      Toast.show('Texte OCR extrait et enregistré !');
    } catch (err) {
      Toast.show(err.message || 'Impossible d\'analyser l\'image.');
    }
  }
}

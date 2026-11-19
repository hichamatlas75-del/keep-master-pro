/**
 * KEEP MASTER PRO - Note Card Component
 * Renders individual note cards in Masonry or List view with interactive actions.
 */

import { APP_CONFIG } from '../config.js';
import { escapeHTML, sanitizeUrl } from '../utils/sanitize.js';
import { formatDateTime } from '../utils/helpers.js';
import { NotesModule } from '../modules/notes.js';
import { ArchiveModule } from '../modules/archive.js';
import { TrashModule } from '../modules/trash.js';
import { ShareModule } from '../modules/share.js';
import { Toast } from './toast.js';
import { Dialog } from './dialog.js';
import { eventBus } from '../utils/event-bus.js';

export class NoteCard {
  /**
   * Render note card DOM element
   */
  static render(note, allLabels = []) {
    const card = document.createElement('div');
    card.className = `note-card bg-${note.color || 'default'}`;
    card.dataset.id = note.$id;

    const labelMap = new Map(allLabels.map(l => [l.$id, l]));

    // 1. Pinned Button
    const pinHtml = !note.trashed ? `
      <button class="btn-icon note-pin-btn ${note.pinned ? 'pinned' : ''}" title="${note.pinned ? 'Désépingler' : 'Épingler'}" data-action="pin">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${note.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M16 2l6 6-7 7-4-4 5-5z"></path><path d="M2 22l7-7"></path><path d="M7 11l-4 4 4 4 4-4"></path></svg>
      </button>
    ` : '';

    // 2. Images / Drawings
    let imagesHtml = '';
    const visualAttachments = (note.attachments || []).filter(a => a.type.startsWith('image/'));
    if (visualAttachments.length > 0) {
      const imgElements = visualAttachments.slice(0, 4).map(a => `
        <img src="${sanitizeUrl(a.url)}" alt="${escapeHTML(a.name)}" loading="lazy">
      `).join('');
      imagesHtml = `<div class="note-card-images">${imgElements}</div>`;
    }

    // 3. Audio Voice Note Widget
    let audioHtml = '';
    const audioAttachment = (note.attachments || []).find(a => a.type.startsWith('audio/'));
    if (audioAttachment) {
      audioHtml = `
        <div class="audio-card-widget" data-action="audio-play">
          <button class="btn-icon" style="width:28px;height:28px;" title="Écouter la note vocale">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
          <span class="audio-duration">Note vocale</span>
          <audio src="${sanitizeUrl(audioAttachment.url)}" preload="none"></audio>
        </div>
      `;
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
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
    // Click card body to open full note editor modal
    card.onclick = (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
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
        import('../modules/checklist.js').then(({ ChecklistModule }) => {
          const updatedList = ChecklistModule.toggleItem(note.checklist, checkbox.dataset.itemId);
          NotesModule.updateNote(note.$id, { checklist: updatedList });
        });
      };
    });

    // Audio playback toggle
    const audioWidget = card.querySelector('[data-action="audio-play"]');
    if (audioWidget) {
      const audioEl = audioWidget.querySelector('audio');
      const btn = audioWidget.querySelector('button');
      btn.onclick = (e) => {
        e.stopPropagation();
        if (audioEl.paused) {
          audioEl.play();
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
        } else {
          audioEl.pause();
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        }
      };
      audioEl.onended = () => {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      };
    }

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

    const items = [
      { text: 'Supprimer la note', icon: '🗑️', action: () => NotesModule.moveToTrash(note.$id) },
      { text: 'Dupliquer', icon: '📄', action: () => NotesModule.duplicateNote(note.$id) },
      { text: 'Partager', icon: '🔗', action: () => ShareModule.shareNative(note).then(r => {
        if (r?.method === 'clipboard') Toast.show('Contenu copié dans le presse-papiers');
      }) }
    ];

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
}

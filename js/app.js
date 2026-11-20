/**
 * KEEP MASTER PRO - Main Application Bootstrapper
 * Orchestrates offline-first database, sync engine, PWA Service Worker & UI views.
 */

import { db } from './database/indexeddb.js';
import { auth } from './services/auth.js';
import { syncEngine } from './sync/sync-engine.js';
import { RemindersModule } from './modules/reminders.js';
import { SearchModule } from './modules/search.js';
import { NotesModule } from './modules/notes.js';
import { TrashModule } from './modules/trash.js';
import { NoteCard } from './components/note-card.js';
import { NoteEditor } from './components/note-editor.js';
import { Header } from './components/header.js';
import { Sidebar } from './components/sidebar.js';
import { DrawingModal } from './components/drawing-modal.js';
import { AudioModal } from './components/audio-modal.js';
import { LabelModal } from './components/label-modal.js';
import { SettingsModal } from './components/settings-modal.js';
import { AuthModal } from './components/auth-modal.js';
import { Dialog } from './components/dialog.js';
import { Toast } from './components/toast.js';
import { eventBus } from './utils/event-bus.js';

class App {
  constructor() {
    this.currentView = 'notes'; // 'notes' | 'reminders' | 'archive' | 'trash' | 'label'
    this.currentLabelId = null;
    this.searchQuery = '';
    this.searchFilters = {};

    this.pinnedSection = document.getElementById('pinnedSection');
    this.pinnedNotesContainer = document.getElementById('pinnedNotesContainer');
    this.otherSection = document.getElementById('otherSection');
    this.otherSectionHeader = document.getElementById('otherSectionHeader');
    this.otherNotesContainer = document.getElementById('otherNotesContainer');
    this.noteCreatorContainer = document.getElementById('noteCreatorContainer');
    this.emptyState = document.getElementById('emptyState');
    this.emptyStateTitle = document.getElementById('emptyStateTitle');
    this.emptyStateDesc = document.getElementById('emptyStateDesc');
  }

  async start() {
    console.log('[KEEP MASTER PRO] Démarrage de l\'application...');

    // 1. Register Service Worker for PWA
    this.registerServiceWorker();

    // 2. Initialize IndexedDB
    await db.init();

    // 3. Initialize Auth
    await auth.init();

    // 4. Initialize UI Components & Modals
    new Header();
    new Sidebar();
    this.noteEditor = new NoteEditor();
    new DrawingModal();
    new AudioModal();
    new LabelModal();
    new SettingsModal();
    new AuthModal();

    // 5. Initialize Sync Engine
    await syncEngine.init();

    // 6. Check pending reminders & start watcher
    RemindersModule.checkPendingReminders();
    RemindersModule.startReminderWatcher();

    // 7. Setup Application Event Listeners
    this.setupListeners();

    // 8. Handle URL actions (PWA shortcuts)
    this.handleUrlActions();

    // 9. Initial Notes Render
    await this.render();

    console.log('[KEEP MASTER PRO] Application prête et opérationnelle.');
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
          .then((reg) => {
            console.log('[PWA] Service Worker enregistré avec succès:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Échec d\'enregistrement du Service Worker:', err);
          });
      });
    }
  }

  setupListeners() {
    // Re-render when notes change
    eventBus.on('notes:changed', () => this.render());

    // Switch view
    eventBus.on('view:change', ({ view, labelId }) => {
      this.currentView = view;
      this.currentLabelId = labelId;
      this.render();
    });

    // Search and filters
    eventBus.on('search:query', ({ query, color, type }) => {
      this.searchQuery = query || '';
      this.searchFilters = { color, type };
      this.render();
    });

    // Reorder notes via drag & drop
    eventBus.on('notes:reorder', async ({ sourceId, targetId }) => {
      await this.handleNotesReorder(sourceId, targetId);
    });

    // Direct open note modal
    eventBus.on('note:open', async ({ noteId }) => {
      if (!noteId) return;
      const note = await db.getNote(noteId);
      if (note && !note.trashed) {
        this.noteEditor.openEditModal(note);
      }
    });

    // Window focus checks for reminders
    window.addEventListener('focus', () => {
      RemindersModule.checkPendingReminders();
    });
  }

  handleUrlActions() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const targetNoteId = params.get('note');

    if (targetNoteId) {
      setTimeout(async () => {
        const note = await db.getNote(targetNoteId);
        if (note && !note.trashed) {
          this.noteEditor.openEditModal(note);
        }
      }, 350);
    }

    if (action === 'new-note') {
      setTimeout(() => this.noteEditor.expandCreator('text'), 300);
    } else if (action === 'new-list') {
      setTimeout(() => this.noteEditor.expandCreator('checklist'), 300);
    } else if (action === 'new-drawing') {
      setTimeout(() => {
        this.noteEditor.expandCreator('drawing');
        eventBus.emit('modal:drawing', {
          onSave: (att) => this.noteEditor.addAttachment(att, 'drawing')
        });
      }, 300);
    }
  }

  async handleNotesReorder(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const allNotes = await db.getAllNotes();
    const customOrder = (await db.getSetting('notes_custom_order')) || [];
    const sourceNote = allNotes.find(n => n.$id === sourceId);
    const targetNote = allNotes.find(n => n.$id === targetId);

    if (!sourceNote || !targetNote) return;

    // Adapt pin status if dropped between pinned and unpinned
    if (sourceNote.pinned !== targetNote.pinned) {
      await NotesModule.updateNote(sourceId, { pinned: targetNote.pinned });
    }

    const currentOrder = allNotes.map(n => n.$id);
    const existingOrder = Array.isArray(customOrder) && customOrder.length > 0
      ? [...new Set([...customOrder, ...currentOrder])]
      : currentOrder;

    const fromIdx = existingOrder.indexOf(sourceId);
    const toIdx = existingOrder.indexOf(targetId);

    if (fromIdx !== -1 && toIdx !== -1) {
      existingOrder.splice(fromIdx, 1);
      existingOrder.splice(toIdx, 0, sourceId);
      await db.setSetting('notes_custom_order', existingOrder);
      await this.render();
      Toast.show('Notes réorganisées');
    }
  }

  async render() {
    const allNotes = await db.getAllNotes();
    const allLabels = await db.getLabels();

    // Apply custom user drag & drop ordering if present
    const customOrder = (await db.getSetting('notes_custom_order')) || [];
    if (Array.isArray(customOrder) && customOrder.length > 0) {
      const orderMap = new Map(customOrder.map((id, idx) => [id, idx]));
      allNotes.sort((a, b) => {
        const idxA = orderMap.has(a.$id) ? orderMap.get(a.$id) : 999999;
        const idxB = orderMap.has(b.$id) ? orderMap.get(b.$id) : 999999;
        if (idxA !== idxB) return idxA - idxB;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
    }

    const isSearching = Boolean(this.searchQuery || this.searchFilters.color || this.searchFilters.type);

    // Adjust visibility of Note Creator (only visible in main 'notes' view without search or filters)
    if (this.currentView === 'notes' && !isSearching) {
      this.noteCreatorContainer?.classList.remove('hidden');
    } else {
      this.noteCreatorContainer?.classList.add('hidden');
    }

    // Filter notes based on current view
    let viewNotes = [];

    if (this.currentView === 'notes') {
      viewNotes = allNotes.filter(n => !n.archived && !n.trashed);
    } else if (this.currentView === 'reminders') {
      viewNotes = allNotes.filter(n => !n.trashed && n.reminder && n.reminder.date);
    } else if (this.currentView === 'archive') {
      viewNotes = allNotes.filter(n => n.archived && !n.trashed);
    } else if (this.currentView === 'trash') {
      viewNotes = allNotes.filter(n => n.trashed);
    } else if (this.currentView === 'label' && this.currentLabelId) {
      viewNotes = allNotes.filter(n => !n.trashed && Array.isArray(n.labels) && n.labels.includes(this.currentLabelId));
    }

    // Apply Search and Filters
    const filteredNotes = SearchModule.search(viewNotes, {
      query: this.searchQuery,
      color: this.searchFilters.color,
      type: this.searchFilters.type
    });

    // Clear containers
    this.pinnedNotesContainer.innerHTML = '';
    this.otherNotesContainer.innerHTML = '';

    // Render Empty Trash Action Bar if in trash view
    const existingTrashBanner = document.getElementById('trashActionBar');
    if (existingTrashBanner) existingTrashBanner.remove();

    if (this.currentView === 'trash' && filteredNotes.length > 0) {
      const trashBanner = document.createElement('div');
      trashBanner.id = 'trashActionBar';
      trashBanner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--bg-surface-variant);padding:10px 16px;border-radius:var(--radius-sm);margin-bottom:16px;border:1px solid var(--border-color);gap:12px;flex-wrap:wrap;';
      trashBanner.innerHTML = `
        <span style="font-size:13px;color:var(--text-secondary);font-style:italic;">Les notes dans la corbeille peuvent être restaurées ou effacées définitivement.</span>
        <button id="emptyTrashBtn" class="btn-danger" style="font-size:12px;padding:4px 12px;white-space:nowrap;">Vider la corbeille</button>
      `;
      trashBanner.querySelector('#emptyTrashBtn').onclick = async () => {
        const confirmed = await Dialog.confirm({
          title: 'Vider la corbeille ?',
          message: 'Toutes les notes de la corbeille seront définitivement effacées. Cette action est irréversible.',
          confirmText: 'Vider',
          isDanger: true
        });
        if (confirmed) {
          await TrashModule.emptyTrash();
          Toast.show('Corbeille vidée');
        }
      };
      this.otherSection.parentElement.insertBefore(trashBanner, this.otherSection);
    }

    if (filteredNotes.length === 0) {
      this.pinnedSection.classList.add('hidden');
      this.otherSection.classList.add('hidden');
      this.showEmptyState();
      return;
    }

    this.emptyState.classList.add('hidden');
    this.otherSection.classList.remove('hidden');

    // Separate Pinned & Others if in main 'notes' view without search/filters
    if (this.currentView === 'notes' && !isSearching) {
      const pinnedNotes = filteredNotes.filter(n => n.pinned);
      const otherNotes = filteredNotes.filter(n => !n.pinned);

      if (pinnedNotes.length > 0) {
        this.pinnedSection.classList.remove('hidden');
        this.otherSectionHeader.classList.remove('hidden');

        pinnedNotes.forEach(note => {
          this.pinnedNotesContainer.appendChild(NoteCard.render(note, allLabels));
        });
      } else {
        this.pinnedSection.classList.add('hidden');
        this.otherSectionHeader.classList.add('hidden');
      }

      otherNotes.forEach(note => {
        this.otherNotesContainer.appendChild(NoteCard.render(note, allLabels));
      });
    } else {
      // In search, archive, trash, reminders, or label view
      this.pinnedSection.classList.add('hidden');
      this.otherSectionHeader.classList.add('hidden');

      filteredNotes.forEach(note => {
        this.otherNotesContainer.appendChild(NoteCard.render(note, allLabels));
      });
    }
  }

  showEmptyState() {
    this.emptyState.classList.remove('hidden');

    const isSearching = Boolean(this.searchQuery || this.searchFilters.color || this.searchFilters.type);
    if (isSearching) {
      this.emptyStateTitle.textContent = 'Aucun résultat trouvé';
      this.emptyStateDesc.textContent = this.searchQuery
        ? `Aucune note ne correspond à "${this.searchQuery}".`
        : 'Aucune note ne correspond aux filtres sélectionnés.';
    } else if (this.currentView === 'reminders') {
      this.emptyStateTitle.textContent = 'Aucun rappel';
      this.emptyStateDesc.textContent = 'Les notes avec des rappels apparaîtront ici.';
    } else if (this.currentView === 'archive') {
      this.emptyStateTitle.textContent = 'Aucune note archivée';
      this.emptyStateDesc.textContent = 'Vos notes archivées apparaîtront ici.';
    } else if (this.currentView === 'trash') {
      this.emptyStateTitle.textContent = 'La corbeille est vide';
      this.emptyStateDesc.textContent = 'Aucune note dans la corbeille.';
    } else if (this.currentView === 'label') {
      this.emptyStateTitle.textContent = 'Aucune note avec ce libellé';
      this.emptyStateDesc.textContent = 'Associez ce libellé à des notes pour les retrouver ici.';
    } else {
      this.emptyStateTitle.textContent = 'Aucune note ici';
      this.emptyStateDesc.textContent = 'Les notes que vous ajoutez apparaîtront ici.';
    }
  }
}

// Start application
const app = new App();
app.start();

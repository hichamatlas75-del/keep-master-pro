/**
 * KEEP MASTER PRO - Main Application Bootstrapper
 * Orchestrates offline-first database, sync engine, PWA Service Worker & UI views.
 */

import { db } from './database/indexeddb.js';
import { auth } from './services/auth.js';
import { syncEngine } from './sync/sync-engine.js';
import { RemindersModule } from './modules/reminders.js';
import { SearchModule } from './modules/search.js';
import { NoteCard } from './components/note-card.js';
import { NoteEditor } from './components/note-editor.js';
import { Header } from './components/header.js';
import { Sidebar } from './components/sidebar.js';
import { DrawingModal } from './components/drawing-modal.js';
import { AudioModal } from './components/audio-modal.js';
import { LabelModal } from './components/label-modal.js';
import { SettingsModal } from './components/settings-modal.js';
import { AuthModal } from './components/auth-modal.js';
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

    // 6. Check pending reminders
    RemindersModule.checkPendingReminders();

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

    // Window focus checks for reminders
    window.addEventListener('focus', () => {
      RemindersModule.checkPendingReminders();
    });
  }

  handleUrlActions() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    if (action === 'new-note') {
      setTimeout(() => this.noteEditor.expandCreator('text'), 300);
    } else if (action === 'new-list') {
      setTimeout(() => this.noteEditor.expandCreator('checklist'), 300);
    } else if (action === 'new-drawing') {
      setTimeout(() => eventBus.emit('modal:drawing', {
        onSave: (att) => this.noteEditor.addAttachment(att)
      }), 300);
    }
  }

  async render() {
    const allNotes = await db.getAllNotes();
    const allLabels = await db.getLabels();

    // Adjust visibility of Note Creator (only visible in main 'notes' view without search)
    if (this.currentView === 'notes' && !this.searchQuery) {
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

    if (filteredNotes.length === 0) {
      this.pinnedSection.classList.add('hidden');
      this.otherSection.classList.add('hidden');
      this.showEmptyState();
      return;
    }

    this.emptyState.classList.add('hidden');
    this.otherSection.classList.remove('hidden');

    // Separate Pinned & Others if in main 'notes' view
    if (this.currentView === 'notes' && !this.searchQuery) {
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

    if (this.searchQuery) {
      this.emptyStateTitle.textContent = 'Aucun résultat trouvé';
      this.emptyStateDesc.textContent = `Aucune note ne correspond à "${this.searchQuery}".`;
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

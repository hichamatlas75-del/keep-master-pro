/**
 * KEEP MASTER PRO - Sidebar Component
 * Manages view switching (Notes, Reminders, Archive, Trash), dynamic labels list, and mobile drawer.
 */

import { db } from '../database/indexeddb.js';
import { escapeHTML } from '../utils/sanitize.js';
import { eventBus } from '../utils/event-bus.js';

export class Sidebar {
  constructor() {
    this.sidebar = document.getElementById('sidebar');
    this.toggleBtn = document.getElementById('sidebarToggleBtn');
    this.backdrop = document.getElementById('mobileDrawerBackdrop');
    this.labelsContainer = document.getElementById('sidebarLabelsContainer');
    this.editLabelsBtn = document.getElementById('sidebarEditLabelsBtn');
    this.userCard = document.getElementById('sidebarUserCard');
    this.settingsBtn = document.getElementById('sidebarSettingsBtn');
    this.userName = document.getElementById('sidebarUserName');
    this.userEmail = document.getElementById('sidebarUserEmail');
    this.userAvatar = document.getElementById('sidebarUserAvatar');
    this.currentView = 'notes';
    this.currentLabelId = null;

    this.init();
  }

  init() {
    // 1. Toggle button (hamburger)
    if (this.toggleBtn) {
      this.toggleBtn.onclick = () => this.toggleSidebar();
    }

    if (this.backdrop) {
      this.backdrop.onclick = () => this.closeMobileDrawer();
    }

    // 2. User account card click
    if (this.userCard) {
      this.userCard.onclick = () => {
        eventBus.emit('modal:auth');
        this.closeMobileDrawer();
      };
    }

    // 3. Settings button in sidebar (mobile easy access)
    if (this.settingsBtn) {
      this.settingsBtn.onclick = () => {
        eventBus.emit('modal:settings');
        this.closeMobileDrawer();
      };
    }

    // 4. Static navigation items (Notes, Reminders, Archive, Trash)
    this.sidebar.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.onclick = () => {
        const view = item.dataset.view;
        this.setView(view);
        this.closeMobileDrawer();
      };
    });

    // 5. Edit labels button
    if (this.editLabelsBtn) {
      this.editLabelsBtn.onclick = () => {
        eventBus.emit('modal:labels');
        this.closeMobileDrawer();
      };
    }

    // 6. Listen to labels change and auth change
    eventBus.on('labels:changed', () => this.renderLabels());
    eventBus.on('auth:change', ({ user, isGuest }) => {
      this.updateUserCard(user, isGuest);
    });

    // Initial render
    this.renderLabels();
  }

  updateUserCard(user, isGuest) {
    if (!this.userName || !this.userEmail || !this.userAvatar) return;
    if (!isGuest && user) {
      this.userName.textContent = user.name || 'Utilisateur';
      this.userEmail.textContent = user.email || 'Connecté à Firebase';
      this.userAvatar.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
      this.userAvatar.style.background = 'var(--accent-primary)';
    } else {
      this.userName.textContent = 'Mon Compte';
      this.userEmail.textContent = 'Mode local (Appuyez pour connecter)';
      this.userAvatar.textContent = '👤';
      this.userAvatar.style.background = 'var(--text-secondary)';
    }
  }

  toggleSidebar() {
    if (window.innerWidth <= 768) {
      this.sidebar.classList.toggle('open');
    } else {
      this.sidebar.classList.toggle('collapsed');
    }
  }

  closeMobileDrawer() {
    this.sidebar.classList.remove('open');
  }

  setView(view, labelId = null) {
    this.currentView = view;
    this.currentLabelId = labelId;

    // Update active class on nav items
    this.sidebar.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    if (view === 'label' && labelId) {
      const activeLabelItem = this.labelsContainer.querySelector(`[data-label-id="${labelId}"]`);
      if (activeLabelItem) activeLabelItem.classList.add('active');
    } else {
      const activeItem = this.sidebar.querySelector(`[data-view="${view}"]`);
      if (activeItem) activeItem.classList.add('active');
    }

    eventBus.emit('view:change', { view, labelId });
  }

  async renderLabels() {
    if (!this.labelsContainer) return;
    const labels = await db.getLabels();
    this.labelsContainer.innerHTML = '';

    labels.forEach(lbl => {
      const item = document.createElement('div');
      item.className = `nav-item ${this.currentView === 'label' && this.currentLabelId === lbl.$id ? 'active' : ''}`;
      item.dataset.labelId = lbl.$id;
      item.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
        <span class="truncate">${escapeHTML(lbl.name)}</span>
      `;

      item.onclick = () => {
        this.setView('label', lbl.$id);
        this.closeMobileDrawer();
      };

      this.labelsContainer.appendChild(item);
    });
  }
}

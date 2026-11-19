/**
 * KEEP MASTER PRO - Header Component
 * Controls search input, filters popover, view toggles, theme switcher & sync badge.
 */

import { APP_CONFIG } from '../config.js';
import { db } from '../database/indexeddb.js';
import { auth } from '../services/auth.js';
import { debounce } from '../utils/helpers.js';
import { eventBus } from '../utils/event-bus.js';

export class Header {
  constructor() {
    this.searchInput = document.getElementById('searchInput');
    this.searchClearBtn = document.getElementById('searchClearBtn');
    this.filterToggleBtn = document.getElementById('filterToggleBtn');
    this.viewToggleBtn = document.getElementById('viewToggleBtn');
    this.viewGridIcon = document.getElementById('viewGridIcon');
    this.viewListIcon = document.getElementById('viewListIcon');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeMoonIcon = document.getElementById('themeMoonIcon');
    this.themeSunIcon = document.getElementById('themeSunIcon');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.authBtn = document.getElementById('authBtn');
    this.syncBadge = document.getElementById('syncStatusBadge');
    this.syncText = document.getElementById('syncStatusText');

    this.currentViewMode = 'grid'; // 'grid' | 'list'
    this.currentTheme = 'dark';
    this.activeFilters = {
      color: null,
      type: null
    };

    this.init();
  }

  async init() {
    // 1. Restore Theme
    const savedTheme = await db.getSetting('theme', 'dark');
    this.setTheme(savedTheme);

    // 2. Restore View Mode (Grid vs List)
    const savedViewMode = await db.getSetting('viewMode', 'grid');
    this.setViewMode(savedViewMode);

    // 3. Search events
    if (this.searchInput) {
      const emitSearch = debounce(() => {
        const query = this.searchInput.value.trim();
        if (query) {
          this.searchClearBtn?.classList.remove('hidden');
        } else {
          this.searchClearBtn?.classList.add('hidden');
        }
        eventBus.emit('search:query', { query, ...this.activeFilters });
      }, 250);

      this.searchInput.oninput = emitSearch;

      this.searchClearBtn.onclick = () => {
        this.searchInput.value = '';
        this.searchClearBtn.classList.add('hidden');
        eventBus.emit('search:query', { query: '', ...this.activeFilters });
        this.searchInput.focus();
      };
    }

    // 4. Advanced Filter Button
    if (this.filterToggleBtn) {
      this.filterToggleBtn.onclick = (e) => {
        e.stopPropagation();
        this.openFilterPopover(e.currentTarget);
      };
    }

    // 5. Grid/List Toggle
    if (this.viewToggleBtn) {
      this.viewToggleBtn.onclick = () => {
        const nextMode = this.currentViewMode === 'grid' ? 'list' : 'grid';
        this.setViewMode(nextMode);
      };
    }

    // 6. Theme Toggle
    if (this.themeToggleBtn) {
      this.themeToggleBtn.onclick = () => {
        const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(nextTheme);
      };
    }

    // 7. Settings & Auth Modals
    if (this.settingsBtn) {
      this.settingsBtn.onclick = () => eventBus.emit('modal:settings');
    }
    if (this.authBtn) {
      this.authBtn.onclick = () => eventBus.emit('modal:auth');
    }

    // 8. Sync status listener
    eventBus.on('sync:status', ({ status, message }) => {
      this.updateSyncBadge(status, message);
    });

    // 9. Auth change listener
    eventBus.on('auth:change', ({ user, isGuest }) => {
      this.updateAuthIcon(user, isGuest);
    });
  }

  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    db.setSetting('theme', theme);

    if (theme === 'dark') {
      this.themeMoonIcon?.classList.remove('hidden');
      this.themeSunIcon?.classList.add('hidden');
    } else {
      this.themeMoonIcon?.classList.add('hidden');
      this.themeSunIcon?.classList.remove('hidden');
    }
  }

  setViewMode(mode) {
    this.currentViewMode = mode;
    db.setSetting('viewMode', mode);

    const containers = [
      document.getElementById('pinnedNotesContainer'),
      document.getElementById('otherNotesContainer')
    ];

    containers.forEach(cont => {
      if (!cont) return;
      if (mode === 'list') {
        cont.classList.remove('grid-view');
        cont.classList.add('list-view');
      } else {
        cont.classList.remove('list-view');
        cont.classList.add('grid-view');
      }
    });

    if (mode === 'list') {
      this.viewGridIcon?.classList.add('hidden');
      this.viewListIcon?.classList.remove('hidden');
    } else {
      this.viewGridIcon?.classList.remove('hidden');
      this.viewListIcon?.classList.add('hidden');
    }
  }

  updateSyncBadge(status, message) {
    if (!this.syncBadge || !this.syncText) return;
    this.syncBadge.className = `sync-badge ${status}`;
    this.syncText.textContent = message || status;
  }

  updateAuthIcon(user, isGuest) {
    const loggedOutIcon = document.getElementById('authLoggedOutIcon');
    const avatarEl = document.getElementById('authUserAvatar');

    if (!isGuest && user) {
      loggedOutIcon?.classList.add('hidden');
      avatarEl?.classList.remove('hidden');
      if (avatarEl) {
        avatarEl.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
      }
    } else {
      loggedOutIcon?.classList.remove('hidden');
      avatarEl?.classList.add('hidden');
    }
  }

  openFilterPopover(triggerBtn) {
    document.querySelectorAll('.filter-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'filter-popover';
    popover.style.cssText = `
      position: absolute;
      top: 54px;
      right: 0;
      background: var(--bg-surface);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-color);
      padding: 14px;
      z-index: var(--z-dropdown);
      min-width: 260px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      animation: slideUp 120ms ease-out;
    `;

    popover.innerHTML = `
      <div style="font-weight:600;font-size:13px;color:var(--text-primary);">Filtrer par type</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="filter-type-btn btn-secondary ${!this.activeFilters.type ? 'active' : ''}" data-type="" style="font-size:12px;padding:3px 8px;">Tous</button>
        <button class="filter-type-btn btn-secondary ${this.activeFilters.type === 'checklist' ? 'active' : ''}" data-type="checklist" style="font-size:12px;padding:3px 8px;">Listes</button>
        <button class="filter-type-btn btn-secondary ${this.activeFilters.type === 'drawing' ? 'active' : ''}" data-type="drawing" style="font-size:12px;padding:3px 8px;">Dessins</button>
        <button class="filter-type-btn btn-secondary ${this.activeFilters.type === 'audio' ? 'active' : ''}" data-type="audio" style="font-size:12px;padding:3px 8px;">Vocales</button>
      </div>

      <div style="font-weight:600;font-size:13px;color:var(--text-primary);">Filtrer par couleur</div>
      <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:6px;">
        <div class="color-option bg-default ${!this.activeFilters.color ? 'selected' : ''}" data-color="" title="Toutes"></div>
        ${APP_CONFIG.NOTE_COLORS.slice(1).map(c => `
          <div class="color-option ${c.class} ${this.activeFilters.color === c.id ? 'selected' : ''}" data-color="${c.id}" title="${c.name}"></div>
        `).join('')}
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:6px;">
        <button id="resetFiltersBtn" class="btn-secondary" style="font-size:12px;padding:3px 8px;">Effacer les filtres</button>
      </div>
    `;

    popover.querySelectorAll('.filter-type-btn').forEach(btn => {
      btn.onclick = () => {
        this.activeFilters.type = btn.dataset.type || null;
        eventBus.emit('search:query', { query: this.searchInput.value.trim(), ...this.activeFilters });
        popover.remove();
      };
    });

    popover.querySelectorAll('.color-option').forEach(opt => {
      opt.onclick = () => {
        this.activeFilters.color = opt.dataset.color || null;
        eventBus.emit('search:query', { query: this.searchInput.value.trim(), ...this.activeFilters });
        popover.remove();
      };
    });

    popover.querySelector('#resetFiltersBtn').onclick = () => {
      this.activeFilters.type = null;
      this.activeFilters.color = null;
      eventBus.emit('search:query', { query: this.searchInput.value.trim(), ...this.activeFilters });
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
}

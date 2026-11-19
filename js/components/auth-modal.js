/**
 * KEEP MASTER PRO - Authentication Modal Component
 * Appwrite user registration, sign in, account profile, and guest mode.
 */

import { auth } from '../services/auth.js';
import { appwrite } from '../services/appwrite.js';
import { Toast } from './toast.js';
import { eventBus } from '../utils/event-bus.js';

export class AuthModal {
  constructor() {
    this.modalEl = null;
    this.mode = 'login'; // 'login' | 'register' | 'profile'
    this.init();
  }

  init() {
    eventBus.on('modal:auth', () => this.open());
  }

  open() {
    const container = document.getElementById('modalsContainer');
    if (!container) return;

    const user = auth.getUser();
    this.mode = auth.isGuest ? 'login' : 'profile';

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop';

    this.renderContent();
    container.appendChild(this.modalEl);
  }

  renderContent() {
    const user = auth.getUser();

    if (this.mode === 'profile') {
      this.modalEl.innerHTML = `
        <div class="modal-content" style="max-width: 440px;">
          <div class="modal-header">
            <h3 class="modal-title">Mon Compte</h3>
            <button id="closeAuthModalBtn" class="btn-icon">×</button>
          </div>
          <div class="modal-body" style="align-items:center;text-align:center;gap:16px;">
            <div style="width:64px;height:64px;border-radius:50%;background:var(--accent-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;">
              ${(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-size:16px;font-weight:600;color:var(--text-primary);">${user?.name || 'Utilisateur'}</div>
              <div style="font-size:13px;color:var(--text-secondary);">${user?.email || ''}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">ID: ${user?.$id}</div>
            </div>
            <button id="authLogoutBtn" class="btn-danger" style="width:100%;">Se déconnecter</button>
          </div>
        </div>
      `;

      this.modalEl.querySelector('#closeAuthModalBtn').onclick = () => this.close();
      this.modalEl.querySelector('#authLogoutBtn').onclick = async () => {
        await auth.logout();
        Toast.show('Déconnecté. Vous êtes repassé en mode local.');
        this.close();
      };
      return;
    }

    const isLogin = this.mode === 'login';

    this.modalEl.innerHTML = `
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">${isLogin ? 'Connexion Appwrite' : 'Créer un compte'}</h3>
          <button id="closeAuthModalBtn" class="btn-icon">×</button>
        </div>
        <div class="modal-body" style="gap:14px;">
          ${!appwrite.isConfigured ? `
            <div style="background:var(--accent-subtle);color:var(--accent-text);padding:8px 12px;border-radius:6px;font-size:12px;">
              ⚠️ Appwrite Cloud n'est pas encore configuré. Renseignez votre Project ID dans les Paramètres pour activer la synchronisation multi-appareils.
            </div>
          ` : ''}

          ${!isLogin ? `
            <div style="display:flex;flex-direction:column;gap:4px;">
              <label style="font-size:12px;color:var(--text-secondary);">Nom complet :</label>
              <input type="text" id="authNameInput" placeholder="Ex: Jean Dupont" style="padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-input);">
            </div>
          ` : ''}

          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:12px;color:var(--text-secondary);">Adresse Email :</label>
            <input type="email" id="authEmailInput" placeholder="email@exemple.com" style="padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-input);">
          </div>

          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:12px;color:var(--text-secondary);">Mot de passe :</label>
            <input type="password" id="authPasswordInput" placeholder="••••••••" style="padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-input);">
          </div>

          <div id="authErrorMsg" class="hidden" style="color:var(--danger-color);font-size:12px;"></div>

          <button id="authSubmitBtn" class="btn-primary" style="width:100%;padding:10px;margin-top:6px;">
            ${isLogin ? 'Se connecter' : 'Créer le compte'}
          </button>

          <div style="text-align:center;font-size:13px;color:var(--text-secondary);margin-top:8px;">
            ${isLogin ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
            <a href="#" id="toggleAuthModeBtn" style="color:var(--accent-primary);font-weight:600;">
              ${isLogin ? 'Inscrivez-vous' : 'Connectez-vous'}
            </a>
          </div>

          <div style="text-align:center;margin-top:4px;">
            <button id="continueGuestBtn" class="btn-secondary" style="font-size:12px;">
              Continuer en mode local hors-ligne (Invité)
            </button>
          </div>
        </div>
      </div>
    `;

    this.modalEl.querySelector('#closeAuthModalBtn').onclick = () => this.close();

    this.modalEl.querySelector('#toggleAuthModeBtn').onclick = (e) => {
      e.preventDefault();
      this.mode = isLogin ? 'register' : 'login';
      this.renderContent();
    };

    this.modalEl.querySelector('#continueGuestBtn').onclick = () => {
      Toast.show('Mode local actif. Vos notes restent stockées sur votre appareil.');
      this.close();
    };

    const submitBtn = this.modalEl.querySelector('#authSubmitBtn');
    const errBox = this.modalEl.querySelector('#authErrorMsg');

    submitBtn.onclick = async () => {
      const email = this.modalEl.querySelector('#authEmailInput')?.value.trim();
      const password = this.modalEl.querySelector('#authPasswordInput')?.value;
      const name = this.modalEl.querySelector('#authNameInput')?.value.trim();

      if (!email || !password) {
        errBox.textContent = 'Veuillez renseigner un email et un mot de passe.';
        errBox.classList.remove('hidden');
        return;
      }

      errBox.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Chargement...';

      try {
        if (isLogin) {
          await auth.login(email, password);
          Toast.show('Connexion réussie !');
        } else {
          await auth.register(email, password, name || 'Utilisateur');
          Toast.show('Compte créé et connecté !');
        }
        this.close();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Se connecter' : 'Créer le compte';
      }
    };

    this.modalEl.onclick = (e) => {
      if (e.target === this.modalEl) this.close();
    };
  }

  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }
}

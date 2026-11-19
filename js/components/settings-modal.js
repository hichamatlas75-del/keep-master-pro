/**
 * KEEP MASTER PRO - Settings, Backup & Firebase Configuration Modal
 * Handles JSON Backup Export/Import, Firebase Cloud configuration, sync controls and step-by-step guidance.
 */

import { firebase } from '../services/firebase.js';
import { db } from '../database/indexeddb.js';
import { BackupEngine } from '../database/backup.js';
import { syncEngine } from '../sync/sync-engine.js';
import { syncQueue } from '../sync/sync-queue.js';
import { Toast } from './toast.js';
import { eventBus } from '../utils/event-bus.js';

export class SettingsModal {
  constructor() {
    this.modalEl = null;
    this.init();
  }

  init() {
    eventBus.on('modal:settings', () => this.open());
  }

  async open() {
    const container = document.getElementById('modalsContainer');
    if (!container) return;

    const savedConfig = (await db.getSetting('firebase_config')) || firebase.config || {};
    const pendingCount = await syncQueue.count();

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop';

    this.modalEl.innerHTML = `
      <div class="modal-content" style="max-width: 580px;">
        <div class="modal-header">
          <h3 class="modal-title">Paramètres & Sauvegardes</h3>
          <button id="closeSettingsModalBtn" class="btn-icon">×</button>
        </div>

        <div class="modal-body" style="gap:20px;">
          <!-- 1. Firebase Cloud Configuration -->
          <section style="display:flex;flex-direction:column;gap:10px;">
            <div style="font-weight:600;font-size:15px;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🔥</span> <span>Connexion Firebase Cloud (Forfait Spark Gratuit)</span>
            </div>
            <p style="font-size:12px;color:var(--text-secondary);line-height:1.5;">
              Synchronisez vos notes en temps réel sur tous vos appareils via Google Cloud Firestore et Firebase Auth.
              (L'application reste 100% fonctionnelle hors-ligne en mode local).
            </p>

            <div style="display:flex;flex-direction:column;gap:8px;">
              <label style="font-size:12px;font-weight:500;color:var(--text-secondary);">Firebase API Key :</label>
              <input type="text" id="settingFirebaseApiKey" value="${savedConfig.API_KEY || ''}" placeholder="AIzaSy..." style="padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-input);font-size:13px;">

              <label style="font-size:12px;font-weight:500;color:var(--text-secondary);">Project ID :</label>
              <input type="text" id="settingFirebaseProjectId" value="${savedConfig.PROJECT_ID || 'keep-master-pro'}" placeholder="keep-master-pro" style="padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-input);font-size:13px;">

              <label style="font-size:12px;font-weight:500;color:var(--text-secondary);">Auth Domain :</label>
              <input type="text" id="settingFirebaseAuthDomain" value="${savedConfig.AUTH_DOMAIN || 'keep-master-pro.firebaseapp.com'}" placeholder="keep-master-pro.firebaseapp.com" style="padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-input);font-size:13px;">

              <label style="font-size:12px;font-weight:500;color:var(--text-secondary);">App ID :</label>
              <input type="text" id="settingFirebaseAppId" value="${savedConfig.APP_ID || ''}" placeholder="1:123456789012:web:abcdef..." style="padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-input);font-size:13px;">
            </div>

            <div style="display:flex;gap:8px;margin-top:4px;">
              <button id="saveFirebaseConfigBtn" class="btn-primary" style="font-size:13px;">Enregistrer la configuration</button>
              <button id="testFirebasePingBtn" class="btn-secondary" style="font-size:13px;">Tester la connexion</button>
            </div>
            <div id="firebasePingResult" style="font-size:12px;font-weight:500;"></div>
          </section>

          <hr style="border:none;border-top:1px solid var(--border-color);">

          <!-- 2. JSON Backup & Restore -->
          <section style="display:flex;flex-direction:column;gap:10px;">
            <div style="font-weight:600;font-size:15px;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>💾</span> <span>Sauvegarde & Restauration Locale (JSON)</span>
            </div>
            <p style="font-size:12px;color:var(--text-secondary);line-height:1.5;">
              Exportez vos données de manière totalement indépendante sous forme de fichier JSON, ou restaurez une ancienne sauvegarde avec détection automatique des doublons.
            </p>

            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button id="exportBackupBtn" class="btn-primary" style="display:flex;gap:6px;align-items:center;">
                <span>⬇️</span> <span>Exporter la sauvegarde (JSON)</span>
              </button>

              <button id="importBackupBtn" class="btn-secondary" style="display:flex;gap:6px;align-items:center;border:1px solid var(--border-color);">
                <span>⬆️</span> <span>Importer une sauvegarde</span>
              </button>
              <input type="file" id="importJsonFileInput" accept=".json,application/json" class="hidden">
            </div>

            <div id="importReportBox" class="hidden" style="background:var(--bg-surface-variant);padding:10px;border-radius:6px;font-size:12px;border:1px solid var(--border-color);"></div>
          </section>

          <hr style="border:none;border-top:1px solid var(--border-color);">

          <!-- 3. Sync & Cache Diagnostics -->
          <section style="display:flex;flex-direction:column;gap:10px;">
            <div style="font-weight:600;font-size:15px;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span>🔄</span> <span>File de synchronisation hors-ligne</span>
            </div>
            <div style="font-size:13px;color:var(--text-secondary);">
              Modifications locales en attente d'envoi : <strong id="queueCountSpan" style="color:var(--accent-primary);">${pendingCount}</strong>
            </div>
            <div style="display:flex;gap:10px;">
              <button id="forceSyncBtn" class="btn-secondary" style="border:1px solid var(--border-color);">
                Forcer la synchronisation maintenant
              </button>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button id="closeSettingsBottomBtn" class="btn-primary">Fermer</button>
        </div>
      </div>
    `;

    container.appendChild(this.modalEl);

    // Save Firebase Config
    const apiKeyInput = this.modalEl.querySelector('#settingFirebaseApiKey');
    const projectInput = this.modalEl.querySelector('#settingFirebaseProjectId');
    const authDomainInput = this.modalEl.querySelector('#settingFirebaseAuthDomain');
    const appIdInput = this.modalEl.querySelector('#settingFirebaseAppId');
    const pingResult = this.modalEl.querySelector('#firebasePingResult');

    this.modalEl.querySelector('#saveFirebaseConfigBtn').onclick = async () => {
      await firebase.updateConfig({
        API_KEY: apiKeyInput.value.trim(),
        PROJECT_ID: projectInput.value.trim(),
        AUTH_DOMAIN: authDomainInput.value.trim(),
        APP_ID: appIdInput.value.trim()
      });
      Toast.show('Configuration Firebase enregistrée');
      syncEngine.syncNow();
    };

    // Test Ping
    this.modalEl.querySelector('#testFirebasePingBtn').onclick = async () => {
      pingResult.style.color = 'var(--text-secondary)';
      pingResult.textContent = 'Test en cours...';
      const ok = await firebase.ping();
      if (ok) {
        pingResult.style.color = 'var(--success-color)';
        pingResult.textContent = '✅ Connexion à Firebase Firestore établie avec succès !';
      } else {
        pingResult.style.color = 'var(--danger-color)';
        pingResult.textContent = '⚠️ Firestore inaccessible. Vérifiez vos identifiants ou votre connexion.';
      }
    };

    // Export Backup
    this.modalEl.querySelector('#exportBackupBtn').onclick = async () => {
      try {
        const res = await BackupEngine.exportBackup();
        Toast.show(`Sauvegarde téléchargée (${res.notesCount} notes, ${res.labelsCount} libellés)`);
      } catch (err) {
        Toast.show(`Erreur export : ${err.message}`);
      }
    };

    // Import Backup
    const fileInput = this.modalEl.querySelector('#importJsonFileInput');
    const reportBox = this.modalEl.querySelector('#importReportBox');

    this.modalEl.querySelector('#importBackupBtn').onclick = () => fileInput.click();

    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const report = await BackupEngine.importBackup(text, { mergeStrategy: 'merge' });

        reportBox.classList.remove('hidden');
        reportBox.innerHTML = `
          <strong style="color:var(--success-color);">Rapport de restauration terminé :</strong><br>
          • Notes créées : <strong>${report.importedNotes}</strong><br>
          • Notes mises à jour : <strong>${report.updatedNotes}</strong><br>
          • Notes ignorées (doublons ou antérieures) : <strong>${report.skippedNotes}</strong><br>
          • Libellés importés : <strong>${report.importedLabels}</strong>
          ${report.errors.length > 0 ? `<br><span style="color:var(--danger-color);">• Avertissements : ${report.errors.join(', ')}</span>` : ''}
        `;
        Toast.show('Restauration des données réussie !');
      } catch (err) {
        reportBox.classList.remove('hidden');
        reportBox.innerHTML = `<span style="color:var(--danger-color);">Erreur : ${err.message}</span>`;
      }
      fileInput.value = '';
    };

    // Force Sync
    this.modalEl.querySelector('#forceSyncBtn').onclick = async () => {
      await syncEngine.syncNow();
      const count = await syncQueue.count();
      this.modalEl.querySelector('#queueCountSpan').textContent = count;
      Toast.show('Synchronisation déclenchée');
    };

    // Close
    const close = () => {
      this.modalEl.remove();
      this.modalEl = null;
    };

    this.modalEl.querySelector('#closeSettingsModalBtn').onclick = close;
    this.modalEl.querySelector('#closeSettingsBottomBtn').onclick = close;
    this.modalEl.onclick = (e) => {
      if (e.target === this.modalEl) close();
    };
  }
}

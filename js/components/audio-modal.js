/**
 * KEEP MASTER PRO - Audio Recorder Modal Component
 * Voice notes recording, pause/resume, live preview & duration counter.
 */

import { AudioEngine } from '../modules/audio.js';
import { storage } from '../services/storage.js';
import { eventBus } from '../utils/event-bus.js';
import { Toast } from './toast.js';

const MIC_ICON = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
const STOP_ICON = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>`;

export class AudioModal {
  constructor() {
    this.modalEl = null;
    this.engine = new AudioEngine();
    this.init();
  }

  init() {
    eventBus.on('modal:audio', ({ onSave }) => {
      this.open(onSave);
    });
  }

  open(onSave) {
    const container = document.getElementById('modalsContainer');
    if (!container) return;

    if (this.modalEl) {
      this.engine.cancelRecording();
      this.modalEl.remove();
      this.modalEl = null;
    }

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop';
    this.modalEl.addEventListener('click', (e) => e.stopPropagation());

    this.modalEl.innerHTML = `
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h3 class="modal-title">Enregistrement Vocal</h3>
          <button id="closeAudioModalBtn" class="btn-icon" aria-label="Fermer">×</button>
        </div>

        <div class="modal-body">
          <div class="audio-recorder-box">
            <div id="audioTimer" class="record-timer">00:00</div>

            <div class="audio-controls-row">
              <button id="recordToggleBtn" class="record-btn-large" title="Démarrer l'enregistrement">
                ${MIC_ICON}
              </button>
              <button id="pauseAudioBtn" class="btn-secondary hidden">Pause</button>
            </div>

            <div id="audioStatusText" style="font-size:13px;color:var(--text-secondary);text-align:center;">
              Cliquez sur le micro pour démarrer
            </div>

            <audio id="audioPreviewPlayer" controls class="hidden" style="width:100%;max-width:360px;height:40px;"></audio>
          </div>
        </div>

        <div class="modal-footer">
          <button id="cancelAudioBtn" class="btn-secondary">Annuler</button>
          <button id="saveAudioBtn" class="btn-primary" disabled>Enregistrer la note vocale</button>
        </div>
      </div>
    `;

    container.appendChild(this.modalEl);

    const timerEl = this.modalEl.querySelector('#audioTimer');
    const recordBtn = this.modalEl.querySelector('#recordToggleBtn');
    const pauseBtn = this.modalEl.querySelector('#pauseAudioBtn');
    const statusText = this.modalEl.querySelector('#audioStatusText');
    const previewPlayer = this.modalEl.querySelector('#audioPreviewPlayer');
    const saveBtn = this.modalEl.querySelector('#saveAudioBtn');

    let recordingData = null;
    let previewUrl = null;
    let isBusy = false;

    const revokePreview = () => {
      previewPlayer.pause();
      previewPlayer.removeAttribute('src');
      previewPlayer.load();
      previewPlayer.classList.add('hidden');
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }
    };

    const resetIdleUI = () => {
      recordBtn.classList.remove('recording');
      recordBtn.innerHTML = MIC_ICON;
      recordBtn.title = 'Démarrer l\'enregistrement';
      pauseBtn.classList.add('hidden');
      pauseBtn.textContent = 'Pause';
    };

    recordBtn.onclick = async () => {
      if (isBusy) return;

      if (!this.engine.isRecording) {
        isBusy = true;
        revokePreview();
        recordingData = null;
        saveBtn.disabled = true;

        try {
          await this.engine.startRecording((timeStr) => {
            timerEl.textContent = timeStr;
          });
          recordBtn.classList.add('recording');
          recordBtn.innerHTML = STOP_ICON;
          recordBtn.title = 'Arrêter l\'enregistrement';
          pauseBtn.textContent = 'Pause';
          pauseBtn.classList.remove('hidden');
          statusText.textContent = 'Enregistrement en cours... Cliquez pour arrêter.';
        } catch (err) {
          statusText.textContent = err.message;
          Toast.show(err.message);
        } finally {
          isBusy = false;
        }
      } else {
        isBusy = true;
        try {
          recordingData = await this.engine.stopRecording();
          resetIdleUI();
          recordBtn.title = 'Réenregistrer';

          previewUrl = URL.createObjectURL(recordingData.blob);
          previewPlayer.src = previewUrl;
          previewPlayer.classList.remove('hidden');

          statusText.textContent = `Enregistrement prêt (${recordingData.durationFormatted}) — Écoutez ou cliquez sur le micro pour recommencer.`;
          saveBtn.disabled = false;
        } catch (err) {
          recordingData = null;
          saveBtn.disabled = true;
          resetIdleUI();
          statusText.textContent = err.message;
          Toast.show(err.message);
        } finally {
          isBusy = false;
        }
      }
    };

    pauseBtn.onclick = () => {
      if (!this.engine.isRecording) return;
      if (this.engine.isPaused) {
        this.engine.resumeRecording();
        pauseBtn.textContent = 'Pause';
        statusText.textContent = 'Enregistrement en cours... Cliquez pour arrêter.';
      } else {
        this.engine.pauseRecording();
        pauseBtn.textContent = 'Reprendre';
        statusText.textContent = 'Enregistrement en pause...';
      }
    };

    const close = () => {
      revokePreview();
      this.engine.cancelRecording();
      if (this.modalEl) {
        this.modalEl.remove();
        this.modalEl = null;
      }
    };

    this.modalEl.querySelector('#closeAudioModalBtn').onclick = close;
    this.modalEl.querySelector('#cancelAudioBtn').onclick = close;

    saveBtn.onclick = async () => {
      if (!recordingData?.blob || saveBtn.disabled) return;

      saveBtn.disabled = true;
      saveBtn.textContent = 'Enregistrement...';

      try {
        const mime = recordingData.mimeType || 'audio/webm';
        let ext = 'webm';
        if (mime.includes('mp4') || mime.includes('m4a')) ext = 'm4a';
        else if (mime.includes('ogg')) ext = 'ogg';
        else if (mime.includes('wav')) ext = 'wav';

        const filename = `voice-note-${Date.now()}.${ext}`;
        const attachment = await storage.saveAttachment(
          recordingData.blob,
          filename,
          mime,
          {
            kind: 'audio',
            duration: recordingData.durationFormatted,
            durationSec: recordingData.duration
          }
        );
        if (onSave) await onSave(attachment);
        close();
      } catch (err) {
        console.error('[AudioModal] Erreur sauvegarde audio :', err);
        statusText.textContent = err.message || 'Erreur lors de la sauvegarde audio.';
        Toast.show(err.message || 'Impossible d\'enregistrer la note vocale.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Enregistrer la note vocale';
      }
    };
  }
}

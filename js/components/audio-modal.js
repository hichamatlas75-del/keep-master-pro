/**
 * KEEP MASTER PRO - Audio Recorder Modal Component
 * Voice notes recording, live audio visualizer & duration counter.
 */

import { AudioEngine } from '../modules/audio.js';
import { storage } from '../services/storage.js';
import { eventBus } from '../utils/event-bus.js';

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

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop';

    this.modalEl.innerHTML = `
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h3 class="modal-title">Enregistrement Vocal</h3>
          <button id="closeAudioModalBtn" class="btn-icon">×</button>
        </div>

        <div class="modal-body">
          <div class="audio-recorder-box">
            <div id="audioTimer" class="record-timer">00:00</div>

            <button id="recordToggleBtn" class="record-btn-large" title="Démarrer l'enregistrement">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            </button>

            <div id="audioStatusText" style="font-size:13px;color:var(--text-secondary);">
              Cliquez sur le micro pour démarrer
            </div>
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
    const statusText = this.modalEl.querySelector('#audioStatusText');
    const saveBtn = this.modalEl.querySelector('#saveAudioBtn');

    let recordingData = null;

    recordBtn.onclick = async () => {
      if (!this.engine.isRecording) {
        try {
          await this.engine.startRecording((timeStr) => {
            timerEl.textContent = timeStr;
          });
          recordBtn.classList.add('recording');
          recordBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>`;
          statusText.textContent = 'Enregistrement en cours... Cliquez pour terminer.';
          saveBtn.disabled = true;
        } catch (err) {
          statusText.textContent = err.message;
        }
      } else {
        // Stop recording
        recordingData = await this.engine.stopRecording();
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        statusText.textContent = `Enregistrement terminé (${recordingData.durationFormatted})`;
        saveBtn.disabled = false;
      }
    };

    const close = () => {
      this.engine.cancelRecording();
      this.modalEl.remove();
      this.modalEl = null;
    };

    this.modalEl.querySelector('#closeAudioModalBtn').onclick = close;
    this.modalEl.querySelector('#cancelAudioBtn').onclick = close;

    saveBtn.onclick = async () => {
      if (!recordingData || !recordingData.blob) return;

      const filename = `voice-note-${Date.now()}.${recordingData.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
      const attachment = await storage.saveAttachment(recordingData.blob, filename, recordingData.mimeType);
      if (onSave) onSave(attachment);
      close();
    };
  }
}

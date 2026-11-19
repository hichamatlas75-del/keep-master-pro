/**
 * KEEP MASTER PRO - Voice Audio Recording Module
 * Web MediaRecorder API, live timer, pause/resume, playback & audio blob management.
 */

export class AudioEngine {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.isPaused = false;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.timerInterval = null;
    this.onTick = null; // Callback for elapsed time updates
  }

  /**
   * Check if browser supports audio recording
   */
  static isSupported() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  /**
   * Request microphone permission and start recording
   */
  async startRecording(onTickCallback) {
    if (!AudioEngine.isSupported()) {
      throw new Error('L\'enregistrement audio n\'est pas supporté par ce navigateur.');
    }

    this.onTick = onTickCallback;
    this.audioChunks = [];
    this.elapsedTime = 0;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine supported mime type
      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, selectedMime ? { mimeType: selectedMime } : undefined);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(250); // Collect slice every 250ms
      this.isRecording = true;
      this.isPaused = false;
      this.startTime = Date.now();

      // Start elapsed timer
      this.timerInterval = setInterval(() => {
        if (!this.isPaused) {
          this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
          if (this.onTick) this.onTick(this.formatTime(this.elapsedTime));
        }
      }, 500);

      return true;
    } catch (err) {
      console.error('[AudioEngine] Erreur microphone :', err);
      throw new Error('Impossible d\'accéder au microphone. Veuillez vérifier les autorisations.');
    }
  }

  /**
   * Pause recording
   */
  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
    }
  }

  /**
   * Resume recording
   */
  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
    }
  }

  /**
   * Stop recording and return Audio Blob
   */
  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        return reject(new Error('Aucun enregistrement en cours.'));
      }

      clearInterval(this.timerInterval);

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });

        // Clean up audio tracks
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }

        this.isRecording = false;
        this.isPaused = false;

        resolve({
          blob: audioBlob,
          mimeType,
          duration: this.elapsedTime,
          durationFormatted: this.formatTime(this.elapsedTime)
        });
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel and discard current recording
   */
  cancelRecording() {
    clearInterval(this.timerInterval);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.isRecording = false;
    this.audioChunks = [];
  }

  /**
   * Format seconds to MM:SS
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

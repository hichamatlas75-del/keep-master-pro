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
    this.isStarting = false;
    this.isPaused = false;
    this.accumulatedMs = 0;
    this.segmentStart = 0;
    this.elapsedTime = 0;
    this.timerInterval = null;
    this.onTick = null; // Callback for elapsed time updates
  }

  /**
   * Check if browser supports audio recording
   */
  static isSupported() {
    return (
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
      typeof window !== 'undefined' &&
      Boolean(window.MediaRecorder)
    );
  }

  /**
   * Clean up active media stream tracks
   */
  _stopStreamTracks() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /**
   * Pick the best supported audio MIME type
   */
  _selectMimeType() {
    if (typeof MediaRecorder.isTypeSupported !== 'function') {
      return '';
    }
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  }

  /**
   * Create MediaRecorder with Spark-friendly bitrate fallback
   */
  _createRecorder(stream, selectedMime) {
    const baseOptions = selectedMime ? { mimeType: selectedMime } : {};
    try {
      return new MediaRecorder(stream, { ...baseOptions, audioBitsPerSecond: 32000 });
    } catch (_) {
      if (selectedMime) {
        try {
          return new MediaRecorder(stream, { mimeType: selectedMime });
        } catch (__) {
          // Fall through to default options
        }
      }
      return new MediaRecorder(stream);
    }
  }

  /**
   * Request microphone permission and start recording
   */
  async startRecording(onTickCallback) {
    if (this.isRecording || this.isStarting) {
      return false;
    }

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      throw new Error('L\'enregistrement audio nécessite une connexion sécurisée (HTTPS).');
    }

    if (!AudioEngine.isSupported()) {
      throw new Error('L\'enregistrement audio n\'est pas supporté par ce navigateur.');
    }

    this.isStarting = true;
    clearInterval(this.timerInterval);
    this.timerInterval = null;

    this.onTick = onTickCallback;
    this.audioChunks = [];
    this.elapsedTime = 0;
    this.accumulatedMs = 0;
    this.segmentStart = 0;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const selectedMime = this._selectMimeType();
      this.mediaRecorder = this._createRecorder(this.stream, selectedMime);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      try {
        this.mediaRecorder.start(250); // Collect slice every 250ms
      } catch (_) {
        this.mediaRecorder.start();
      }

      this.isRecording = true;
      this.isPaused = false;
      this.accumulatedMs = 0;
      this.segmentStart = Date.now();

      if (this.onTick) this.onTick('00:00');

      // Start elapsed timer (handles pauses accurately)
      this.timerInterval = setInterval(() => {
        if (!this.isPaused) {
          const totalMs = this.accumulatedMs + (Date.now() - this.segmentStart);
          this.elapsedTime = Math.floor(totalMs / 1000);
          if (this.onTick) this.onTick(this.formatTime(this.elapsedTime));
        }
      }, 250);

      return true;
    } catch (err) {
      console.error('[AudioEngine] Erreur microphone :', err);
      this._stopStreamTracks();
      this.mediaRecorder = null;
      this.isRecording = false;
      this.isPaused = false;

      if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        throw new Error('Accès au microphone refusé. Veuillez autoriser le microphone dans votre navigateur.');
      }
      if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
        throw new Error('Aucun microphone détecté sur cet appareil.');
      }
      if (err && (err.name === 'NotReadableError' || err.name === 'TrackStartError')) {
        throw new Error('Le microphone est déjà utilisé par une autre application.');
      }
      throw new Error(err?.message || 'Impossible d\'accéder au microphone. Veuillez vérifier les autorisations.');
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Pause recording
   */
  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
      this.accumulatedMs += Date.now() - this.segmentStart;
    }
  }

  /**
   * Resume recording
   */
  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.segmentStart = Date.now();
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
      this.timerInterval = null;

      if (!this.isPaused) {
        this.accumulatedMs += Date.now() - this.segmentStart;
      }
      this.elapsedTime = Math.floor(this.accumulatedMs / 1000);

      const recorder = this.mediaRecorder;

      const cleanup = () => {
        recorder.onstop = null;
        recorder.onerror = null;
        recorder.ondataavailable = null;
        this._stopStreamTracks();
        this.mediaRecorder = null;
        this.isRecording = false;
        this.isPaused = false;
      };

      const finalize = () => {
        const rawMime = recorder.mimeType || this.audioChunks[0]?.type || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: rawMime });
        cleanup();

        if (audioBlob.size === 0) {
          return reject(new Error('Enregistrement audio vide. Veuillez enregistrer au moins 1 seconde.'));
        }

        resolve({
          blob: audioBlob,
          mimeType: rawMime,
          duration: this.elapsedTime,
          durationFormatted: this.formatTime(this.elapsedTime)
        });
      };

      recorder.onstop = finalize;
      recorder.onerror = () => {
        cleanup();
        reject(new Error('Erreur durant l\'arrêt de l\'enregistrement audio.'));
      };

      if (recorder.state === 'inactive') {
        finalize();
      } else {
        try {
          recorder.stop();
        } catch (err) {
          cleanup();
          reject(new Error(err?.message || 'Erreur lors de l\'arrêt de l\'enregistrement audio.'));
        }
      }
    });
  }

  /**
   * Cancel and discard current recording
   */
  cancelRecording() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;

    if (this.mediaRecorder) {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onerror = null;

      if (this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch (_) {
          // Ignore stop errors during cancellation
        }
      }
      this.mediaRecorder = null;
    }

    this._stopStreamTracks();
    this.isRecording = false;
    this.isPaused = false;
    this.isStarting = false;
    this.audioChunks = [];
    this.accumulatedMs = 0;
    this.elapsedTime = 0;
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

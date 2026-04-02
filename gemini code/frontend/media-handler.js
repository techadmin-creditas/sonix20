/**
 * MediaHandler: Manages Audio/Video capture and playback
 */
class MediaHandler {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.audioWorkletNode = null;
    this.videoStream = null;
    this.videoInterval = null;
    this.nextStartTime = 0;
    this.scheduledSources = [];
    this.isRecording = false;
    this.videoCanvas = document.createElement("canvas");
    this.canvasCtx = this.videoCanvas.getContext("2d");

    // Session recording: combined mic + AI playback
    this.recordingDestination = null;
    this.recordingMixerNode = null; // persistent gain node to keep recorder alive
    this.sessionRecorder = null;
    this.sessionChunks = [];
    this.micRecordingSource = null;
  }

  async initializeAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      await this.audioContext.audioWorklet.addModule(
        "/static/pcm-processor.js"
      );
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  // --- Session Recording (mic + AI playback combined) ---

  startSessionRecording() {
    if (!this.audioContext) return;
    this.recordingDestination = this.audioContext.createMediaStreamDestination();

    // Create a persistent mixer gain node connected to the destination.
    // This keeps the MediaRecorder's stream "alive" even when no transient
    // BufferSource nodes are currently playing.
    this.recordingMixerNode = this.audioContext.createGain();
    this.recordingMixerNode.gain.value = 1;
    this.recordingMixerNode.connect(this.recordingDestination);

    // Feed a silent oscillator so the MediaRecorder always has an active track
    this._silenceOsc = this.audioContext.createOscillator();
    this._silenceGain = this.audioContext.createGain();
    this._silenceGain.gain.value = 0; // silent
    this._silenceOsc.connect(this._silenceGain);
    this._silenceGain.connect(this.recordingMixerNode);
    this._silenceOsc.start();

    this.sessionChunks = [];

    try {
      this.sessionRecorder = new MediaRecorder(this.recordingDestination.stream, {
        mimeType: "audio/webm;codecs=opus",
      });
    } catch (e) {
      this.sessionRecorder = new MediaRecorder(this.recordingDestination.stream);
    }

    this.sessionRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.sessionChunks.push(e.data);
    };
    this.sessionRecorder.start(1000);
    console.log("Session recording started");
  }

  stopSessionRecording() {
    return new Promise((resolve) => {
      if (!this.sessionRecorder || this.sessionRecorder.state === "inactive") {
        this._cleanupRecording();
        resolve(null);
        return;
      }
      this.sessionRecorder.onstop = () => {
        const blob = this.sessionChunks.length > 0
          ? new Blob(this.sessionChunks, { type: "audio/webm" })
          : null;
        this.sessionChunks = [];
        this._cleanupRecording();
        resolve(blob);
      };
      this.sessionRecorder.stop();
      this.sessionRecorder = null;
    });
  }

  _cleanupRecording() {
    if (this._silenceOsc) {
      try { this._silenceOsc.stop(); } catch (e) {}
      this._silenceOsc = null;
    }
    if (this._silenceGain) {
      try { this._silenceGain.disconnect(); } catch (e) {}
      this._silenceGain = null;
    }
    if (this.micRecordingSource) {
      try { this.micRecordingSource.disconnect(this.recordingMixerNode); } catch (e) {}
      this.micRecordingSource = null;
    }
    if (this.recordingMixerNode) {
      try { this.recordingMixerNode.disconnect(); } catch (e) {}
      this.recordingMixerNode = null;
    }
    this.recordingDestination = null;
  }

  async startAudio(onAudioData) {
    await this.initializeAudio();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );
      this.audioWorkletNode = new AudioWorkletNode(
        this.audioContext,
        "pcm-processor"
      );

      this.audioWorkletNode.port.onmessage = (event) => {
        if (this.isRecording) {
          const downsampled = this.downsampleBuffer(
            event.data,
            this.audioContext.sampleRate,
            16000
          );
          const pcm16 = this.convertFloat32ToInt16(downsampled);
          onAudioData(pcm16);
        }
      };

      source.connect(this.audioWorkletNode);
      // Mute local feedback
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0;
      this.audioWorkletNode.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      // Also feed mic into session recording via mixer
      if (this.recordingMixerNode) {
        this.micRecordingSource = source;
        source.connect(this.recordingMixerNode);
      }

      this.isRecording = true;
    } catch (e) {
      console.error("Error starting audio:", e);
      throw e;
    }
  }

  stopAudio() {
    this.isRecording = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
  }

  async startVideo(videoElement, onFrame) {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      videoElement.srcObject = this.videoStream;

      this.videoInterval = setInterval(() => {
        this.captureFrame(videoElement, onFrame);
      }, 1000); // 1 FPS
    } catch (e) {
      console.error("Error starting video:", e);
      throw e;
    }
  }

  async startScreen(videoElement, onFrame, onEnded) {
    try {
      this.videoStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      videoElement.srcObject = this.videoStream;

      // Handle stream ending (e.g. user clicks "Stop sharing" in browser UI)
      this.videoStream.getVideoTracks()[0].onended = () => {
        this.stopVideo(videoElement);
        if (onEnded) onEnded();
      };

      this.videoInterval = setInterval(() => {
        this.captureFrame(videoElement, onFrame);
      }, 1000); // 1 FPS
    } catch (e) {
      console.error("Error starting screen share:", e);
      throw e;
    }
  }

  stopVideo(videoElement) {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((t) => t.stop());
      this.videoStream = null;
    }
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
  }

  captureFrame(videoElement, onFrame) {
    if (!this.videoStream) return;
    this.videoCanvas.width = 640;
    this.videoCanvas.height = 480;
    this.canvasCtx.drawImage(videoElement, 0, 0, 640, 480);
    const base64 = this.videoCanvas.toDataURL("image/jpeg", 0.7).split(",")[1];
    onFrame(base64);
  }

  playAudio(arrayBuffer) {
    if (!this.audioContext) return;
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    const pcmData = new Int16Array(arrayBuffer);
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }

    const buffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    // Also feed AI playback into session recording via mixer
    if (this.recordingMixerNode) {
      source.connect(this.recordingMixerNode);
    }

    const now = this.audioContext.currentTime;
    this.nextStartTime = Math.max(now, this.nextStartTime);
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    this.scheduledSources.push(source);
    source.onended = () => {
      const idx = this.scheduledSources.indexOf(source);
      if (idx > -1) this.scheduledSources.splice(idx, 1);
    };
  }

  stopAudioPlayback() {
    this.scheduledSources.forEach((s) => {
      try {
        s.stop();
      } catch (e) {}
    });
    this.scheduledSources = [];
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
  }

  // Utils
  downsampleBuffer(buffer, sampleRate, outSampleRate) {
    if (outSampleRate === sampleRate) return buffer;
    const ratio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0,
        count = 0;
      for (
        let i = offsetBuffer;
        i < nextOffsetBuffer && i < buffer.length;
        i++
      ) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  convertFloat32ToInt16(buffer) {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
      buf[l] = Math.min(1, Math.max(-1, buffer[l])) * 0x7fff;
    }
    return buf.buffer;
  }
}

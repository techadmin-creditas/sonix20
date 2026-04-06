/**
 * VocalProcessor - High-performance AudioWorklet for microphone capturing.
 * 
 * Offloading this to a Worklet thread ensures that heavy UI re-renders 
 * (like sidebar animations or transcript updates) do not block the audio stream 
 * or introduce 50-100ms of "jank" latency.
 */
class VocalProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Pre-allocate buffers for Int16 conversion to minimize GC pressure
    this.bufferSize = 4096;
  }

  /**
   * process() is called by the browser's audio engine on a separate high-priority thread.
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // Single channel (mono) is sufficient for voice AI
    const channelData = input[0];
    const length = channelData.length;
    
    if (length === 0) return true;

    // 1. Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
    const pcmData = new Int16Array(length);
    let sumSq = 0;

    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      sumSq += sample * sample;
    }

    // 2. Calculate RMS energy for the UI peak meter (optional but useful)
    const rms = Math.sqrt(sumSq / length);

    // 3. Post back to main thread via Transferable to avoid copying overhead
    this.port.postMessage({
      audio: pcmData.buffer,
      rms: rms
    }, [pcmData.buffer]);

    return true;
  }
}

registerProcessor('vocal-processor', VocalProcessor);

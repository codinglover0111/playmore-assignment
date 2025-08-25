/**
 * AudioWorkletProcessor: 입력 오디오를 16kHz PCM16으로 다운샘플링하여
 * 메인 스레드로 전송합니다. Base64 인코딩은 메인 스레드에서 수행합니다.
 */
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._inputSampleRate = sampleRate;
  }

  _downsampleTo16k(input) {
    const outputSampleRate = 16000;
    if (this._inputSampleRate === outputSampleRate) {
      const out = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return out;
    }
    const sampleRateRatio = this._inputSampleRate / outputSampleRate;
    const newLength = Math.round(input.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (
        let i = offsetBuffer;
        i < nextOffsetBuffer && i < input.length;
        i++
      ) {
        accum += input[i];
        count++;
      }
      const value = count > 0 ? accum / count : 0;
      result[offsetResult] = value < 0 ? value * 0x8000 : value * 0x7fff;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    const pcm16 = this._downsampleTo16k(channelData);
    this.port.postMessage({ type: "audio-chunk", pcm16: pcm16.buffer }, [
      pcm16.buffer,
    ]);
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);

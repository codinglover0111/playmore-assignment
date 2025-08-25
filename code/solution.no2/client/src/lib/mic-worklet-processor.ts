/**
 * AudioWorkletProcessor: 입력 오디오를 16kHz PCM16으로 다운샘플링하고
 * 메인 스레드로 Base64 청크를 전송합니다.
 *
 * 주의: Worklet은 모듈 컨텍스트에서 실행되므로 DOM API를 사용할 수 없습니다.
 */

class MicProcessor extends AudioWorkletProcessor {
  private _inputSampleRate: number;

  constructor() {
    super();
    this._inputSampleRate = sampleRate; // AudioWorklet의 전역 샘플레이트
  }

  private _downsampleTo16k(input: Float32Array): Int16Array {
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

  private _pcm16ToBase64(pcm: Int16Array): string {
    const view = new Uint8Array(pcm.buffer);
    let binary = "";
    for (let i = 0; i < view.byteLength; i++)
      binary += String.fromCharCode(view[i]);
    // @ts-ignore: btoa is available in Worklet global
    return btoa(binary);
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    const pcm16 = this._downsampleTo16k(channelData);
    const base64 = this._pcm16ToBase64(pcm16);
    this.port.postMessage({ type: "audio-chunk", base64 });
    return true;
  }
}

// Worklet 전역에 등록
// @ts-ignore
registerProcessor("mic-processor", MicProcessor);

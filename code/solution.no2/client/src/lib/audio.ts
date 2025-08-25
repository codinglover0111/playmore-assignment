export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

export function downsampleTo16k(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = 16000
): Int16Array {
  if (outputSampleRate === inputSampleRate) {
    return floatTo16BitPCM(input);
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(input.length / sampleRateRatio);
  const result = new Int16Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
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

export function pcm16ToBase64(pcm: Int16Array): string {
  const view = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < view.byteLength; i++)
    binary += String.fromCharCode(view[i]);
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

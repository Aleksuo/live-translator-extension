export function floatTo16BitPCM(float32Array: Float32Array) {
  const len = float32Array.length;
  const output = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    output[i] = s;
  }
  return output.buffer;
}

export function concatenateFloat32Array(
  a: Float32Array<ArrayBufferLike>,
  b: Float32Array<ArrayBufferLike>,
): Float32Array<ArrayBufferLike> {
  const c = new Float32Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

export function isSilent(float32Array: Float32Array, threshold = 0.0005) {
  // Option A: compute RMS volume. If below threshold, treat as silence.
  // e.g. threshold ~ 0.0005 => very quiet
  let sum = 0;
  for (let i = 0; i < float32Array.length; i++) {
    sum += float32Array[i] * float32Array[i];
  }
  const rms = Math.sqrt(sum / float32Array.length);
  return rms < threshold;
}

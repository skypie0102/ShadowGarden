/* SPDX-License-Identifier: LGPL-3.0-only
 * Adapted from edge-tts drm.py, copyright rany and contributors.
 * Upstream bd44c1d1aaebdc1db7f47456ee12431b42ec7cac (2026-10-25).
 * JavaScript port: ShadowGarden contributors. See licenses/edge-tts/.
 * Keep the v2 protocol hash separate from application authentication.
 */
const INITIAL = [
  1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924,
  528734635, 1541459225,
];
const STATE = [
  4255104674, 2435071207, 3192492180, 3442351626, 1811967817, 79508907,
  4272990180, 66059218,
];
const SCHEDULE = [
  3945054110, 358115615, 2696978146, 217723578, 2787307148, 3520959633,
  3235718560, 4192668342, 4039316851, 1884868174, 1904797190, 15051571,
  3529027680, 1920361828,
];
const ROUNDS = [
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
  2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
  1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
  264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
  2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
  113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
  1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
  3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
  430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063,
  1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474,
  2756734187, 3204031479, 3329325298,
];
const COEFFICIENTS = [
  [3895366065, 3005677776],
  [1155409094, 2296378653],
  [1005282748, 693190712],
  [3365689651, 3005795295],
  [2367603217, 3557143765],
  [827258325, 652566332],
  [3911487921, 1618477510],
  [4037392853, 2192753147],
  [101076211, 4199654362],
  [3665427040, 545047652],
  [3201434976, 1010595059],
  [2314848760, 3536931681],
  [905590982, 3137643201],
  [3410617286, 3311559015],
];
export const EDGE_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const rol16 = (x) => ((x << 16) | (x >>> 16)) >>> 0;
const sigma0 = (x) =>
  ((x >>> 7) ^ (x << 25) ^ (x >>> 18) ^ (x << 14) ^ (x >>> 3)) >>> 0;
const sigma1 = (x) =>
  ((x >>> 17) ^ (x << 15) ^ (x >>> 19) ^ (x << 13) ^ (x >>> 10)) >>> 0;
function expand(words, from = 16) {
  for (let i = from; i < 64; i++)
    words[i] =
      (sigma1(words[i - 2]) +
        words[i - 7] +
        sigma0(words[i - 15]) +
        words[i - 16]) >>>
      0;
}
function rounds(state, words, first = 0) {
  let [a, b, c, d, e, f, g, h] = state;
  for (let i = first; i < 64; i++) {
    const s1 =
      (e >>> 6) ^
      (e << 26) ^
      ((e >>> 11) ^ (e << 21)) ^
      ((e >>> 25) ^ (e << 7));
    const s0 =
      (a >>> 2) ^
      (a << 30) ^
      ((a >>> 13) ^ (a << 19)) ^
      ((a >>> 22) ^ (a << 10));
    const constant = first === 14 && i === 14 ? 0xc9dc06a7 : ROUNDS[i];
    const t1 =
      (h + (s1 >>> 0) + ((g ^ (e & (f ^ g))) >>> 0) + constant + words[i]) >>>
      0;
    const t2 = ((s0 >>> 0) + (((a & b) | (c & (a | b))) >>> 0)) >>> 0;
    [a, b, c, d, e, f, g, h] = [
      (t1 + t2) >>> 0,
      a,
      b,
      c,
      (d + t1) >>> 0,
      e,
      f,
      g,
    ];
  }
  return [a, b, c, d, e, f, g, h];
}
function initial(data) {
  const words = Array(14).fill(0);
  words.push(data[0] * 65536 + data[1] * 256 + data[2]);
  words.push(
    (data[3] * 16777216 + data[4] * 65536 + data[5] * 256 + data[6]) >>> 0,
  );
  for (let i = 16; i < 30; i++) {
    let value = SCHEDULE[i - 16];
    if (i - 2 >= 14)
      value +=
        i === 16
          ? (sigma1(words[i - 2]) ^ 0x000b92c0) >>> 0
          : sigma1(words[i - 2]);
    if (i - 7 >= 14) value += words[i - 7];
    if (i - 15 >= 14)
      value +=
        i === 29
          ? (sigma0(words[i - 15]) ^ 0x059c0b80) >>> 0
          : sigma0(words[i - 15]);
    words.push(value >>> 0);
  }
  words.push(
    (sigma1(words[28]) +
      words[23] +
      sigma0(words[15]) +
      words[14] +
      0xc9dc06a7 -
      ROUNDS[14]) >>>
      0,
  );
  expand(words, 31);
  return rounds(STATE, words, 14).map((x, i) => (x + INITIAL[i]) >>> 0);
}
function sha(data) {
  const length = 57 + data.length;
  const padded = new Uint8Array(
    data.length - 7 + 1 + ((((55 - length) % 64) + 64) % 64) + 8,
  );
  padded.set(data.subarray(7));
  padded[data.length - 7] = 128;
  const view = new DataView(padded.buffer);
  view.setBigUint64(padded.length - 8, BigInt(length * 8));
  let state = initial(data);
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, i) =>
      view.getUint32(offset + i * 4),
    );
    expand(words);
    state = rounds(state, words).map((x, i) => (x + state[i]) >>> 0);
  }
  const result = new Uint8Array(32),
    resultView = new DataView(result.buffer);
  state.forEach((x, i) => resultView.setUint32(i * 4, x));
  return result;
}
function cs64(data, digest) {
  const view = new DataView(digest.buffer),
    a = view.getUint32(0, true) | 1,
    b = view.getUint32(4, true) | 1;
  const factors = [Math.imul(a, 0x82893933), Math.imul(b, 0x82893933)];
  const terms = COEFFICIENTS.map(
    ([c], i) => Math.imul(c, factors[i % 2]) >>> 0,
  );
  const offsets = COEFFICIENTS.map(([, o]) => o);
  const padded = new Uint8Array(Math.ceil((data.length + 1) / 8) * 8);
  padded.set(data, 1);
  const words = new DataView(padded.buffer);
  for (let i = 0; i < padded.length / 4; i++) {
    const word = words.getUint32(i * 4, true);
    let term = Math.imul(word, i % 2 === 0 ? a : b),
      offset = Math.imul(rol16(word), i % 2 === 0 ? 0xef0569fb : 0xc31713db);
    if (i === 0) {
      term += Math.imul(0xf2f90b1a, factors[0]);
      offset += 0x0b1a0000;
    }
    terms.push(term >>> 0);
    offsets.push(offset >>> 0);
  }
  let swapAcc = 0,
    swapLast = 0,
    state = 0,
    acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i],
      y = terms[i + 1];
    let q = Math.imul(rol16((offsets[i] + x) >>> 0), 0x76f50f34) >>> 0;
    swapAcc += (Math.imul(rol16(q), 0xc3efea97) + q) >>> 0;
    q = Math.imul(rol16((offsets[i + 1] + y) >>> 0), 0x1881ce3c) >>> 0;
    swapLast = (Math.imul(rol16(q), 0x35bd1ec9) + q) >>> 0;
    swapAcc = (swapAcc + swapLast) >>> 0;
    state = (Math.imul(state, a) + x) >>> 0;
    for (const factor of [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83])
      state = Math.imul(rol16(state), factor) >>> 0;
    acc += state;
    let t = (Math.imul(state, b) + y) >>> 0;
    for (const factor of [0xa27416f5, 0xd38396ff, 0x7c932b89, 0xbfa49f69])
      t = Math.imul(rol16(t), factor) >>> 0;
    state = t;
    acc = (acc + state) >>> 0;
  }
  const result = new Uint8Array(8),
    resultView = new DataView(result.buffer);
  resultView.setUint32(0, (swapLast ^ state) >>> 0, true);
  resultView.setUint32(4, (swapAcc ^ acc) >>> 0, true);
  return result;
}
const hex = (bytes) =>
  Array.from(bytes, (x) => x.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
export function edgeToken(unixSeconds = Date.now() / 1000) {
  const ticks =
    BigInt(Math.floor((unixSeconds + 11644473600) / 300) * 300) * 10000000n;
  const data = new TextEncoder().encode(`${ticks}${EDGE_CLIENT_TOKEN}`),
    digest = sha(data);
  return `${hex(cs64(data, digest))}-${hex(digest)}`;
}

// Minimal image dimension reader (header parse only, no full decode) for the
// formats the cover pipeline handles. Storyblok needs the WxH at asset
// registration so the asset URL carries the dimensions segment that its image
// service (`/m/WxH/...` transforms) requires.
export interface Dimensions {
  width: number;
  height: number;
}

export function imageDimensions(buf: ArrayBuffer): Dimensions | null {
  const dv = new DataView(buf);
  const len = dv.byteLength;
  if (len < 24) return null;
  try {
    // PNG: 89 50 4E 47 ... IHDR width/height at byte 16/20
    if (dv.getUint32(0) === 0x89504e47) {
      return { width: dv.getUint32(16), height: dv.getUint32(20) };
    }
    // GIF: "GIF8", little-endian width/height at 6/8
    if (dv.getUint32(0) === 0x47494638) {
      return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
    }
    // JPEG: starts FFD8; scan for an SOF marker
    if (dv.getUint16(0) === 0xffd8) return jpeg(dv, len);
    // WebP: "RIFF"...."WEBP"
    if (dv.getUint32(0) === 0x52494646 && dv.getUint32(8) === 0x57454250) {
      return webp(dv, len);
    }
  } catch {
    return null;
  }
  return null;
}

function jpeg(dv: DataView, len: number): Dimensions | null {
  let off = 2;
  while (off + 9 < len) {
    if (dv.getUint8(off) !== 0xff) {
      off++;
      continue;
    }
    let marker = dv.getUint8(off + 1);
    while (marker === 0xff && off + 2 < len) {
      off++;
      marker = dv.getUint8(off + 1);
    }
    off += 2;
    // Standalone markers (no length payload): RSTn/SOI/EOI (D0-D9), TEM (01)
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) continue;
    if (off + 2 > len) break;
    const segLen = dv.getUint16(off);
    // SOF markers carry the frame size: C0-CF except C4 (DHT), C8 (JPG), CC (DAC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (off + 7 > len) break;
      return { height: dv.getUint16(off + 3), width: dv.getUint16(off + 5) };
    }
    off += segLen;
  }
  return null;
}

function webp(dv: DataView, len: number): Dimensions | null {
  if (len < 30) return null;
  const fmt = dv.getUint32(12); // chunk fourCC
  // VP8X (extended): 24-bit width-1/height-1 at offset 24/27 (little-endian)
  if (fmt === 0x56503858) {
    const w = 1 + (dv.getUint8(24) | (dv.getUint8(25) << 8) | (dv.getUint8(26) << 16));
    const h = 1 + (dv.getUint8(27) | (dv.getUint8(28) << 8) | (dv.getUint8(29) << 16));
    return { width: w, height: h };
  }
  // VP8 (lossy): 16-bit width/height at offset 26/28
  if (fmt === 0x56503820) {
    return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
  }
  // VP8L (lossless): 14-bit each, packed from byte 21
  if (fmt === 0x5650384c) {
    const b = dv.getUint32(21, true);
    return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
  }
  return null;
}

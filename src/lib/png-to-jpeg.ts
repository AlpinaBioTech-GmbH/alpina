// Pure-JS PNG → JPEG conversion (pngjs decode + jpeg-js encode). Used instead
// of sharp for Instagram slide rendering: no native binaries, so it survives
// any serverless bundling. ~1.5MP converts in well under a second.
import { PNG } from "pngjs";
import { encode } from "jpeg-js";

export function pngToJpeg(png: Buffer, quality = 90): Buffer {
  const decoded = PNG.sync.read(png);
  const encoded = encode(
    { data: decoded.data, width: decoded.width, height: decoded.height },
    quality,
  );
  return Buffer.from(encoded.data);
}

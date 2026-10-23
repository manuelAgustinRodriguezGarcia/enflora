import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "public/logos/enflora-favicon-source.png");

if (!fs.existsSync(sourcePath)) {
  throw new Error(`No está la fuente del favicon: ${sourcePath}`);
}

const origen = await sharp(sourcePath).metadata();
if (!origen.width || !origen.height || origen.width !== origen.height) {
  throw new Error(
    `La fuente debe ser cuadrada. Llegó ${origen.width}x${origen.height}.`
  );
}

async function raster(size) {
  return sharp(sourcePath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function pngSizes(buffers) {
  const meta = [];
  for (const buf of buffers) {
    const info = await sharp(buf).metadata();
    meta.push({ width: info.width, height: info.height });
  }
  return meta;
}

async function toIco(buffers) {
  const count = buffers.length;
  const headerSize = 6 + count * 16;
  const meta = await pngSizes(buffers);
  const fileSize = headerSize + buffers.reduce((n, b) => n + b.length, 0);
  const out = Buffer.alloc(fileSize);

  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);

  let o = 6;
  let dataOffset = headerSize;
  for (let i = 0; i < count; i++) {
    const { width, height } = meta[i];
    const buf = buffers[i];
    out.writeUInt8(width >= 256 ? 0 : width, o);
    out.writeUInt8(height >= 256 ? 0 : height, o + 1);
    out.writeUInt8(0, o + 2);
    out.writeUInt8(0, o + 3);
    out.writeUInt16LE(1, o + 4);
    out.writeUInt16LE(32, o + 6);
    out.writeUInt32LE(buf.length, o + 8);
    out.writeUInt32LE(dataOffset, o + 12);
    o += 16;
    dataOffset += buf.length;
  }

  let pos = headerSize;
  for (const buf of buffers) {
    buf.copy(out, pos);
    pos += buf.length;
  }
  return out;
}

const png16 = await raster(16);
const png32 = await raster(32);
const png48 = await raster(48);
const png96 = await raster(96);

const ico = await toIco([png16, png32, png48]);
fs.writeFileSync(path.join(root, "app/favicon.ico"), ico);
fs.writeFileSync(path.join(root, "app/icon.png"), png96);

for (const obsoleto of [
  "app/icon.svg",
  "public/favicon.svg",
  "public/favicon-48.png",
]) {
  const destino = path.join(root, obsoleto);
  if (fs.existsSync(destino)) fs.unlinkSync(destino);
}

console.log(
  JSON.stringify(
    {
      fuente: "public/logos/enflora-favicon-source.png",
      origen: { width: origen.width, height: origen.height, hasAlpha: origen.hasAlpha },
      icoBytes: ico.length,
      archivos: ["app/favicon.ico", "app/icon.png"],
      conservados: [
        "app/apple-icon.png",
        "public/icons/enflora-isotipo-192.png",
        "public/icons/enflora-isotipo-512.png",
        "public/icons/enflora-maskable-192.png",
        "public/icons/enflora-maskable-512.png",
      ],
    },
    null,
    2
  )
);

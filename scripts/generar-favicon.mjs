import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "public/logos/enflora-isotipo-light.svg");
const source = fs.readFileSync(sourcePath, "utf8");
const paths = [...source.matchAll(/<path class="cls-1" d="([^"]+)"\s*\/>/g)].map((m) => m[1]);

if (paths.length !== 3) {
  throw new Error(`Expected 3 paths, got ${paths.length}`);
}

const brandBg = "#0B3D2A";
const markFill = "#f4f8ef";
const mark = paths.map((d) => `  <path fill="${markFill}" d="${d}"/>`).join("\n");

const composed = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="ENFLORA">',
  `  <rect width="512" height="512" fill="${brandBg}"/>`,
  '  <g transform="translate(256 256) scale(0.86) translate(-256 -256)">',
  mark,
  "  </g>",
  "</svg>",
  "",
].join("\n");

fs.writeFileSync(path.join(root, "app/icon.svg"), composed);
fs.writeFileSync(path.join(root, "public/favicon.svg"), composed);

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

const svgBuf = Buffer.from(composed);
const png16 = await sharp(svgBuf).resize(16, 16).png().toBuffer();
const png32 = await sharp(svgBuf).resize(32, 32).png().toBuffer();
const png48 = await sharp(svgBuf).resize(48, 48).png().toBuffer();
const png180 = await sharp(svgBuf).resize(180, 180).png().toBuffer();
const png192 = await sharp(svgBuf).resize(192, 192).png().toBuffer();

fs.writeFileSync(path.join(root, "app/icon.png"), png48);
fs.writeFileSync(path.join(root, "app/apple-icon.png"), png180);
fs.writeFileSync(path.join(root, "public/favicon-48.png"), png48);

const ico = await toIco([png16, png32, png48]);
fs.writeFileSync(path.join(root, "app/favicon.ico"), ico);

console.log(
  JSON.stringify(
    {
      paths: paths.length,
      icoBytes: ico.length,
      files: [
        "app/icon.svg",
        "app/icon.png",
        "app/apple-icon.png",
        "app/favicon.ico",
        "public/favicon.svg",
        "public/favicon-48.png",
      ],
    },
    null,
    2
  )
);

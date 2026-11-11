import { relativePath } from '../src/fs.mjs';

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
const crc32 = bytes => {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
};

// Portable, deterministic ZIP (stored entries). No shell, external archiver or
// runtime dependency. Fixed DOS date 1980-01-01; UTF-8 paths; no ZIP64 output.
export function zipFiles(files) {
  if (!(files instanceof Map) || files.size > 65535) throw new Error('ZIP requires a file Map with at most 65535 entries');
  const local = [], central = [], seen = new Set(); let offset = 0;
  for (const [name, input] of [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (relativePath(name) !== name || name === '.' || seen.has(name.toLowerCase())) throw new Error(`Unsafe or duplicate ZIP path: ${name}`);
    seen.add(name.toLowerCase());
    const filename = Buffer.from(name), bytes = Buffer.from(input);
    if (filename.length > 65535 || bytes.length > 0xffffffff) throw new Error('ZIP64 is not supported');
    const crc = crc32(bytes), header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, bytes);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(0x314, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(0x21, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(bytes.length, 20); entry.writeUInt32LE(bytes.length, 24);
    entry.writeUInt16LE(filename.length, 28); entry.writeUInt32LE(0x81a40000, 38); entry.writeUInt32LE(offset, 42);
    central.push(entry, filename); offset += header.length + filename.length + bytes.length;
    if (offset > 0xffffffff) throw new Error('ZIP64 is not supported');
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  if (directory.length + offset > 0xffffffff) throw new Error('ZIP64 is not supported');
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

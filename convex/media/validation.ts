"use node";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { GifReader } from "omggif";
import { createFile, type MP4BoxBuffer } from "mp4box";
import { MIME_LIMITS } from "./limits";
export class MediaValidationError extends Error {}
function ensure(condition: unknown): asserts condition {
  if (!condition) throw new MediaValidationError("MEDIA_VALIDATION_FAILED");
}
function dimensions(width: number, height: number, max = 8_000_000) {
  ensure(
    Number.isSafeInteger(width) &&
      Number.isSafeInteger(height) &&
      width > 0 &&
      height > 0 &&
      width <= 4096 &&
      height <= 4096 &&
      width * height <= max,
  );
}
// omggif warns instead of rejecting truncated LZW. Validate its frame's compressed codes strictly first.
function gifFrame(
  bytes: Buffer,
  start: number,
  length: number,
  pixels: number,
  paletteSize: number,
) {
  const minimum = bytes[start];
  ensure(minimum >= 2 && minimum <= 8);
  const chunks: number[] = [];
  let p = start + 1;
  while (p < start + length) {
    const size = bytes[p++];
    if (!size) break;
    ensure(p + size <= bytes.length);
    for (let i = 0; i < size; i++) chunks.push(bytes[p++]);
  }
  ensure(p === start + length && bytes[p - 1] === 0);
  const clear = 1 << minimum,
    end = clear + 1;
  const sizes = new Uint32Array(4096);
  for (let i = 0; i < clear; i++) sizes[i] = 1;
  let width = minimum + 1,
    next = end + 1,
    previous = -1,
    bit = 0,
    count = 0,
    ended = false;
  while (bit + width <= chunks.length * 8) {
    let code = 0;
    for (let i = 0; i < width; i++)
      code |= ((chunks[(bit + i) >> 3] >> ((bit + i) & 7)) & 1) << i;
    bit += width;
    if (bit === width) ensure(code === clear);
    if (code < clear) ensure(code < paletteSize);
    if (code === clear) {
      width = minimum + 1;
      next = end + 1;
      previous = -1;
      continue;
    }
    if (code === end) {
      ended = true;
      break;
    }
    ensure(code < next || (code === next && previous >= 0));
    const size = code === next ? sizes[previous] + 1 : sizes[code];
    ensure(size > 0);
    count += size;
    ensure(count <= pixels);
    if (previous >= 0 && next < 4096) {
      sizes[next++] = sizes[previous] + 1;
      if (next === 1 << width && width < 12) width++;
    }
    previous = code;
  }
  ensure(ended && count === pixels);
}
function mp4(bytes: Buffer) {
  // Bound nested structure/table counts before MP4Box allocates sample lists.
  const mediaRanges: { start: number; end: number }[] = [];
  let boxes = 0;
  const containers = new Set([
    "moov",
    "trak",
    "mdia",
    "minf",
    "stbl",
    "edts",
    "dinf",
    "udta",
  ]);
  const leaves = new Set([
    "ftyp",
    "mdat",
    "free",
    "skip",
    "mvhd",
    "tkhd",
    "mdhd",
    "hdlr",
    "vmhd",
    "smhd",
    "dref",
    "stsd",
    "stts",
    "ctts",
    "stss",
    "stsc",
    "stsz",
    "stco",
    "co64",
    "elst",
    "sdtp",
    "avcC",
    "esds",
    "pasp",
    "btrt",
    "colr",
    "meta",
    "ilst",
    "keys",
  ]);
  function scan(start: number, end: number, depth = 0) {
    ensure(depth <= 8);
    let offset = start;
    while (offset < end) {
      ensure(end - offset >= 8 && ++boxes <= 10000);
      const n = bytes.readUInt32BE(offset),
        type = bytes.toString("ascii", offset + 4, offset + 8);
      let size = n,
        header = 8;
      if (n === 1) {
        ensure(end - offset >= 16);
        size = Number(bytes.readBigUInt64BE(offset + 8));
        header = 16;
      }
      if (n === 0) size = end - offset;
      ensure(
        Number.isSafeInteger(size) &&
          size >= header &&
          offset + size <= end &&
          (containers.has(type) || leaves.has(type)),
      );
      const p = offset + header,
        limit = offset + size;
      if (type === "mdat") {
        ensure(depth === 0);
        mediaRanges.push({ start: p, end: limit });
      }
      if (containers.has(type)) scan(p, limit, depth + 1);
      if (type === "meta") {
        ensure(p + 4 <= limit);
        scan(p + 4, limit, depth + 1);
      }
      if (type === "keys") {
        ensure(p + 8 <= limit);
        const count = bytes.readUInt32BE(p + 4);
        ensure(count <= 100);
        let q = p + 8;
        for (let i = 0; i < count; i++) {
          ensure(q + 4 <= limit);
          const length = bytes.readUInt32BE(q);
          ensure(length >= 8 && q + length <= limit);
          q += length;
        }
        ensure(q === limit);
      }
      if (type === "ilst") {
        let q = p,
          entries = 0;
        while (q < limit) {
          ensure(q + 16 <= limit && ++entries <= 100);
          const length = bytes.readUInt32BE(q);
          ensure(length >= 24 && q + length <= limit);
          const dataSize = bytes.readUInt32BE(q + 8);
          ensure(
            dataSize === length - 8 &&
              bytes.toString("ascii", q + 12, q + 16) === "data",
          );
          q += length;
        }
        ensure(q === limit);
      }
      if (
        [
          "stts",
          "ctts",
          "stss",
          "stsc",
          "stco",
          "co64",
          "elst",
          "dref",
          "stsd",
        ].includes(type)
      ) {
        ensure(p + 8 <= limit);
        const count = bytes.readUInt32BE(p + 4);
        ensure(count <= 20000);
        if (type === "stsd") {
          ensure(count <= 2);
          let entry = p + 8;
          for (let i = 0; i < count; i++) {
            ensure(entry + 8 <= limit);
            const size = bytes.readUInt32BE(entry),
              kind = bytes.toString("ascii", entry + 4, entry + 8);
            ensure(kind === "avc1" || kind === "mp4a");
            const fixed = kind === "avc1" ? 86 : 36;
            ensure(size >= fixed && entry + size <= limit);
            scan(entry + fixed, entry + size, depth + 1);
            entry += size;
          }
          ensure(entry === limit);
        } else if (type !== "dref") {
          const stride =
            type === "stsc"
              ? 12
              : type === "elst"
                ? bytes[p] === 1
                  ? 20
                  : 12
                : ["stts", "ctts", "co64"].includes(type)
                  ? 8
                  : 4;
          ensure(p + 8 + count * stride === limit);
          if (type === "stts" || type === "ctts") {
            let total = 0;
            for (let i = 0; i < count; i++)
              total += bytes.readUInt32BE(p + 8 + i * 8);
            ensure(total <= 20000);
          }
        } else ensure(count <= 4);
      }
      if (type === "stsz") {
        ensure(p + 12 <= limit);
        const size = bytes.readUInt32BE(p + 4),
          count = bytes.readUInt32BE(p + 8);
        ensure(count <= 20000 && (size !== 0 || p + 12 + count * 4 === limit));
      }
      offset += size;
    }
    ensure(offset === end);
  }
  scan(0, bytes.length);
  ensure(mediaRanges.length > 0);
  const file = createFile();
  let parseError = false;
  file.onError = () => {
    parseError = true;
  };
  const buffer = Uint8Array.from(bytes).buffer as MP4BoxBuffer;
  buffer.fileStart = 0;
  file.appendBuffer(buffer);
  file.flush();
  ensure(!parseError && !!file.moov);
  const info = file.getInfo();
  const video = info.videoTracks[0];
  ensure(
    !info.isFragmented &&
      info.videoTracks.length === 1 &&
      info.audioTracks.length <= 1 &&
      info.tracks.length === 1 + info.audioTracks.length,
  );
  ensure(
    video &&
      video.video &&
      /^avc1\./.test(video.codec) &&
      info.audioTracks.every((t) => t.codec === "mp4a.40.2"),
  );
  dimensions(video.video.width, video.video.height, 1920 * 1080);
  ensure(
    Math.max(video.video.width, video.video.height) <= 1920 &&
      Math.min(video.video.width, video.video.height) <= 1080,
  );
  const duration = video.duration / video.timescale;
  ensure(
    Number.isFinite(duration) &&
      duration >= 0.5 &&
      duration <= 140 &&
      video.nb_samples > 0 &&
      video.nb_samples / duration <= 60,
  );
  for (const track of info.tracks) {
    const samples = file.getTrackSamplesInfo(track.id);
    ensure(
      samples.length === track.nb_samples &&
        samples.length > 0 &&
        samples.length <= 20000,
    );
    for (const sample of samples) {
      ensure(
        sample.size > 0 &&
          sample.duration > 0 &&
          mediaRanges.some(
            (r) =>
              sample.offset >= r.start && sample.offset + sample.size <= r.end,
          ),
      );
      if (track.id === video.id) {
        const description = sample.description as typeof sample.description & {
          avcC?: {
            lengthSizeMinusOne: number;
            SPS: { nalu: Uint8Array }[];
            PPS: { nalu: Uint8Array }[];
          };
        };
        ensure(
          description.avcC?.lengthSizeMinusOne === 3 &&
            description.avcC.SPS.length > 0 &&
            description.avcC.PPS.length > 0,
        );
        let p = sample.offset;
        const end = p + sample.size;
        while (p < end) {
          ensure(p + 4 < end);
          const size = bytes.readUInt32BE(p);
          p += 4;
          ensure(
            size > 0 &&
              p + size <= end &&
              (bytes[p] & 128) === 0 &&
              (bytes[p] & 31) > 0 &&
              (bytes[p] & 31) < 24,
          );
          p += size;
        }
        ensure(p === end);
      }
    }
  }
  return { width: video.video.width, height: video.video.height, duration };
}
export function validateBytes(
  bytes: Buffer,
  expectedSize: number,
  expectedMime: string,
) {
  ensure(
    bytes.length === expectedSize &&
      bytes.length > 0 &&
      bytes.length <= (MIME_LIMITS[expectedMime] ?? 0),
  );
  let mime: string, width: number, height: number, duration: number | undefined;
  try {
    if (
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      // pngjs accepts replacement IHDR metadata and allocates palette/transparency
      // from chunk lengths. Validate every metadata-changing chunk before decoding.
      ensure(
        bytes.length >= 33 &&
          bytes.readUInt32BE(8) === 13 &&
          bytes.toString("ascii", 12, 16) === "IHDR",
      );
      dimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
      const depth = bytes[24],
        color = bytes[25];
      const depths: Record<number, number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      ensure(
        depths[color]?.includes(depth) &&
          bytes[26] === 0 &&
          bytes[27] === 0 &&
          bytes[28] === 0,
      );
      // Interlacing enters pngjs's unbounded inflate path; APNG is unsupported.
      let p = 8,
        paletteEntries = 0,
        dataSeen = false,
        dataEnded = false,
        endSeen = false;
      const metadata = new Set<string>();
      while (p < bytes.length) {
        ensure(p + 12 <= bytes.length);
        const length = bytes.readUInt32BE(p),
          type = bytes.toString("ascii", p + 4, p + 8);
        ensure(
          p + 12 + length <= bytes.length &&
            /^[A-Za-z]{4}$/.test(type) &&
            !["acTL", "fcTL", "fdAT"].includes(type),
        );
        if (type === "IHDR") ensure(p === 8 && length === 13);
        if (["PLTE", "tRNS", "gAMA"].includes(type)) {
          ensure(!dataSeen && !metadata.has(type));
          metadata.add(type);
          if (type === "PLTE") {
            ensure(
              color !== 0 &&
                color !== 4 &&
                length > 0 &&
                length <= 768 &&
                length % 3 === 0 &&
                !metadata.has("tRNS"),
            );
            paletteEntries = length / 3;
            if (color === 3) ensure(paletteEntries <= 2 ** depth);
          } else if (type === "tRNS") {
            ensure(
              (color === 0 && length === 2) ||
                (color === 2 && length === 6) ||
                (color === 3 && length > 0 && length <= paletteEntries),
            );
          } else ensure(length === 4 && !metadata.has("PLTE"));
        }
        if (type === "IDAT") {
          ensure(!dataEnded && (color !== 3 || paletteEntries > 0));
          dataSeen = true;
        } else if (dataSeen) dataEnded = true;
        if (type === "IEND") {
          ensure(dataSeen && length === 0 && p + 12 === bytes.length);
          endSeen = true;
        }
        p += 12 + length;
      }
      ensure(endSeen);
      const image = PNG.sync.read(bytes, { checkCRC: true });
      mime = "image/png";
      width = image.width;
      height = image.height;
    } else if (bytes[0] === 255 && bytes[1] === 216) {
      ensure(
        bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217,
      );
      const image = jpeg.decode(bytes, {
        useTArray: true,
        tolerantDecoding: false,
        maxResolutionInMP: 8,
        maxMemoryUsageInMB: 128,
      });
      mime = "image/jpeg";
      width = image.width;
      height = image.height;
    } else if (/^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) {
      ensure(bytes[bytes.length - 1] === 59);
      const gif = new GifReader(bytes);
      dimensions(gif.width, gif.height, 1_000_000);
      const frames = gif.numFrames();
      ensure(
        frames >= 1 &&
          frames <= 300 &&
          frames * gif.width * gif.height <= 30_000_000,
      );
      for (let i = 0; i < frames; i++) {
        const f = gif.frameInfo(i);
        ensure(
          f.width > 0 &&
            f.height > 0 &&
            f.x + f.width <= gif.width &&
            f.y + f.height <= gif.height &&
            f.data_offset + f.data_length <= bytes.length,
        );
        ensure(
          f.palette_offset !== null &&
            f.palette_size !== null &&
            f.palette_offset + f.palette_size * 3 <= bytes.length,
        );
        gifFrame(
          bytes,
          f.data_offset,
          f.data_length,
          f.width * f.height,
          f.palette_size,
        );
      }
      mime = "image/gif";
      width = gif.width;
      height = gif.height;
    } else if (bytes.toString("ascii", 4, 8) === "ftyp") {
      ({ width, height, duration } = mp4(bytes));
      mime = "video/mp4";
    } else throw new MediaValidationError("MEDIA_VALIDATION_FAILED");
  } catch {
    throw new MediaValidationError("MEDIA_VALIDATION_FAILED");
  }
  ensure(mime === expectedMime);
  dimensions(width, height);
  return {
    mime,
    type: mime === "video/mp4" ? ("video" as const) : ("image" as const),
    size: bytes.length,
    width,
    height,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    ...(duration === undefined ? {} : { duration }),
  };
}

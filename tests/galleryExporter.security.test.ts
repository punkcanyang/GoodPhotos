import assert from "node:assert/strict";

import {
  exportProofingGallery,
  GALLERY_RUNTIME_JS,
  parseGalleryImageDataUrl,
  type ProofingGalleryWriter,
} from "../src/utils/galleryExporter";
import type { ImageEvaluationResult, ProcessedImage } from "../src/types";

const maliciousFilename = `portrait"><img src=x onerror="globalThis.pwned=true">.jpg`;
const maliciousReasoning = `</script><script>globalThis.pwned=true</script> “繁體字” 😀`;
const image: ProcessedImage = {
  id: "unsafe-id/../../escape",
  originalFilePath: `/tmp/${maliciousFilename}`,
  filename: maliciousFilename,
  compressedBase64: "data:image/jpeg;base64,aW1hZ2U=",
  status: "DONE",
};
const evaluation: ImageEvaluationResult = {
  imageId: image.id,
  score: 88,
  reasoning: maliciousReasoning,
  isRecommended: true,
};

const binaryFiles = new Map<string, Uint8Array>();
const textFiles = new Map<string, string>();
const directories: string[] = [];
const writer: ProofingGalleryWriter = {
  async createDirectory(path) {
    directories.push(path);
  },
  async writeBinary(path, content) {
    binaryFiles.set(path, content);
  },
  async writeText(path, content) {
    textFiles.set(path, content);
  },
};

const count = await exportProofingGallery(
  [image.id],
  { [image.id]: image },
  { [image.id]: evaluation },
  "/safe-output",
  writer,
);

assert.equal(count, 1);
assert.deepEqual(directories, ["/safe-output/images"]);
assert.deepEqual([...binaryFiles.keys()], ["/safe-output/images/image-1.jpg"]);

const html = textFiles.get("/safe-output/index.html");
const runtime = textFiles.get("/safe-output/gallery.js");
assert.ok(html);
assert.equal(runtime, GALLERY_RUNTIME_JS);

assert.match(html, /Content-Security-Policy/);
assert.match(html, /script-src 'self'/);
assert.match(html, /object-src 'none'/);
assert.match(html, /<script src="gallery\.js" defer><\/script>/);
assert.equal(html.includes(maliciousFilename), false);
assert.equal(html.includes(maliciousReasoning), false);
assert.equal(html.includes("innerHTML"), false);
assert.equal(runtime.includes("innerHTML"), false);
assert.equal(runtime.includes("textContent"), true);
assert.doesNotThrow(() => new Function(runtime));

const payloadMatch = html.match(/data-payload="([A-Za-z0-9+/=]+)"/);
assert.ok(payloadMatch);
const decoded = JSON.parse(
  new TextDecoder().decode(
    Uint8Array.from(atob(payloadMatch[1]), character => character.charCodeAt(0)),
  ),
);
assert.equal(decoded[0].filename, maliciousFilename);
assert.equal(decoded[0].reasoning, maliciousReasoning);
assert.equal(decoded[0].src, "images/image-1.jpg");

assert.deepEqual(parseGalleryImageDataUrl("data:image/png;base64,aW1hZ2U="), {
  extension: "png",
  encoded: "aW1hZ2U=",
});
assert.equal(
  parseGalleryImageDataUrl("data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+"),
  null,
);
assert.equal(parseGalleryImageDataUrl("javascript:alert(1)"), null);

console.log("gallery exporter security tests passed");

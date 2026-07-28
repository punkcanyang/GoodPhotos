#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const [
  metadataPath,
  signaturePath,
  archivePath,
  expectedTag,
  expectedRepository,
] = process.argv.slice(2);
if (
  !metadataPath
  || !signaturePath
  || !archivePath
  || !expectedTag
  || !expectedRepository
) {
  console.error(
    "Usage: verify-release-metadata.mjs <latest.json> <signature> <archive> <expected-tag> <owner/repo>",
  );
  process.exit(2);
}

const expectedVersion = expectedTag.replace(/^v/, "");
const [metadataText, signature] = await Promise.all([
  readFile(metadataPath, "utf8"),
  readFile(signaturePath, "utf8"),
]);
const metadata = JSON.parse(metadataText);

if (metadata.version !== expectedVersion) {
  throw new Error(`latest.json version ${metadata.version} does not match ${expectedVersion}.`);
}

const expectedArchiveName = path.basename(archivePath);
const platforms = ["darwin-aarch64", "darwin-aarch64-app"];
for (const platformName of platforms) {
  const platform = metadata.platforms?.[platformName];
  if (!platform) {
    throw new Error(`latest.json is missing ${platformName}.`);
  }
  if (platform.signature.trim() !== signature.trim()) {
    throw new Error(`latest.json signature does not match ${path.basename(signaturePath)}.`);
  }

  const downloadUrl = new URL(platform.url);
  const expectedPath = `/${expectedRepository}/releases/download/${expectedTag}/${expectedArchiveName}`;
  if (
    downloadUrl.protocol !== "https:"
    || downloadUrl.hostname !== "github.com"
    || downloadUrl.pathname !== expectedPath
  ) {
    throw new Error(`${platformName} has an unexpected updater URL: ${platform.url}`);
  }
}

console.log("Updater metadata matches the tag, archive URL, and detached signature.");

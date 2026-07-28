#!/usr/bin/env node

import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const decodeTauriMinisignText = (encoded) => (
  Buffer.from(encoded.trim(), "base64").toString("utf8")
);

const readPacket = (text, lineIndex, label) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length <= lineIndex) {
    throw new Error(`${label} is missing its Minisign packet.`);
  }
  return Buffer.from(lines[lineIndex], "base64");
};

export async function verifyUpdaterSignature(archivePath, signaturePath, publicKeyPath) {
  const [archive, encodedSignature, encodedPublicKey] = await Promise.all([
    readFile(archivePath),
    readFile(signaturePath, "utf8"),
    readFile(publicKeyPath, "utf8"),
  ]);

  const publicKeyPacket = readPacket(
    decodeTauriMinisignText(encodedPublicKey),
    1,
    "Updater public key",
  );
  const signaturePacket = readPacket(
    decodeTauriMinisignText(encodedSignature),
    1,
    "Updater signature",
  );

  if (publicKeyPacket.length !== 42 || publicKeyPacket.subarray(0, 2).toString() !== "Ed") {
    throw new Error("Updater public key has an unsupported Minisign packet.");
  }
  if (signaturePacket.length !== 74) {
    throw new Error("Updater signature has an invalid Minisign packet length.");
  }
  if (!publicKeyPacket.subarray(2, 10).equals(signaturePacket.subarray(2, 10))) {
    throw new Error("Updater signature key ID does not match the embedded public key.");
  }

  const algorithm = signaturePacket.subarray(0, 2).toString();
  const payload = algorithm === "ED"
    ? createHash("blake2b512").update(archive).digest()
    : algorithm === "Ed"
      ? archive
      : null;
  if (!payload) {
    throw new Error(`Unsupported Minisign signature algorithm: ${algorithm}`);
  }

  const rawPublicKey = publicKeyPacket.subarray(10);
  const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  const publicKey = createPublicKey({
    key: Buffer.concat([spkiPrefix, rawPublicKey]),
    format: "der",
    type: "spki",
  });

  if (!verifySignature(null, payload, publicKey, signaturePacket.subarray(10))) {
    throw new Error("Updater archive signature verification failed.");
  }
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  const [archivePath, signaturePath, publicKeyPath] = process.argv.slice(2);
  if (!archivePath || !signaturePath || !publicKeyPath) {
    console.error("Usage: verify-updater-signature.mjs <archive> <signature> <public-key>");
    process.exit(2);
  }

  verifyUpdaterSignature(archivePath, signaturePath, publicKeyPath)
    .then(() => console.log("Updater archive signature is valid."))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}

import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { verifyUpdaterSignature } from "../scripts/release/verify-updater-signature.mjs";

const wrapForTauri = (minisignText: string) => (
  Buffer.from(minisignText).toString("base64")
);

async function createSignedFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "goodphotos-release-integrity-"));
  const archivePath = path.join(directory, "GoodPhotos_aarch64.app.tar.gz");
  const signaturePath = `${archivePath}.sig`;
  const publicKeyPath = path.join(directory, "updater.pubkey");
  const archive = Buffer.from("signed updater fixture");
  const keyId = randomBytes(8);
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const rawPublicKey = publicKeyDer.subarray(-32);
  const digest = createHash("blake2b512").update(archive).digest();
  const detachedSignature = sign(null, digest, privateKey);

  const publicKeyPacket = Buffer.concat([Buffer.from("Ed"), keyId, rawPublicKey]);
  const signaturePacket = Buffer.concat([Buffer.from("ED"), keyId, detachedSignature]);

  await Promise.all([
    writeFile(archivePath, archive),
    writeFile(
      publicKeyPath,
      wrapForTauri(
        `untrusted comment: minisign public key\n${publicKeyPacket.toString("base64")}\n`,
      ),
    ),
    writeFile(
      signaturePath,
      wrapForTauri(
        `untrusted comment: signature\n${signaturePacket.toString("base64")}\n`,
      ),
    ),
  ]);

  return { archivePath, signaturePath, publicKeyPath };
}

async function testValidUpdaterSignature() {
  const fixture = await createSignedFixture();
  await verifyUpdaterSignature(
    fixture.archivePath,
    fixture.signaturePath,
    fixture.publicKeyPath,
  );
}

async function testTamperedUpdaterIsRejected() {
  const fixture = await createSignedFixture();
  await writeFile(fixture.archivePath, "tampered updater fixture");

  await assert.rejects(
    () => verifyUpdaterSignature(
      fixture.archivePath,
      fixture.signaturePath,
      fixture.publicKeyPath,
    ),
    /signature verification failed/,
  );
}

await testValidUpdaterSignature();
await testTamperedUpdaterIsRejected();
console.log("release integrity tests passed");

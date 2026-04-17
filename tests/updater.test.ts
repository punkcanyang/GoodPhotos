import assert from "node:assert/strict";

import {
  applyDownloadedUpdate,
  createIdleUpdaterState,
  getUpdateStatusKey,
  runBackgroundUpdateCheck,
  type ManagedUpdate,
  type UpdaterState,
} from "../src/utils/updater";

function collectStates() {
  const states: UpdaterState[] = [];

  return {
    states,
    emit: (state: UpdaterState) => {
      states.push(state);
    },
  };
}

async function testNoUpdateReturnsToIdle(): Promise<void> {
  const { states, emit } = collectStates();

  const update = await runBackgroundUpdateCheck(async () => null, emit);

  assert.equal(update, null);
  assert.deepEqual(states, [{ phase: "checking" }, createIdleUpdaterState()]);
}

async function testBackgroundDownloadEndsReady(): Promise<void> {
  const { states, emit } = collectStates();

  const update: ManagedUpdate = {
    version: "0.1.1",
    currentVersion: "0.1.0",
    body: "Background updater smoke test",
    async download(onEvent) {
      onEvent?.({ event: "Started", data: { contentLength: 10 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 4 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 6 } });
      onEvent?.({ event: "Finished" });
    },
    async install() {
      throw new Error("install should not run during background download");
    },
  };

  const pendingUpdate = await runBackgroundUpdateCheck(async () => update, emit);

  assert.equal(pendingUpdate, update);
  assert.equal(states[0].phase, "checking");
  assert.equal(states[1].phase, "available");
  assert.equal(states[2].phase, "downloading");
  assert.equal(states.at(-1)?.phase, "ready");
  assert.equal(states.at(-1)?.downloadedBytes, 10);
  assert.equal(states.at(-1)?.contentLength, 10);
  assert.equal(getUpdateStatusKey(states.at(-1)!), "updater.ready");
}

async function testInstallTriggersRelaunch(): Promise<void> {
  const { states, emit } = collectStates();
  const calls: string[] = [];

  const update: ManagedUpdate = {
    version: "0.1.1",
    currentVersion: "0.1.0",
    body: "Install smoke test",
    async download() {
      calls.push("download");
    },
    async install() {
      calls.push("install");
    },
  };

  await applyDownloadedUpdate(
    update,
    async () => {
      calls.push("relaunch");
    },
    emit,
  );

  assert.deepEqual(calls, ["install", "relaunch"]);
  assert.deepEqual(states.map((state) => state.phase), ["installing", "restarting"]);
}

async function main(): Promise<void> {
  await testNoUpdateReturnsToIdle();
  await testBackgroundDownloadEndsReady();
  await testInstallTriggersRelaunch();
  console.log("updater tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export type UpdaterPhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "restarting"
  | "error";

export interface UpdaterState {
  phase: UpdaterPhase;
  version?: string;
  currentVersion?: string;
  notes?: string;
  downloadedBytes?: number;
  contentLength?: number;
  error?: string;
}

export type UpdateDownloadEvent =
  | {
      event: "Started";
      data: {
        contentLength?: number;
      };
    }
  | {
      event: "Progress";
      data: {
        chunkLength: number;
      };
    }
  | {
      event: "Finished";
    };

export interface ManagedUpdate {
  version: string;
  currentVersion?: string;
  body?: string;
  download(onEvent?: (event: UpdateDownloadEvent) => void): Promise<void>;
  install(): Promise<void>;
}

function toMetadata(update: Pick<ManagedUpdate, "version" | "currentVersion" | "body">) {
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body,
  };
}

export function createIdleUpdaterState(): UpdaterState {
  return { phase: "idle" };
}

export function getUpdateStatusKey(state: UpdaterState): string | null {
  switch (state.phase) {
    case "checking":
      return "updater.checking";
    case "downloading":
      return "updater.downloading";
    case "ready":
      return "updater.ready";
    case "error":
      return "updater.error";
    default:
      return null;
  }
}

export function describeUpdaterError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "Unknown updater error";
}

export async function runBackgroundUpdateCheck(
  checkForUpdate: () => Promise<ManagedUpdate | null>,
  emit: (state: UpdaterState) => void,
): Promise<ManagedUpdate | null> {
  emit({ phase: "checking" });

  try {
    const update = await checkForUpdate();

    if (!update) {
      emit(createIdleUpdaterState());
      return null;
    }

    const metadata = toMetadata(update);
    emit({ phase: "available", ...metadata });

    let downloadedBytes = 0;
    let contentLength: number | undefined;

    await update.download((event) => {
      if (event.event === "Started") {
        contentLength = event.data.contentLength;
        emit({
          phase: "downloading",
          ...metadata,
          downloadedBytes,
          contentLength,
        });
        return;
      }

      if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        emit({
          phase: "downloading",
          ...metadata,
          downloadedBytes,
          contentLength,
        });
        return;
      }

      emit({
        phase: "ready",
        ...metadata,
        downloadedBytes,
        contentLength,
      });
    });

    if (downloadedBytes === 0 && contentLength === undefined) {
      emit({ phase: "ready", ...metadata });
    }

    return update;
  } catch (error) {
    emit({
      phase: "error",
      error: describeUpdaterError(error),
    });
    return null;
  }
}

export async function applyDownloadedUpdate(
  update: ManagedUpdate,
  relaunchApp: () => Promise<void>,
  emit: (state: UpdaterState) => void,
): Promise<void> {
  const metadata = toMetadata(update);

  try {
    emit({ phase: "installing", ...metadata });
    await update.install();
    emit({ phase: "restarting", ...metadata });
    await relaunchApp();
  } catch (error) {
    emit({
      phase: "error",
      ...metadata,
      error: describeUpdaterError(error),
    });
    throw error;
  }
}

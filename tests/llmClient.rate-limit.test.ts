import assert from "node:assert/strict";

import { evaluateImages } from "../src/utils/llmClient";
import type { AestheticCriteria, LlmConfig, ProcessedImage } from "../src/types";

const criteria: AestheticCriteria = {
  theme: "test-theme",
  compositionRules: ["rule-1"],
  lightingAndColor: ["light-1"],
  negativeConstraints: ["bad-1"],
};

const config: LlmConfig = {
  activeProvider: "openai",
  providers: {
    openai: {
      apiKey: "test-key",
      baseUrl: "https://example.com/v1/chat/completions",
      model: "gpt-4o",
    },
    qwen: {
      apiKey: "",
      baseUrl: "",
      model: "qwen-vl-max",
    },
    gemini: {
      apiKey: "",
      baseUrl: "",
      model: "gemini-1.5-pro",
    },
    openrouter: {
      apiKey: "",
      baseUrl: "",
      model: "openai/gpt-4.1-mini",
    },
    siliconflow: {
      apiKey: "",
      baseUrl: "",
      model: "Qwen/Qwen2.5-VL-72B-Instruct",
    },
    together: {
      apiKey: "",
      baseUrl: "",
      model: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
    },
    groq: {
      apiKey: "",
      baseUrl: "",
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
    },
    stability: {
      apiKey: "",
      baseUrl: "",
      model: "stable-image-edit",
    },
  },
};

function makeImages(count: number): ProcessedImage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `img-${index + 1}`,
    originalFilePath: `/tmp/img-${index + 1}.jpg`,
    filename: `img-${index + 1}.jpg`,
    compressedBase64: "data:image/jpeg;base64,AAAA",
    status: "DONE",
  }));
}

function extractBatchIds(body: string): string[] {
  const payload = JSON.parse(body);
  const prompt = payload.messages[1].content[0].text as string;
  const match = prompt.match(/ID 分别为：(.+?)。\n请/);
  assert.ok(match, "failed to extract image ids from prompt");
  return match[1].split(", ").map((item: string) => item.trim());
}

function makeSuccessResponse(ids: string[], headers: Record<string, string>): Response {
  const results = ids.map((id) => ({
    imageId: id,
    score: 80,
    reasoning: "ok",
    isRecommended: true,
  }));

  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify(results),
          },
        },
      ],
    }),
    {
      status: 200,
      headers,
    },
  );
}

async function withPatchedTimeouts<T>(run: (recordedDelays: number[]) => Promise<T>): Promise<T> {
  const recordedDelays: number[] = [];
  const originalSetTimeout = globalThis.setTimeout;

  (globalThis as typeof globalThis & {
    setTimeout: typeof globalThis.setTimeout;
  }).setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    recordedDelays.push(Number(delay ?? 0));
    if (typeof callback === "function") {
      callback(...args);
    }
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  try {
    return await run(recordedDelays);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
}

async function testOpenAiBatchesAreSerialAndPaced(): Promise<void> {
  const images = makeImages(16);
  const batchSizes: number[] = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

    const ids = extractBatchIds(String(init?.body ?? ""));
    batchSizes.push(ids.length);

    return await new Promise<Response>((resolve) => {
      queueMicrotask(() => {
        activeRequests -= 1;
        resolve(
          makeSuccessResponse(ids, {
            "x-ratelimit-remaining-tokens": "20000",
            "x-ratelimit-reset-tokens": "1s",
          }),
        );
      });
    });
  }) as typeof fetch;

  try {
    await withPatchedTimeouts(async (recordedDelays) => {
      const results = await evaluateImages(criteria, images, config, "zh");
      assert.equal(results.length, 16);
      assert.deepEqual(batchSizes, [5, 5, 5, 1]);
      assert.equal(maxActiveRequests, 1);
      assert.deepEqual(recordedDelays, [3000, 3000, 3000]);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testOpenAiBackoffAndLowTokenWait(): Promise<void> {
  const images = makeImages(6);
  const originalFetch = globalThis.fetch;
  let requestIndex = 0;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestIndex += 1;
    const ids = extractBatchIds(String(init?.body ?? ""));

    if (requestIndex === 1) {
      return makeSuccessResponse(ids, {
        "x-ratelimit-remaining-tokens": "4000",
        "x-ratelimit-reset-tokens": "5s",
      });
    }

    if (requestIndex === 2) {
      return new Response(
        JSON.stringify({
          error: {
            message:
              "Rate limit reached for gpt-4o. Please try again in 1.5s.",
            code: "rate_limit_exceeded",
          },
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (requestIndex === 3) {
      return makeSuccessResponse(ids, {
        "x-ratelimit-remaining-tokens": "12000",
        "x-ratelimit-reset-tokens": "1s",
      });
    }

    throw new Error(`unexpected request index ${requestIndex}`);
  }) as typeof fetch;

  try {
    await withPatchedTimeouts(async (recordedDelays) => {
      const results = await evaluateImages(criteria, images, config, "zh");
      assert.equal(results.length, 6);
      assert.deepEqual(recordedDelays, [5000, 1500]);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main(): Promise<void> {
  await testOpenAiBatchesAreSerialAndPaced();
  await testOpenAiBackoffAndLowTokenWait();
  console.log("llmClient rate-limit tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

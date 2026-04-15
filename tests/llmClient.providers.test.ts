import assert from "node:assert/strict";

import { manifestAestheticIntent } from "../src/utils/llmClient";
import type { LlmConfig } from "../src/types";

const providerCases = [
  {
    provider: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
  },
  {
    provider: "siliconflow",
    url: "https://api.siliconflow.com/v1/chat/completions",
  },
  {
    provider: "together",
    url: "https://api.together.xyz/v1/chat/completions",
  },
  {
    provider: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
  },
] as const;

function makeConfig(provider: (typeof providerCases)[number]["provider"]): LlmConfig {
  return {
    activeProvider: provider as LlmConfig["activeProvider"],
    providers: {
      qwen: {
        apiKey: "",
        baseUrl: "",
        model: "qwen-vl-max",
      },
      openai: {
        apiKey: "",
        baseUrl: "",
        model: "gpt-4o",
      },
      gemini: {
        apiKey: "",
        baseUrl: "",
        model: "gemini-1.5-pro",
      },
      openrouter: {
        apiKey: "test-key",
        baseUrl: "",
        model: "openai/gpt-4.1-mini",
      },
      siliconflow: {
        apiKey: "test-key",
        baseUrl: "",
        model: "Qwen/Qwen2.5-VL-72B-Instruct",
      },
      together: {
        apiKey: "test-key",
        baseUrl: "",
        model: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
      },
      groq: {
        apiKey: "test-key",
        baseUrl: "",
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
      },
      stability: {
        apiKey: "",
        baseUrl: "",
        model: "erase",
      },
    },
  } as unknown as LlmConfig;
}

async function testCompatibleProvidersUseDefaultUrls(): Promise<void> {
  const originalFetch = globalThis.fetch;

  try {
    for (const providerCase of providerCases) {
      let calledUrl = "";
      let payload: Record<string, unknown> | null = null;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calledUrl = String(input);
        payload = JSON.parse(String(init?.body ?? "{}"));

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    theme: "Clean",
                    compositionRules: ["rule-1"],
                    lightingAndColor: ["light-1"],
                    negativeConstraints: ["bad-1"],
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }) as typeof fetch;

      const criteria = await manifestAestheticIntent(
        "find good photos",
        makeConfig(providerCase.provider),
        "en",
      );

      assert.equal(calledUrl, providerCase.url, `${providerCase.provider} should use the expected default URL`);
      assert.deepEqual(payload?.response_format, { type: "json_object" }, `${providerCase.provider} should request JSON object output`);
      assert.equal(criteria.theme, "Clean");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main(): Promise<void> {
  await testCompatibleProvidersUseDefaultUrls();
  console.log("llmClient provider tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

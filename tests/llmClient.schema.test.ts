import assert from "node:assert/strict";

import { evaluateImages } from "../src/utils/llmClient";
import {
  EvaluationContractError,
  parseEvaluationBatchContent,
  RetryableEvaluationBatchError,
} from "../src/utils/llmSchemas";
import type { AestheticCriteria, LlmConfig, ProcessedImage } from "../src/types";

const criteria: AestheticCriteria = {
  theme: "test",
  subject: [],
  background: [],
  lighting: [],
  colorScheme: [],
  artisticStyle: [],
  compositionRules: [],
  negativeConstraints: [],
};

const config = {
  activeProvider: "qwen",
  providers: {
    qwen: {
      hasCredential: true,
      baseUrl: "https://example.com/v1/chat/completions",
      model: "qwen-vl-max",
    },
  },
} as unknown as LlmConfig;

const images: ProcessedImage[] = [
  {
    id: "img-1",
    originalFilePath: "/tmp/img-1.jpg",
    filename: "img-1.jpg",
    compressedBase64: "data:image/jpeg;base64,AAAA",
    status: "DONE",
  },
  {
    id: "img-2",
    originalFilePath: "/tmp/img-2.jpg",
    filename: "img-2.jpg",
    compressedBase64: "data:image/jpeg;base64,BBBB",
    status: "DONE",
  },
];

const result = (
  imageId: string,
  score: unknown = 80,
  overrides: Record<string, unknown> = {},
) => ({
  imageId,
  score,
  reasoning: "valid",
  isRecommended: true,
  ...overrides,
});

function testValidSchemaAndBoundaries() {
  const parsed = parseEvaluationBatchContent(
    `\`\`\`json
${JSON.stringify([result("img-2", 100), result("img-1", 0)])}
\`\`\``,
    ["img-1", "img-2"],
  );

  assert.deepEqual(parsed.map(item => item.imageId), ["img-1", "img-2"]);
  assert.deepEqual(parsed.map(item => item.score), [0, 100]);
}

function testInvalidContracts() {
  const invalidCases: Array<[string, string, string[]]> = [
    ["malformed JSON", "[", ["img-1"]],
    ["NaN", '[{"imageId":"img-1","score":NaN}]', ["img-1"]],
    [
      "duplicate ID",
      JSON.stringify([result("img-1"), result("img-1")]),
      ["img-1", "img-2"],
    ],
    ["unknown ID", JSON.stringify([result("unknown")]), ["img-1"]],
    ["missing image", JSON.stringify([result("img-1")]), ["img-1", "img-2"]],
    [
      "extra image",
      JSON.stringify([result("img-1"), result("img-2")]),
      ["img-1"],
    ],
    ["score below range", JSON.stringify([result("img-1", -1)]), ["img-1"]],
    ["score above range", JSON.stringify([result("img-1", 101)]), ["img-1"]],
    ["non-integer score", JSON.stringify([result("img-1", 50.5)]), ["img-1"]],
    ["wrong field type", JSON.stringify([result("img-1", "80")]), ["img-1"]],
  ];

  for (const [label, content, expectedIds] of invalidCases) {
    assert.throws(
      () => parseEvaluationBatchContent(content, expectedIds),
      EvaluationContractError,
      label,
    );
  }
}

function responseWithContent(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function testOneRepairAttemptSucceeds() {
  const originalFetch = globalThis.fetch;
  const requestPrompts: string[] = [];

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    requestPrompts.push(payload.messages[1].content[0].text);

    if (requestPrompts.length === 1) {
      return responseWithContent(JSON.stringify([result("img-1")]));
    }

    return responseWithContent(JSON.stringify([
      result("img-1"),
      result("img-2"),
    ]));
  }) as typeof fetch;

  try {
    const parsed = await evaluateImages(criteria, images, config, "zh");
    assert.equal(requestPrompts.length, 2);
    assert.match(requestPrompts[1], /唯一一次結構修復機會/);
    assert.deepEqual(parsed.map(item => item.imageId), ["img-1", "img-2"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testPersistentFailureIsRetryable() {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  let requestCount = 0;

  globalThis.fetch = (async () => {
    requestCount += 1;
    return responseWithContent("[");
  }) as typeof fetch;
  console.error = () => {};

  try {
    await assert.rejects(
      () => evaluateImages(criteria, images, config, "zh"),
      (error: unknown) => {
        assert.ok(error instanceof RetryableEvaluationBatchError);
        assert.equal(error.retryable, true);
        assert.deepEqual(error.batchIds, ["img-1", "img-2"]);
        return true;
      },
    );
    assert.equal(requestCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
}

async function main() {
  testValidSchemaAndBoundaries();
  testInvalidContracts();
  await testOneRepairAttemptSucceeds();
  await testPersistentFailureIsRetryable();
  console.log("llmClient schema tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

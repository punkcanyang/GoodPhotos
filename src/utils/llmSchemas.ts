import type { AestheticCriteria, ImageEvaluationResult } from "../types";

const stripMarkdownCodeFence = (content: string): string => {
    const trimmed = content.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
};

const parseJsonContent = (content: string, label: string): unknown => {
    try {
        return JSON.parse(stripMarkdownCodeFence(content));
    } catch {
        throw new Error(`${label} is not valid JSON.`);
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === "object" && value !== null && !Array.isArray(value)
);

const isStringArray = (value: unknown): value is string[] => (
    Array.isArray(value) && value.every(item => typeof item === "string")
);

export const parseAestheticCriteriaContent = (content: string): AestheticCriteria => {
    const value = parseJsonContent(content, "Aesthetic criteria response");
    if (!isRecord(value)) {
        throw new Error("Aesthetic criteria response must be a JSON object.");
    }

    const arrayFields = [
        "subject",
        "background",
        "lighting",
        "colorScheme",
        "artisticStyle",
        "compositionRules",
        "negativeConstraints",
    ] as const;

    if (typeof value.theme !== "string" || value.theme.trim().length === 0) {
        throw new Error("Aesthetic criteria field theme must be a non-empty string.");
    }

    for (const field of arrayFields) {
        if (!isStringArray(value[field])) {
            throw new Error(`Aesthetic criteria field ${field} must be an array of strings.`);
        }
    }

    return {
        theme: value.theme,
        subject: value.subject as string[],
        background: value.background as string[],
        lighting: value.lighting as string[],
        colorScheme: value.colorScheme as string[],
        artisticStyle: value.artisticStyle as string[],
        compositionRules: value.compositionRules as string[],
        negativeConstraints: value.negativeConstraints as string[],
    };
};

export class EvaluationContractError extends Error {
    readonly issues: string[];

    constructor(issues: string[]) {
        super(`Evaluation response contract failed: ${issues.join("; ")}`);
        this.name = "EvaluationContractError";
        this.issues = issues;
    }
}

export class RetryableEvaluationBatchError extends Error {
    readonly batchIds: string[];
    readonly retryable = true;

    constructor(batchIds: string[], detail: string) {
        super(`The model returned an invalid result batch after one repair attempt. Retry this batch. ${detail}`);
        this.name = "RetryableEvaluationBatchError";
        this.batchIds = [...batchIds];
    }
}

const validateExtractedData = (
    value: unknown,
    index: number,
    issues: string[],
): Record<string, string> | undefined => {
    if (value === undefined) return undefined;
    if (!isRecord(value) || Object.values(value).some(item => typeof item !== "string")) {
        issues.push(`result[${index}].extractedData must be an object with string values`);
        return undefined;
    }
    return value as Record<string, string>;
};

export const parseEvaluationBatchContent = (
    content: string,
    expectedIds: string[],
): ImageEvaluationResult[] => {
    let value: unknown;
    try {
        value = parseJsonContent(content, "Evaluation response");
    } catch (error) {
        throw new EvaluationContractError([
            error instanceof Error ? error.message : "response is not valid JSON",
        ]);
    }
    if (!Array.isArray(value)) {
        throw new EvaluationContractError(["response must be a JSON array"]);
    }

    const issues: string[] = [];
    const resultsById = new Map<string, ImageEvaluationResult>();
    const expectedIdSet = new Set(expectedIds);

    if (expectedIdSet.size !== expectedIds.length) {
        throw new EvaluationContractError(["input batch contains duplicate image IDs"]);
    }

    value.forEach((item, index) => {
        if (!isRecord(item)) {
            issues.push(`result[${index}] must be an object`);
            return;
        }

        const imageId = item.imageId;
        const score = item.score;
        const reasoning = item.reasoning;
        const isRecommended = item.isRecommended;
        const extractedData = validateExtractedData(item.extractedData, index, issues);

        if (typeof imageId !== "string" || imageId.length === 0) {
            issues.push(`result[${index}].imageId must be a non-empty string`);
        }
        if (
            typeof score !== "number"
            || !Number.isFinite(score)
            || !Number.isInteger(score)
            || score < 0
            || score > 100
        ) {
            issues.push(`result[${index}].score must be an integer from 0 to 100`);
        }
        if (typeof reasoning !== "string" || reasoning.trim().length === 0) {
            issues.push(`result[${index}].reasoning must be a non-empty string`);
        }
        if (typeof isRecommended !== "boolean") {
            issues.push(`result[${index}].isRecommended must be a boolean`);
        }

        if (typeof imageId !== "string" || imageId.length === 0) return;
        if (!expectedIdSet.has(imageId)) {
            issues.push(`result[${index}] contains unknown imageId ${imageId}`);
            return;
        }
        if (resultsById.has(imageId)) {
            issues.push(`imageId ${imageId} is duplicated`);
            return;
        }

        if (
            typeof score !== "number"
            || !Number.isFinite(score)
            || !Number.isInteger(score)
            || score < 0
            || score > 100
            || typeof reasoning !== "string"
            || reasoning.trim().length === 0
            || typeof isRecommended !== "boolean"
        ) {
            return;
        }

        resultsById.set(imageId, {
            imageId,
            score,
            reasoning,
            isRecommended,
            ...(extractedData ? { extractedData } : {}),
        });
    });

    for (const expectedId of expectedIds) {
        if (!resultsById.has(expectedId)) {
            issues.push(`imageId ${expectedId} is missing`);
        }
    }

    if (value.length !== expectedIds.length) {
        issues.push(`expected ${expectedIds.length} results but received ${value.length}`);
    }

    if (issues.length > 0) {
        throw new EvaluationContractError(issues);
    }

    return expectedIds.map(imageId => resultsById.get(imageId)!);
};

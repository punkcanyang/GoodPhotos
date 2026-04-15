/**
 * __ai_context__:
 * This module is responsible for bridging our domain-specific UI with various Vision Language Models (Qwen, OpenAI, Gemini).
 * It enforces rigid schema adherence for prompts and responses across vastly different API designs.
 */

import { AestheticCriteria, ImageEvaluationResult, ProcessedImage, LlmConfig, AestheticProfile } from "../types";
import {
    getProviderOption,
    isGeminiProvider,
    isOpenAiCompatibleProvider,
    usesOpenAiRateLimitStrategy,
    usesSmallBatchWindow
} from "../llmProviders";

const DEFAULT_CHUNK_SIZE = 15;
const OPENAI_CHUNK_SIZE = 5;
const INTER_BATCH_DELAY_MS = 3000;
const OPENAI_LOW_TOKEN_THRESHOLD = 5000;
const MAX_OPENAI_429_RETRIES = 5;

export const DEFAULT_PROFILES: AestheticProfile[] = [
    {
        id: "default_documentary",
        name: "👑 默认: 顶级画廊纪实 (Magnum/Vogue)",
        description: "高阈值、强叙事感。适合故事性强、光影结构复杂的场景筛选。",
        systemPrompt: "你是一个世界顶级的视觉艺术指导和胶片冲洗大师。",
        evaluationStandard: "• Magnum Photos 的纪实审美\n• Vogue 的视觉控制力\n• National Geographic 的叙事瞬间捕捉"
    },
    {
        id: "social_commercial",
        name: "🌸 网感: 社交网络爆款 (Instagram/小红书)",
        description: "偏向高亮肤色、糖水光影、情绪外露的设计。适合拍客片、写真的快速筛选。",
        systemPrompt: "你是一位精通小红书、Instagram 爆款密码的人像摄影大V和修图师。",
        evaluationStandard: "• 社交媒体极其讨喜的色彩与高光\n• 肤白貌美、情绪能穿透屏幕的感染力\n• 构图干净利落，主角绝对突出"
    },
    {
        id: "ui_ux_design",
        name: "📱 设计: UI/UX 界面走查 (Apple HIG)",
        description: "交互专家的视角。适合界面截图、设计稿、排版评估。",
        systemPrompt: "你是一位来自 Apple 的资深人机交互 (HCI) 专家与顶级 UI 设计总监。在面对用户的一句话意图时，你需要将其显化为极其严谨的“UI/UX 机器视觉启发式评估标准” JSON格式。主题项描述设计语言（如扁平化、新拟物），构图项描述栅格与留白，光影色彩项描述色彩心理学与层级渐变，不能容忍项描述反人类交互或排版错乱。",
        evaluationStandard: "• 尼尔森十大可用性原则 (Nielsen's 10 Heuristics)\n• Apple Human Interface Guidelines\n• 视觉层级清晰度（用户第一眼能否看到核心 CTA 按钮）\n• 极严格扣分项：元素拥挤、边界距不统一"
    },
    {
        id: "graphic_typography",
        name: "📰 排版: 商业海报与版式 (Typography)",
        description: "广告美术指导视角。适合商业海报、杂志内页、平面排版。",
        systemPrompt: "你是拥有 20 年经验的顶级 4A 广告公司美术指导以及字体排印学大师。对于用户的简短意图，你需要将其显化为一个结构化的海报设计评估 JSON。构图项要求分析视觉引导线和网格系统；光影色彩项要求分析对比度和主次色调；不能容忍项必须包含诸如“字体过多”、“文字层级混乱”、“喧宾夺主”等致命错误。",
        evaluationStandard: "• 瑞士国际主义排版风格（网格的严谨性）\n• 包豪斯设计理念（形式追随功能）\n• 信息传达的瞬间穿透力（核心视觉元素是否与文案完美呼应）\n• 字体选择灾难分析"
    },
    {
        id: "concept_art",
        name: "🎨 原画: 概念设定与插画 (Concept Art)",
        description: "资深美术总监视角。适合游戏原画、动漫插画插图评估。",
        systemPrompt: "你是一位曾就职于皮克斯和暴雪的资深美术总监 (Art Director)。面对用户的意图，请将其显化为概念设定的专业评分 JSON。构图项侧重透视准确度与轮廓剪影 (Silhouette)；光影色彩侧重环境光遮蔽 (Ambient Occlusion) 与色温基调；不能容忍项侧重于“结构崩坏”、“透视错误”或“用色脏乱”。",
        evaluationStandard: "• 剪影的独特性与可读性（把角色涂黑后是否立得住）\n• 画面重心的控制（视觉引导路径是否流畅）\n• 色彩冷暖对比与情绪传递\n• 一切光影基于形体，结构透视硬伤直接扣底分"
    },
    {
        id: "interior_design",
        name: "🛋️ 空间: 室内设计渲染 (Interior Design)",
        description: "空间与软装设计师视角。专注光影追踪、真实感与空间动线。",
        systemPrompt: "你是一位全球顶尖的空间软装设计师与建筑可视化专家。面对用户的环境要求，请将其显化为空间设计的专业评分 JSON。构图项侧重空间纵深感与视觉动线引导；光影色彩侧重全局光照 (GI) 真实度、材质物理反馈 (PBR) 和色彩情绪流露；不能容忍项侧重于“光影违背物理法则”、“比例失调”或“材质廉价”。",
        evaluationStandard: "• 空间动线的合理性与视觉呼吸感\n• 材质质感表现（布料的纹理、金属的反射、木材的温润）\n• 自然光与人造光的融合过渡是否真实\n• 缺乏视觉焦点或陈列杂乱"
    },
    {
        id: "product_3d",
        name: "📦 产品: 3D 模型渲染 (Product Render)",
        description: "工业设计师视角。专注 CMF (颜色/材质/工艺)、高光结构与打光陈列。",
        systemPrompt: "你是一位资深的工业设计师与商业产品级 3D 渲染总监。面对用户的意图，请将其显化为商业级产品渲染的专业评分 JSON。构图项侧重产品的体量感展示与留白比例；光影色彩侧重边缘高光 (Edge Bevel) 的勾勒、材质 CMF 的准确性与影棚打光质感；不能容忍项侧重于“高光曝掉”、“暗部死黑”、“材质缺乏写实度”。",
        evaluationStandard: "• CMF (Color, Material, Finish) 的传达精准度\n• 灯光阵列布局（是否完美勾勒出产品形体与倒角转折）\n• 主体与背景的分离度\n• 模型穿模或布线导致的表面瑕疵"
    },
    {
        id: "commercial_pos_ocr",
        name: "📇 物料: 商展与图文 (POS / Business Cards)",
        description: "印刷审稿人视角。专注商品清晰度、文字排版，并支持提取数据。需要提取信息",
        systemPrompt: "你是一位有着严苛像素级对齐强迫症的顶级印刷印前审稿人，同时精通 OCR 数据提取。面对用户的要求，请将其显化为平面图文物料（如名片、商展海报、产品包装、说明书）的专业评分 JSON。构图项侧重阅读顺序的连贯性与出血位对齐；光影色彩侧重文本与背景色的对比度 (Contrast Ratio)、商品主图锐利度；不能容忍项侧重于“文字模糊不可读”、“信息排版拥挤”、“重要图文被裁切”。由于本预设需要提取信息，请务必利用你的 OCR 能力将图面上的所有关键文字结构化后一并返回。",
        evaluationStandard: "• 文字及商品实图的绝对清晰锐利度\n• 字号层级 (Hierarchy) 是否让眼睛第一时间抓到关键信息\n• 文本对比度是否达到无障碍阅读标准\n• 图片有明显压缩伪影或文字糊边"
    },
    {
        id: "group_photo_assessor",
        name: "📸 合影: 人脸微表情优选 (Group Photo)",
        description: "影楼选片总监视角。第一优先级扫描全员是否睁眼、笑容同步率，专门用于连拍优选。",
        systemPrompt: "你拥有影楼顶级修图师与选片总监的敏锐度。面对用户的连拍优选需求，请将其显化为面部微表情识别的专业评分 JSON。构图项侧重群像站位的均衡与景深；光影色彩侧重面部打光的平整度与肤色还原；不能容忍项是你的第一绝对优先级：只要照片中哪怕只有一个人闭眼、半闭眼、翻白眼、面部肌肉由于说话而扭曲、或是发生过分的运动模糊，你必须立刻触发不能容忍，并给出极低分。",
        evaluationStandard: "• 第一优先级：绝不允许任何一人闭眼或处于眨眼尴尬期（一票否决）\n• 全员笑容的同步率与面部微表情的自然、生动度\n• 人群核心焦点的清晰度\n• 构图是否裁切到了边缘人物的关键肢体"
    }
];

const getLlmContext = (config?: LlmConfig) => {
    if (!config) throw new Error("LLM config missing. Please check Settings.");
    const provider = config.activeProvider;
    const pConf = config.providers[provider];
    const providerOption = getProviderOption(provider);

    let url = pConf.baseUrl.trim();
    if (!url) url = providerOption.defaultBaseUrl;

    let key = pConf.apiKey.trim();
    if (!key && provider === "qwen") key = import.meta.env.VITE_QWEN_API_KEY || "";
    if (!key) throw new Error(`API Key is missing for ${provider}. Please set it in the Settings panel.`);

    return { provider, url, key, model: pConf.model };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const chunkItems = <T,>(items: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
};

const parseDurationMs = (value: string | null): number | null => {
    if (!value) return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        return Math.ceil(parseFloat(trimmed) * 1000);
    }

    let totalMs = 0;
    let matched = false;
    const durationRegex = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;

    for (const match of trimmed.matchAll(durationRegex)) {
        matched = true;
        const amount = parseFloat(match[1]);
        const unit = match[2];

        if (unit === "ms") totalMs += amount;
        else if (unit === "s") totalMs += amount * 1000;
        else if (unit === "m") totalMs += amount * 60 * 1000;
        else if (unit === "h") totalMs += amount * 60 * 60 * 1000;
    }

    return matched ? Math.ceil(totalMs) : null;
};

const parseRemainingTokens = (value: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseRetryDelayFromErrorText = (responseText: string): number | null => {
    const match = responseText.match(/try again in\s+([\d.]+)s/i);
    if (!match) return null;
    return Math.ceil(parseFloat(match[1]) * 1000);
};

const getOpenAiRetryDelayMs = (response: Response, responseText: string, attemptIndex: number): number => {
    const retryAfterMs = parseDurationMs(response.headers.get("retry-after")) ?? 0;
    const resetTokensMs = parseDurationMs(response.headers.get("x-ratelimit-reset-tokens")) ?? 0;
    const responseHintMs = parseRetryDelayFromErrorText(responseText) ?? 0;
    const exponentialBackoffMs = 1000 * (2 ** attemptIndex);

    return Math.max(retryAfterMs, resetTokensMs, responseHintMs, exponentialBackoffMs);
};

const getOpenAiPostBatchDelayMs = (remainingTokens: number | null, resetTokensMs: number | null): number => {
    if (remainingTokens !== null && remainingTokens < OPENAI_LOW_TOKEN_THRESHOLD) {
        return Math.max(INTER_BATCH_DELAY_MS, resetTokensMs ?? 0);
    }

    return INTER_BATCH_DELAY_MS;
};

const parseEvaluationContent = (rawContent: string): ImageEvaluationResult[] => {
    let rawJson = rawContent.trim();
    if (rawJson.startsWith("\`\`\`json")) rawJson = rawJson.replace(/^\`\`\`json/g, "").replace(/\`\`\`$/g, "");
    else if (rawJson.startsWith("\`\`\`")) rawJson = rawJson.replace(/^\`\`\`/g, "").replace(/\`\`\`$/g, "");
    return JSON.parse(rawJson);
};

interface BatchEvaluationResponse {
    results: ImageEvaluationResult[];
    remainingTokens: number | null;
    resetTokensMs: number | null;
}

export const manifestAestheticIntent = async (userIntent: string, config: LlmConfig, language: string, profile: AestheticProfile = DEFAULT_PROFILES[0]): Promise<AestheticCriteria> => {
    const ctx = getLlmContext(config);
    const langInstruction = language.startsWith('en') ? "English" : "中文 (Chinese)";
    const systemPrompt = `${profile.systemPrompt}
用户的选片意图是："${userIntent}"。
你需要将这句话显化为严谨的"机器视觉照片评估标准" JSON 格式。

请从以下 7 个维度进行深度展开，每个维度给出 2-4 条具体可操作的标准：

必须严格返回如下 JSON 格式，不要包含任何额外的 markdown 标记或解释代码：
{
  "theme": "整体风格或情绪基调，如'日系清新胶片感'、'赛博朋克都市夜景'等",
  "subject": ["主体对象要求1（形态/特征/动作/姿态）", "主体对象要求2"],
  "background": ["背景环境要求1（场景设定/空间关系/环境细节）", "背景环境要求2"],
  "lighting": ["光线效果要求1（光源方向/光影对比/照明氛围）", "光线效果要求2"],
  "colorScheme": ["色调方案要求1（主色调/配色关系/色彩饱和度）", "色调方案要求2"],
  "artisticStyle": ["艺术风格标签1（具体流派/技法特点）", "艺术风格标签2"],
  "compositionRules": ["构图规则1", "构图规则2"],
  "negativeConstraints": ["绝对要避免的瑕疵，如'主体虚焦'、'欠曝死黑'、'背景杂乱抢镜'等"]
}

CRITICAL: You must translate the JSON values and output all text content inside the JSON in the following language: ${langInstruction}. The JSON keys must remain exact strings as specified above.`;

    if (isGeminiProvider(ctx.provider)) {
        const response = await fetch(`${ctx.url}/${ctx.model}:generateContent?key=${ctx.key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: "You are an API that strictly returns valid JSON." }] },
                contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) throw new Error(`Gemini Error: ${await response.text()}`);
        const data = await response.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } else {
        const payload: any = {
            model: ctx.model,
            messages: [
                { role: "system", content: "You are an API that strictly returns valid JSON." },
                { role: "user", content: systemPrompt }
            ]
        };
        // Some OpenAI compatible apis only support json_object in specific models
        if (isOpenAiCompatibleProvider(ctx.provider)) {
            payload.response_format = { type: "json_object" };
        }

        const response = await fetch(ctx.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ctx.key}`,
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API Error: ${await response.text()}`);
        const data = await response.json();
        const rawJson = data.choices[0].message.content;
        return JSON.parse(rawJson.replace(/^\`\`\`json/g, "").replace(/\`\`\`$/g, "").trim());
    }
};

export const evaluateImages = async (
    criteria: AestheticCriteria,
    images: ProcessedImage[],
    config: LlmConfig,
    language: string,
    profile: AestheticProfile = DEFAULT_PROFILES[0]
): Promise<ImageEvaluationResult[]> => {
    if (images.length === 0) return [];

    const ctx = getLlmContext(config);
    const langInstruction = language.startsWith('en') ? "English" : "中文 (Chinese)";
    const chunkSize = usesSmallBatchWindow(ctx.provider) ? OPENAI_CHUNK_SIZE : DEFAULT_CHUNK_SIZE;
    const chunks = chunkItems(images, chunkSize);

    const processBatch = async (batch: ProcessedImage[]): Promise<BatchEvaluationResponse> => {
        const textPrompt = `你是一位顶级视觉总监，同时也是艺术摄影编辑。
你的审美底线参考：
${profile.evaluationStandard}

⚠️ 严禁使用"大众觉得好看"作为判断标准。
⚠️ 必须做深度结构化分析。

你需要根据以下"审美显化标准"，对提供的 ${batch.length} 张图片进行打分(0-100)。

【用户选片意图多维展开】
🎯 主题基调：${criteria.theme}
👤 主体对象：${(criteria.subject ?? []).join("; ")}
🌿 背景环境：${(criteria.background ?? []).join("; ")}
💡 光线效果：${(criteria.lighting ?? []).join("; ")}
🎨 色调方案：${(criteria.colorScheme ?? []).join("; ")}
🖼️ 艺术风格：${(criteria.artisticStyle ?? []).join("; ")}
📐 构图规则：${criteria.compositionRules.join("; ")}
🚫 绝对避免：${criteria.negativeConstraints.join("; ")}

请根据以下 6 个严苛维度综合得出总分，并将最锐利的批判浓缩到 \`reasoning\` 字段中返回：
1. 构图张力（空间结构是否稳定又有冲突）
2. 光影层次（是否有立体感、方向性、氛围）
3. 情绪强度（是否能让人停留超过3秒）
4. 叙事含量（是否暗示故事或关系）
5. 视觉记忆点（是否有"不可替代"的元素）
6. 冗余程度（是否存在干扰元素，反向扣分）

我将从上到下按顺序提供给你 ${batch.length} 张图片，它们的 ID 分别为：${batch.map(i => i.id).join(", ")}。
请仔细观察每一张图片是否符合上述标准与用户意图，并严格返回如下 JSON 数组，不要包含任何其他文字或 markdown 符号。

💡 特殊指令 (OCR & 数据提取) 💡
如果图片中包含大量文字、名片信息、产品说明书或商展版式，请务必将其关键信息（如姓名、电话、标题、正文等）以尽可能结构化的键值对形式，提取并保存在返回对象的 \`extractedData\` 字段中。如果图片没有明显文字或不需要提取，请省略该字段。

示例返回:
[
  { 
    "imageId": "id_1", 
    "score": 88, 
    "reasoning": "构图张力强，光影具备极强的氛围感，人物情绪穿透性极高", 
    "isRecommended": true,
    "extractedData": { "Name": "John Doe", "Phone": "123-456-7890", "Topic": "AI Vision" } 
  }
]

CRITICAL: You must output the content of the \`reasoning\` field in the following language: ${langInstruction}. The rest of the keys remain intact.`;

        if (isGeminiProvider(ctx.provider)) {
            const parts: any[] = [{ text: textPrompt }];
            for (const img of batch) {
                const partsMatch = img.compressedBase64.match(/^data:(image\/[a-zA-Z]*);base64,([^\"]*)$/);
                if (partsMatch) {
                    parts.push({
                        inlineData: { mimeType: partsMatch[1], data: partsMatch[2] }
                    });
                }
            }

            const response = await fetch(`${ctx.url}/${ctx.model}:generateContent?key=${ctx.key}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: "You are an API that strictly returns valid JSON arrays." }] },
                    contents: [{ role: "user", parts }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    imageId: { type: "STRING" },
                                    score: { type: "INTEGER" },
                                    reasoning: { type: "STRING" },
                                    isRecommended: { type: "BOOLEAN" },
                                    extractedData: { type: "OBJECT" }
                                },
                                required: ["imageId", "score", "reasoning", "isRecommended"]
                            }
                        }
                    }
                })
            });

            if (!response.ok) throw new Error(`Gemini evaluation failed: ${await response.text()}`);
            const data = await response.json();
            return {
                results: JSON.parse(data.candidates[0].content.parts[0].text),
                remainingTokens: null,
                resetTokensMs: null
            };

        } else {
            const userContent: any[] = [{ type: "text", text: textPrompt }];
            for (const img of batch) {
                userContent.push({ type: "image_url", image_url: { url: img.compressedBase64 } });
            }

            const payload: any = {
                model: ctx.model,
                messages: [
                    { role: "system", content: "You are an API that strictly returns valid JSON arrays." },
                    { role: "user", content: userContent }
                ]
            };

            if (usesOpenAiRateLimitStrategy(ctx.provider)) {
                let attemptIndex = 0;

                while (true) {
                    const response = await fetch(ctx.url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${ctx.key}`,
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.status === 429) {
                        const responseText = await response.text();

                        if (attemptIndex >= MAX_OPENAI_429_RETRIES) {
                            throw new Error(`API evaluation failed: ${responseText}`);
                        }

                        const retryDelayMs = getOpenAiRetryDelayMs(response, responseText, attemptIndex);
                        attemptIndex += 1;
                        await sleep(retryDelayMs);
                        continue;
                    }

                    if (!response.ok) throw new Error(`API evaluation failed: ${await response.text()}`);

                    const remainingTokens = parseRemainingTokens(response.headers.get("x-ratelimit-remaining-tokens"));
                    const resetTokensMs = parseDurationMs(response.headers.get("x-ratelimit-reset-tokens"));
                    const data = await response.json();

                    try {
                        return {
                            results: parseEvaluationContent(data.choices[0].message.content),
                            remainingTokens,
                            resetTokensMs
                        };
                    } catch (e) {
                        console.error("Raw content:", data.choices[0].message.content);
                        throw new Error("Failed to parse evaluation response.");
                    }
                }
            }

            const response = await fetch(ctx.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${ctx.key}`,
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`API evaluation failed: ${await response.text()}`);
            const data = await response.json();
            try {
                return {
                    results: parseEvaluationContent(data.choices[0].message.content),
                    remainingTokens: null,
                    resetTokensMs: null
                };
            } catch (e) {
                console.error("Raw content:", data.choices[0].message.content);
                throw new Error("Failed to parse evaluation response.");
            }
        }
    };

    try {
        const allResults: ImageEvaluationResult[] = [];

        for (let i = 0; i < chunks.length; i += 1) {
            const { results, remainingTokens, resetTokensMs } = await processBatch(chunks[i]);
            allResults.push(...results);

            if (usesOpenAiRateLimitStrategy(ctx.provider) && i < chunks.length - 1) {
                await sleep(getOpenAiPostBatchDelayMs(remainingTokens, resetTokensMs));
            }
        }

        return allResults;
    } catch (error) {
        console.error("Error evaluating images in batches:", error);
        throw error;
    }
};

export const critiqueImage = async (base64Image: string, config: LlmConfig, language: string): Promise<string> => {
    const ctx = getLlmContext(config);
    const langInstruction = language.startsWith('en') ? "English" : "中文 (Chinese)";
    const systemPrompt = `你是一位严苛的专业摄影指导。请直接给出具体的拍摄现场改进建议，拒绝生搬硬套的废话。
你的输出必须严格遵守以下指定的 6 项格式，且每项单独占一行。
对于有缺陷的地方，请一针见血地给出具体且清晰的修改指令（例如“前景过于复杂”、“面部可往左略倾”、“色温过高，可补暖色光”）。如果没有大问题，可以简短说“保持”。绝对不要输出多余的寒暄或其他内容。

格式如下：
构图：[你的专业建议]
打光：[你的专业建议]
人物动作姿态：[你的专业建议]
人物表情：[你的专业建议]
景深：[你的专业建议]
色调：[你的专业建议]

CRITICAL: You must output all your suggestions entirely in the following language: ${langInstruction}. For example, if the language is English, output "Composition: [Your advice in English]" etc. If it is Chinese, output "构图：[中文建议]".`;

    if (isGeminiProvider(ctx.provider)) {
        const partsMatch = base64Image.match(/^data:(image\/[a-zA-Z]*);base64,([^\"]*)$/);
        const parts: any[] = [
            { text: systemPrompt + "\n\n请严格按照上述 6 项格式，逐行给出这张照片的拍摄改进建议。" }
        ];
        if (partsMatch) {
            parts.push({ inlineData: { mimeType: partsMatch[1], data: partsMatch[2] } });
        }

        const response = await fetch(`${ctx.url}/${ctx.model}:generateContent?key=${ctx.key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts }],
                generationConfig: { temperature: 0.5, topP: 0.8 }
            })
        });

        if (!response.ok) throw new Error(`Gemini critique failed: ${await response.text()}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } else {
        const userContent = [
            { type: "text", text: "请严格按照上述 6 项格式，逐行给出这张照片的拍摄改进建议。" },
            { type: "image_url", image_url: { url: base64Image } }
        ];

        const response = await fetch(ctx.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ctx.key}`,
            },
            body: JSON.stringify({
                model: ctx.model,
                temperature: 0.5,
                top_p: 0.8,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ]
            })
        });

        if (!response.ok) throw new Error(`API critique failed: ${await response.text()}`);
        const data = await response.json();
        return data.choices[0].message.content.trim();
    }
};

// [For Future AI]
// 1. Key assumptions made:
//    - We bridge between Google Gemini API and OpenAI Compatible APIs (Qwen, GPT-4o).
//    - Gemini requires completely different image encodings (\`inlineData\` vs \`image_url\`) and schema handling.
// 2. Potential edge cases to watch:
//    - JSON returning block backticks on OpenAI might still leak, always strip them out.

# GoodPhoto (优选照片) - 产品说明书

![Status](https://img.shields.io/badge/Status-Beta-blue)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange)
![React](https://img.shields.io/badge/React-v18-61DAFB)
![AI Models](https://img.shields.io/badge/AI-11_Providers_Supported-purple)

> 一款为专业摄影师、设计师和视觉创作者打造的 **“AI 原生”** 桌面工作台。旨在利用顶尖的多模态大语言模型（VLM）自动为您初筛、严苛打分并管理庞大的高分辨率视觉资产库。

---

## 🌟 核心场景与定位

在海量的连拍快门、渲染输出或设计文稿中，寻找那张真正具备“情绪张力”、“完美光影”或“无瑕疵网格”的成品是一件耗费精力的事情。GoodPhoto 不是一个简单的照片查看器，而是一个驻扎在你本地的 **“毒舌艺术总监”**。

通过与目前业内最强大的 11 种大模型平台的对接，你不仅能处理传统摄影资产，还能跨界审视 3D 渲染、排版物料，并根据各行的顶级标准完成极速初步刷选。

---

## 🚀 核心功能：一切由 AI 驱动

### 一、 强大的多模型矩阵阵列
GoodPhoto 可以自由选用接入业内目前最聪明的多模态（视觉）AI 模型，并对大窗口的分批限流做了完美适配。当前系统支持：
- **DeepSeek** (性价比与能力出众的国产之光，支持 DeepSeek-VL2)
- **豆包 ByteDance Doubao** (支持 Doubao Vision Pro 旗舰多模态)
- **通义千问 Qwen** (默认优秀模型，如 qwen-vl-max)
- **智谱 AI Zhipu** (支持 GLM-4V Plus)
- **OpenAI** (内置支持 GPT-5.4 预设以及 GPT-4o)
- **Google Gemini** (原生结构化 JSON 解析，如 Gemini 1.5 Pro, 2.0 Flash)
- **Mistral AI** (欧洲数据合规优秀，支持 Pixtral)
- **以及其他平台与聚合商**：Groq、Together AI、SiliconFlow (硅基流动)、OpenRouter。

### 二、 九大专业流派“审判官”预设
应用在底层封装了严苛的 Prompt 引擎，拒绝 “大众觉得好看就是好”。每切换一个流派，AI 就戴上了不同的专业有色眼镜：
1. 📸 **顶级画廊纪实**：以 Magnum Photos / Vogue 的高阈值标准，评估画面光影结构与叙事冲突。
2. 🌸 **社交网络爆款**：专注小红书 / Instagram 的讨喜密码（高亮肤色与情绪感染力）。
3. 📸 **合影微表情优选**：连拍群像的“一票否决权”！全员笑容同步扫描，瞬间淘汰任何包含闭眼或表情扭曲的废片。
4. 📱 **UI/UX 界面走查**：以 Apple HIG 的指导原则审视界面设计稿的层级与留白。
5. 📰 **排版与商展 OCR化物料**：利用 4A 美术指导视角评价对比度与排版拥挤度，并**原生支持提取画面中的键值对信息**（如名片、说明书文本直接解析出结构化数据）。
6. 其他跨界视点：包含 **原画/概念设定**、**室内设计渲染** 以及 **3D 工业产品 CMF 渲染** 的专属视角。

### 三、 极致苛刻的评分机制
只要你给出简短的选片意愿，AI 引擎会自动“显化”拆解出 **8 大维度的评判标准**（主题、主体、背景、光线、色调、艺术风格、构图规则、绝对避免项）。
随后，它将在本地不上传原图（通过压缩缩略底图进行特征截取）的前提下，从以下 **6个苛刻评分维度** 针对每张照片下达 0~100 分的最终裁决：
`构图张力` / `光影层次` / `情绪强度` / `叙事含量` / `视觉记忆点` / `冗余扣分`。

并附带一句切中要害的**“毒舌短评面板”**，给出具体可操作的重拍/修图建议。

### 四、 画幅内无痕修图 (AI Object Eraser)
深度集成 Stability AI Inpainting (Erase) 能力。对于 AI 指出画面冗余的部分，可以直接在应用内通过画笔涂抹路人、污点或多余结构，并通过无痕修复直接写入本地成为新图。

### 五、 商业交付与本地数字资产无缝接轨
- **沉浸式过滤与检阅**：支持类似 Pinterest 瀑布流的 Masonry 视图。通过顶部分数滑杆瞬间过滤低分冗余件。
- **Lightroom / Capture One 杀手级桥接**：自动在文件同层级生成行业标准的 `.xmp` sidecar 文件，将 AI 的分数映射为软件星级和颜色标签，让随后切入 Adobe 生态的导入过程变得完全“无感免拣”。
- **文件与 Finder 深度互通**：使用 Rust/Tauri 底层驱动。不仅读取极速，你的标记也会直接转化为 macOS 原生的 `xattr` Finder 标签。

---

## 🛠️ 怎么用？(使用指南)

1. **获取应用后**：按提示点击左上角的“设置(齿轮)”，根据你拥有的 API 渠道填写 Key。国内用户推荐申请 **Qwen (阿里云)** 或 **DeepSeek** 的 API，又快又便宜。
2. **选择流派**：在工作台顶部下拉菜单中，选择本次评审任务相符的预设流派（例如：人像是选择“画廊纪实”还是“社交网络爆款”，又或者是跑群像“防眨眼合影优选”）。
3. **意图显化**：在主输入框打出你希望选出的照片特性，比如 "我要找出这一波里最有电影感且曝光正常的抓拍"。
4. **批处理流转**：通过左栏的“资源管理器”选中某个带有未选照片的文件夹，之后一切交由 AI。

---

## 💻 开发者支持：极客与贡献者指南 (Developer Notes)

如果你希望参与源码开发或者应用尚未发布最新系统版本安装包时自行构建：

**技术栈与底层架构**：
遵循 **“AI-First”** 架构理念，将代码视为上下文与状态机，提供基于意图的文档。UI 层采用了 React 18 + Vite + Tailwind 4；底层通过 Tauri 2 (Rust) 获取安全的系统级权限、原生系统弹窗和文件交互操作；LLM 客户端利用 Facade 模式统一抹平了 `inlineData` 与特征负载 Payload 这两者之间极为分化的接口差异。

```bash
# 1. 环境准备：需安装好 Node.js (v18+) 与 Rust 稳定版、及 Tauri 系统依赖
# 2. 克隆代码库
git clone https://github.com/punkcanyang/GoodPhoto.git
cd GoodPhoto

# 3. 安装依赖
npm install

# 4. 配置本地环境变量 (或在 App UI 中填入也可)
cp .env.example .env

# 5. 启动桌面端开发服务
npm run tauri dev
```

---
> [!NOTE] 
> **声明**：本应用不直接存储或向未经授权的第三方倒卖您的原片资产。发往远端接口用于智能判断的均为由客户端本地临时降采样处理后的 Base64 数据图层。

---
<!--
[For Future AI]
1. Key assumptions made:
   - This document addresses the USER's request to format the README into a proper "product manual".
   - The document summarizes existing capabilities from `llmProviders.ts` and `llmClient.ts` to ensure 100% accuracy on what AI providers and aesthetics paths are mapped.
2. Potential edge cases to watch:
   - If new platforms are added to `llmProviders.ts`, this list in README could fall back out of sync.
   - If Tauri 2 compilation steps change, Developer Notes block would need updates.
3. Dependencies on other modules:
   - Reflects logic of `src/utils/llmClient.ts` rating dimensions and `src/llmProviders.ts` constants.
-->

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// the translations
const resources = {
    en: {
        translation: {
            sidebar: {
                loadPhotos: "Load Photos",
                loadFolder: "Load Folder",
                myGallery: "My Gallery",
                preferences: "Preferences"
            },
            gallery: {
                currentLocation: "Location: {{path}}",
                allFiles: "All Files",
                selectedFiles: "Selected ({{count}})",
                emptyState: "No photos loaded yet.",
                compressing: "Compressing: {{count}} / {{total}}"
            },
            ai: {
                intentTitle: "What kind of photos are you looking for? (Aesthetic Intent)",
                intentPlaceholder: "e.g., Cinematic lighting, moody street photos...",
                understandingIntent: "Understanding selection intent...",
                scoringPhotos: "AI is scoring photos ({{count}} pending)...",
                scoreUnit: " Score",
                evaluateAll: "Evaluate All",
                evaluateNew: "Evaluate New",
                masterCritique: "Master Critique",
                keep: "Keep",
                discard: "Discard",
                filters: {
                    all: "All",
                    recommended: "Recommended",
                    notRecommended: "Discarded",
                    unscored: "Unscored"
                },
                exportXmp: "Export Lightroom XMP",
                exportXmpSuccess: "Successfully exported XMP for {{count}} photos!",
                exportXmpError: "Failed to export XMP",
                exportProofing: "Export Proofing Gallery",
                exportingGallery: "Generating Gallery...",
                exportGallerySuccess: "Proofing Gallery successfully created at {{path}} with {{count}} photos!",
                exportGalleryError: "Failed to create gallery"
            },
            intents: [
                "Portrait Photography (Sharp focus, prominent subject, natural expression)",
                "Landscape Cinematic (Structured composition, saturated colors, proper exposure)",
                "Social Media Vibe (Japanese film look, moody, bright)",
                "Food & Still Life (Appetizing colors, clear details, macro)",
                "Trash Filter (Exclude blurry, overexposed, pure black photos)"
            ],
            viewer: {
                closeHint: "Press anywhere or ESC to close",
                removePhoto: "Remove",
                addTag: "Add Tags",
                prev: "Prev",
                next: "Next",
                critiquing: "Master is critiquing...",
                regenerateCritique: "Regenerate Critique",
                getCritique: "Get Master Critique"
            },
            settings: {
                title: "AI Engine Settings",
                subtitle: "Configure your preferred LLM provider & parameters.",
                provider: "Provider",
                modelName: "Model Name",
                apiKey: "API Key",
                baseUrl: "Base URL (Optional)",
                cancel: "Cancel",
                save: "Save",
                interfaceLang: "Interface Language"
            },
            tags: {
                title: "Add Custom Tags",
                placeholder: "Press Enter to add multiple tags",
                recent: "Recent Tags:",
                cancel: "Cancel",
                save: "Save Tags"
            },
            main: {
                fileManagement: "File Management",
                multiSelect: "Multi-Select",
                cancel: "Cancel",
                selectFolderHint: "Click the folder icon to start exploring a local directory.",
                goUpDirectory: "Go up a directory",
                selectAllImages: "Select all images on this page",
                imageDetails: "Image Details",
                selectImageHint: "Click an image in the list or gallery to view its details here.",
                cameraModel: "Model",
                dimensions: "Dimensions",
                focalLength: "Focal Length",
                aperture: "Aperture",
                exposureTime: "Shutter",
                dateTime: "Time",
                noExifData: "No EXIF data detected in this file.",
                systemTags: "System Tags",
                importToGallery: "Import this photo to gallery",
                theme: "Theme",
                subject: "Subject",
                background: "Background",
                lighting: "Lighting",
                colorScheme: "Color Scheme",
                artisticStyle: "Artistic Style",
                compositionRules: "Composition",
                negativeConstraints: "Avoid",
                candidatePhotos: "Candidate Photos",
                all: "All",
                recommended: "Recommended",
                notRecommended: "Discarded",
                unscored: "Unscored",
                score: "Score",
                cancelSelection: "Cancel Selection",
                batchOperation: "Batch Operation",
                deselectAll: "Deselect All",
                selectAllCurrent: "Select All",
                clearAll: "Clear All",
                selectOrDragPhotos: "Click to select or drag photos here",
                compressingPhotos: "High-speed local compression...",
                noTrafficConsumption: "100% Local, No Network Traffic",
                macOSNativeSelectorFixed: "Fixed: macOS native file selector",
                removePhoto: "Remove Photo",
                noPhotosDisplayed: "No photos match the current filter.",
                addMorePhotos: "Add more photos",
                addMore: "Add more",
                continueScoringHint: "Continue scoring for newly added or unscored photos only",
                continueScoring: "Continue Scoring",
                globalScoringHint: "Rebuild aesthetic criteria and rescore all photos",
                aiSelecting: "AI is selecting...",
                startGlobalSelection: "Start Global Selection",
                selectedItems: "Selected {{count}} items",
                batchImportToGallery: "Batch Import to Gallery",
                copyTo: "Copy to...",
                revealInFinderHint: "Reveal original files in Finder",
                revealInFinder: "Reveal in Finder",
                openWithDefaultAppHint: "Open with default system viewer",
                openWithDefaultApp: "Open with default app",
                addTag: "Add Tag"
            },
            profiles: {
                default_documentary: "👑 Default: Master Documentary (Magnum/Vogue)",
                social_commercial: "🌸 Social: Instagram Vibes",
                ui_ux_design: "📱 Design: UI/UX Heuristics (Apple HIG)",
                graphic_typography: "📰 Typography: Poster & Layout",
                concept_art: "🎨 Concept Art & Illustration",
                interior_design: "🛋️ Space: Interior Design Render",
                product_3d: "📦 Product: 3D Studio Render",
                commercial_pos_ocr: "📇 Print: Layout & OCR Extractor",
                group_photo_assessor: "📸 Event: Group Photo Assessor"
            }
        }
    },
    'zh-CN': {
        translation: {
            sidebar: {
                loadPhotos: "加载照片 (文件)",
                loadFolder: "加载文件夹",
                myGallery: "我的图库",
                preferences: "偏好设置"
            },
            gallery: {
                currentLocation: "当前位置: {{path}}",
                allFiles: "所有文件",
                selectedFiles: "已选文件 ({{count}})",
                emptyState: "暂无照片",
                compressing: "正在处理: {{count}} / {{total}}"
            },
            ai: {
                intentTitle: "你想要什么样的照片？(审美意图显化)",
                intentPlaceholder: "如：我想要找出日系清新、胶片感、主角笑容灿烂的照片...",
                understandingIntent: "理解选片意图...",
                scoringPhotos: "AI 正在阅片打分 (待处理 {{count}} 张)...",
                scoreUnit: "分",
                evaluateAll: "全局阅片打分",
                evaluateNew: "新图片打分",
                masterCritique: "大师批判",
                keep: "推荐",
                filters: {
                    all: "全部",
                    recommended: "推荐",
                    notRecommended: "淘汰",
                    unscored: "未打分"
                },
                exportXmp: "导出 Lightroom XMP",
                exportXmpSuccess: "成功为 {{count}} 张照片生成 XMP 伴随文件！",
                exportXmpError: "生成 XMP 文件失败",
                exportProofing: "导出选片大厅",
                exportingGallery: "正在打包相册...",
                exportGallerySuccess: "成功在 {{path}} 生成包含 {{count}} 张照片的选片画廊！",
                exportGalleryError: "导出选片画廊失败"
            },
            intents: [
                "人像写真 (对焦清晰、人物突出、表情自然)",
                "风景大片 (构图规整、色彩饱和、曝光正常)",
                "发朋友圈 (日系胶片感、氛围感、明亮)",
                "美食静物 (色彩诱人、细节清晰、微距)",
                "废片排雷 (剔除模糊、过曝、死黑的照片)"
            ],
            viewer: {
                closeHint: "按任意处或 ESC 键关闭",
                removePhoto: "移除照片",
                addTag: "贴标签",
                prev: "上一张",
                next: "下一张",
                critiquing: "大师端详中...",
                regenerateCritique: "重新生成详细拆解",
                getCritique: "获取大师级详细拆解"
            },
            settings: {
                title: "AI 核心引擎设置",
                subtitle: "配置您偏好的大模型供应商及自定义参数。",
                provider: "驱动引擎 (Provider)",
                modelName: "模型名称 (Model Name)",
                apiKey: "API Key (密钥)",
                baseUrl: "接口代理地址 (Base URL) [选填]",
                cancel: "取消",
                save: "保存设置",
                interfaceLang: "界面语言 (Language)"
            },
            tags: {
                title: "添加自定义标签",
                placeholder: "输入标签名称，按回车添加多个",
                recent: "常用标签:",
                cancel: "取消",
                save: "保存标签"
            },
            main: {
                fileManagement: "文件管理",
                multiSelect: "多选",
                cancel: "取消",
                selectFolderHint: "点击右上角选择一个本机文件夹开始探索",
                goUpDirectory: "返回上级目录",
                selectAllImages: "选中本页所有图片",
                imageDetails: "图像信息详情",
                selectImageHint: "在列表中点击一张图片，或在右侧画廊点击图片以查看检视信息",
                cameraModel: "器材",
                dimensions: "尺寸",
                focalLength: "焦距",
                aperture: "光圈",
                exposureTime: "快门",
                dateTime: "时间",
                noExifData: "未从文件中检测到 EXIF 数据",
                systemTags: "系统级标签",
                importToGallery: "导入此照片到选片池",
                theme: "显化主题",
                subject: "主体对象",
                background: "背景环境",
                lighting: "光线效果",
                colorScheme: "色调方案",
                artisticStyle: "艺术风格",
                compositionRules: "构图规则",
                negativeConstraints: "绝对避免",
                candidatePhotos: "候选照片池",
                all: "全部",
                recommended: "推荐",
                notRecommended: "落选",
                unscored: "待评分",
                score: "分",
                cancelSelection: "取消选择",
                batchOperation: "批量操作",
                deselectAll: "取消全选",
                selectAllCurrent: "全选当前",
                clearAll: "清空总体",
                selectOrDragPhotos: "点击选择照片 或 拖拽照片到这里",
                compressingPhotos: "正在本地极速压缩照片...",
                noTrafficConsumption: "全程不消耗流量与网络",
                macOSNativeSelectorFixed: "已修复：点击即可使用 macOS 原生文件选择器",
                removePhoto: "移除照片",
                noPhotosDisplayed: "当前过滤器下没有照片显示",
                addMorePhotos: "继续添加照片",
                addMore: "继续添加",
                continueScoringHint: "只对新增的、尚未评分的照片进行补全评分",
                continueScoring: "继续补全",
                globalScoringHint: "重建审美显化标准，并对所有照片重新进行地毯式评分",
                aiSelecting: "AI选片中...",
                startGlobalSelection: "开启全局选片",
                selectedItems: "已选 {{count}} 张",
                batchImportToGallery: "批量导入画廊",
                copyTo: "复制至...",
                revealInFinderHint: "在访达(Finder)中直接框选源文件",
                revealInFinder: "访达中显示的",
                openWithDefaultAppHint: "调用系统默认预览工具打开",
                openWithDefaultApp: "默认应用打开",
                addTag: "贴标签"
            },
            profiles: {
                default_documentary: "👑 默认: 顶级画廊纪实 (Magnum/Vogue)",
                social_commercial: "🌸 网感: 社交网络爆款 (Instagram/小红书)",
                ui_ux_design: "📱 设计: UI/UX 界面走查 (Apple HIG)",
                graphic_typography: "📰 排版: 商业海报与版式 (Typography)",
                concept_art: "🎨 原画: 概念设定与插画 (Concept Art)",
                interior_design: "🛋️ 空间: 室内设计渲染 (Interior Design)",
                product_3d: "📦 产品: 3D 模型渲染 (Product Render)",
                commercial_pos_ocr: "📇 物料: 商展与图文 (POS / Business Cards)",
                group_photo_assessor: "📸 合影: 人脸微表情优选 (Group Photo)"
            }
        }
    }
};

const savedLang = localStorage.getItem('goodphoto_lang') || 'zh-CN';

i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: savedLang,
        fallbackLng: "zh-CN",
        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;

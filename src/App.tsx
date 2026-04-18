import { useEffect, useRef, useState } from "react";
import { UploadCloud, Sparkles, X, Loader2, CheckCircle2, AlertCircle, Tag, FolderOpen, ExternalLink, CheckSquare, Square, Folder, FileImage, Camera, Info, ChevronLeft, ChevronRight, HardDrive, Settings, Download, Globe } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { revealItemInDir, openPath, openUrl } from '@tauri-apps/plugin-opener';
import { readFile, readDir, stat } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import * as exifr from 'exifr';
import "./App.css";
import { AestheticCriteria, FileNode, ImageEvaluationResult, ProcessedImage, ExifData, LlmConfig, AestheticProfile } from './types';
import { LLM_PROVIDER_OPTIONS, createDefaultLlmConfig, mergeLlmConfigWithDefaults, getProviderModels } from "./llmProviders";
import { compressImageToBase64 } from "./utils/imageProcessor";
import { generateXmpData } from "./utils/xmpGenerator";
import { exportProofingGallery } from "./utils/galleryExporter";
import { manifestAestheticIntent, evaluateImages, critiqueImage, DEFAULT_PROFILES } from "./utils/llmClient";
import { eraseImage } from "./utils/stabilityClient";
import { useTranslation } from "react-i18next";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import {
  applyDownloadedUpdate,
  createIdleUpdaterState,
  getUpdateStatusKey,
  runBackgroundUpdateCheck,
  type ManagedUpdate,
  type UpdateDownloadEvent,
  type UpdaterState,
} from "./utils/updater";

export const DEFAULT_LLM_CONFIG: LlmConfig = createDefaultLlmConfig();

// Helper hook to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("无法读取图片尺寸"));
    img.src = src;
  });

const getFilenameFromPath = (filePath: string) => filePath.split(/[/\\]/).pop() || filePath;

function App() {
  const { t, i18n } = useTranslation();
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [updaterState, setUpdaterState] = useState<UpdaterState>(createIdleUpdaterState());
  const pendingUpdateRef = useRef<ManagedUpdate | null>(null);

  const [intent, setIntent] = useState("");
  const [images, setImages] = useState<Record<string, ProcessedImage>>({});
  const [filterOption, setFilterOption] = useState<"ALL" | "RECOMMENDED" | "NOT_RECOMMENDED" | "UNSCORED">("ALL");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);

  // Selection & Tagging States
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTagPromptOpen, setIsTagPromptOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [recentTags, setRecentTags] = useState<string[]>([]);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(() => createDefaultLlmConfig());
  const [tempLlmConfig, setTempLlmConfig] = useState<LlmConfig>(() => createDefaultLlmConfig());

  // Gallery view states
  const [enlargedImageId, setEnlargedImageId] = useState<string | null>(null);

  // Erasing (Inpainting) States
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [eraserStrokeWidth, setEraserStrokeWidth] = useState(40);
  const canvasRef = useRef<ReactSketchCanvasRef>(null);

  // Directory Multi-Select States
  const [isDirectorySelectMode, setIsDirectorySelectMode] = useState(false);
  const [directorySelectedPaths, setDirectorySelectedPaths] = useState<Set<string>>(new Set());

  // Sidebar States
  const [currentDirectory, setCurrentDirectory] = useState<string>("");
  const [fileNodes, setFileNodes] = useState<FileNode[]>([]);
  const [focusedFile, setFocusedFile] = useState<{ path: string, filename: string, size?: number, tags?: string[], isGalleryImage: boolean, id?: string, objectUrl?: string } | null>(null);
  const [focusedExif, setFocusedExif] = useState<ExifData | null>(null);

  // Process & AI States
  const [activeProfile, setActiveProfile] = useState<AestheticProfile>(DEFAULT_PROFILES[0]);
  const [customProfile, setCustomProfile] = useState<AestheticProfile>({
    id: "custom",
    name: "⚙️ 自定义参数...",
    description: "完全自定义大语言模型引导提示词",
    systemPrompt: "你是一个世界顶级的视觉艺术指导和胶片冲洗大师。",
    evaluationStandard: "• Magnum Photos 的纪实审美\n• Vogue 的视觉控制力\n• National Geographic 的叙事瞬间捕捉",
    isCustom: true
  });
  const [isCustomProfileModalOpen, setIsCustomProfileModalOpen] = useState(false);
  const [tempCustomProfile, setTempCustomProfile] = useState<AestheticProfile>(customProfile);

  const [isCompressing, setIsCompressing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [isExportingGallery, setIsExportingGallery] = useState(false);

  // Load Recent Tags
  useEffect(() => {
    try {
      const stored = localStorage.getItem('goodphoto_recent_tags');
      if (stored) {
        setRecentTags(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recent tags", e);
    }

    try {
      const storedConfig = localStorage.getItem('goodphoto_llm_config');
      if (storedConfig) {
        const mergedConfig = mergeLlmConfigWithDefaults(JSON.parse(storedConfig));
        setLlmConfig(mergedConfig);
        setTempLlmConfig(mergedConfig);
      } else {
        // Migration from old single key
        const oldKey = localStorage.getItem('goodphoto_api_key');
        if (oldKey) {
          const migrated: LlmConfig = createDefaultLlmConfig();
          migrated.providers.qwen.apiKey = oldKey;
          setLlmConfig(migrated);
          setTempLlmConfig(migrated);
          localStorage.setItem('goodphoto_llm_config', JSON.stringify(migrated));
          localStorage.removeItem('goodphoto_api_key'); // clear legacy
        }
      }
    } catch (e) { console.error("Failed to load llm config", e); }

    try {
      const storedCustomProfile = localStorage.getItem('goodphoto_custom_profile');
      if (storedCustomProfile) {
        setCustomProfile(JSON.parse(storedCustomProfile));
      }
      const storedActiveProfileId = localStorage.getItem('goodphoto_active_profile_id');
      if (storedActiveProfileId) {
        if (storedActiveProfileId === 'custom' && storedCustomProfile) {
          setActiveProfile(JSON.parse(storedCustomProfile));
        } else {
          const found = DEFAULT_PROFILES.find(p => p.id === storedActiveProfileId);
          if (found) setActiveProfile(found);
        }
      }
    } catch (e) { console.error("Failed to load profile config", e); }
  }, []);

  // Results
  const [criteria, setCriteria] = useState<AestheticCriteria | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, ImageEvaluationResult>>({});
  const [imageCritiques, setImageCritiques] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");

  const handleBackgroundUpdateCheck = async () => {
    const pendingUpdate = await runBackgroundUpdateCheck(
      async () => {
        const update = await check();
        if (!update) {
          return null;
        }

        return {
          version: update.version,
          currentVersion: update.currentVersion,
          body: update.body,
          download(onEvent) {
            return update.download((event) => {
              if (event.event === "Started") {
                onEvent?.({
                  event: "Started",
                  data: { contentLength: event.data.contentLength },
                } satisfies UpdateDownloadEvent);
              } else if (event.event === "Progress") {
                onEvent?.({
                  event: "Progress",
                  data: { chunkLength: event.data.chunkLength },
                } satisfies UpdateDownloadEvent);
              } else {
                onEvent?.({ event: "Finished" });
              }
            });
          },
          install() {
            return update.install();
          },
        } satisfies ManagedUpdate;
      },
      (nextState) => {
        setUpdaterState(nextState);
      },
    );

    pendingUpdateRef.current = pendingUpdate;
  };

  const handleInstallUpdate = async () => {
    if (!pendingUpdateRef.current) {
      return;
    }

    await applyDownloadedUpdate(
      pendingUpdateRef.current,
      async () => {
        await relaunch();
      },
      (nextState) => {
        setUpdaterState(nextState);
      },
    );
  };

  const isReadyToInstallUpdate =
    updaterState.phase === "ready" && Boolean(pendingUpdateRef.current);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const version = await getVersion();
          if (!cancelled) {
            setAppVersion(version);
          }
        } catch (error) {
          console.error("Failed to resolve app version", error);
        }

        if (!cancelled) {
          await handleBackgroundUpdateCheck();
        }
      })();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const processFilePaths = async (filePaths: string[]) => {
    setIsCompressing(true);
    setErrorMsg("");

    const newImages: Record<string, ProcessedImage> = {};

    for (const filePath of filePaths) {
      const id = generateId();

      try {
        const filename = filePath.split(/[/\\]/).pop() || "unknown.jpg";
        const fileContent = await readFile(filePath);
        const blob = new Blob([fileContent]);
        const objectUrl = URL.createObjectURL(blob);

        const base64 = await compressImageToBase64(objectUrl);
        URL.revokeObjectURL(objectUrl);

        newImages[id] = {
          id,
          originalFilePath: filePath,
          filename,
          compressedBase64: base64,
          status: "DONE",
        };
      } catch (error) {
        console.error("Compression failed for", filePath, error);
      }
    }

    setImages(prev => ({ ...prev, ...newImages }));
    setIsCompressing(false);
  };

  const loadDirectoryContent = async (dirPath: string) => {
    try {
      const entries = await readDir(dirPath);
      const nodes: FileNode[] = [];
      for (const entry of entries) {
        if (entry.name && !entry.name.startsWith('.')) {
          // Normalize dirPath to ensure it doesn't end with a slash before appending
          const safeDirPath = dirPath.endsWith('/') || dirPath.endsWith('\\') ? dirPath.slice(0, -1) : dirPath;
          nodes.push({
            name: entry.name,
            isDirectory: entry.isDirectory,
            path: `${safeDirPath}/${entry.name}`
          });
        }
      }
      nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      setFileNodes(nodes);
      setCurrentDirectory(dirPath);
    } catch (e: any) {
      setErrorMsg("读取目录失败: " + e.message);
    }
  };

  const handleOpenExplorerDialog = async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      await loadDirectoryContent(selected);
    }
  };

  const traverseUpDirectory = async () => {
    const parts = currentDirectory.split(/[/\\]/);
    if (parts.length > 1) {
      parts.pop();
      const targetPath = parts.join('/') || '/';
      try {
        // Test if we have permission to read the directory
        await readDir(targetPath);
        await loadDirectoryContent(targetPath);
      } catch (err) {
        // Fallback to active dialog asking if permission is denied
        const selected = await openDialog({ directory: true, multiple: false, defaultPath: targetPath });
        if (selected && typeof selected === 'string') {
          await loadDirectoryContent(selected);
        }
      }
    }
  };

  const handleExportXmp = async () => {
    let successCount = 0;
    for (const [id, evaluation] of Object.entries(evaluations)) {
      const image = images[id];
      if (!image) continue;

      const xmpContent = generateXmpData(evaluation.score);
      const lastDotIndex = image.originalFilePath.lastIndexOf('.');
      let xmpPath = image.originalFilePath + ".xmp";
      if (lastDotIndex > image.originalFilePath.lastIndexOf('/')) {
        xmpPath = image.originalFilePath.substring(0, lastDotIndex) + ".xmp";
      }

      try {
        await invoke("write_text_file", { filePath: xmpPath, content: xmpContent });
        successCount++;
      } catch (e: any) {
        console.error("Failed to write XMP:", e);
        setErrorMsg(t('ai.exportXmpError') + ": " + e.message);
      }
    }

    if (successCount > 0) {
      alert(t('ai.exportXmpSuccess', { count: successCount }));
    }
  };

  const handleExportProofing = async () => {
    const selectedDir = await openDialog({ directory: true, multiple: false });
    if (!selectedDir || typeof selectedDir !== 'string') return;

    setIsExportingGallery(true);
    let successCount = 0;
    try {
      const now = new Date();
      const folderName = `GoodPhotos_Gallery_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      let normalizedDir = selectedDir;
      if (normalizedDir.endsWith('/') || normalizedDir.endsWith('\\')) {
        normalizedDir = normalizedDir.slice(0, -1);
      }
      const targetPath = `${normalizedDir}/${folderName}`;

      const imagesToExport = filteredAndSortedImages
        .filter(img => evaluations[img.id] && evaluations[img.id].isRecommended)
        .map(img => img.id);

      if (imagesToExport.length === 0) {
        alert("没有可导出的被推荐照片！");
        setIsExportingGallery(false);
        return;
      }

      successCount = await exportProofingGallery(imagesToExport, images, evaluations, targetPath);

      if (successCount > 0) {
        // Open the generated gallery in default browser/finder
        alert(t('ai.exportGallerySuccess', { path: targetPath, count: successCount }));
        await openPath(targetPath);
      }
    } catch (e: any) {
      console.error("Failed to export proofing gallery:", e);
      // Ensure we get a sensible string from the error object
      const errorMsg = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
      setErrorMsg(t('ai.exportGalleryError') + ": " + errorMsg);
    } finally {
      setIsExportingGallery(false);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "未知大小";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleFocusFile = async (path: string, filename: string, isGalleryImage: boolean = false, optionalGalleryId?: string) => {
    try {
      const fileStat = await stat(path).catch(e => {
        console.warn("Failed to stat file:", e);
        return { size: 0 };
      });
      // Important: catch tags errors so we don't abort loading image details
      const tags = await invoke<string[]>("get_macos_file_tags", { filePath: path }).catch(e => {
        console.warn("Failed to read macOS tags:", e);
        return [];
      });

      let meta: ExifData = {};
      const isImage = /\.(jpg|jpeg|png|heic|webp)$/i.test(filename);
      let objectUrl = undefined;

      if (isImage) {
        try {
          // Bypass Tauri fs plugin sandbox for deep subfolders
          const fileData = await invoke<number[]>("read_file_bytes", { filePath: path });
          const u8arr = new Uint8Array(fileData);
          const blob = new Blob([u8arr]);
          objectUrl = URL.createObjectURL(blob);
          const parsed = await exifr.parse(blob).catch((e) => {
            console.warn("Exif parse failed:", e);
            return null;
          });
          if (parsed) {
            meta = {
              model: parsed.Model,
              focalLength: parsed.FocalLength,
              fNumber: parsed.FNumber,
              iso: parsed.ISO,
              exposureTime: parsed.ExposureTime ? `1/${Math.round(1 / parsed.ExposureTime)}` : undefined,
              dateTimeOriginal: parsed.DateTimeOriginal ? new Date(parsed.DateTimeOriginal).toLocaleString() : undefined,
              width: parsed.ExifImageWidth || parsed.ImageWidth,
              height: parsed.ExifImageHeight || parsed.ImageHeight,
            };
          }
        } catch (readError: any) {
          console.error("Failed to read image file at path:", path, readError);
          setErrorMsg(`无法读取图片文件 (${path}): ${readError.message || readError}`);
          return; // Stop processing this file if we can't read it
        }
      }

      setFocusedExif(meta);
      if (focusedFile?.objectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(focusedFile.objectUrl);
      }
      setFocusedFile({
        path,
        filename,
        size: fileStat.size,
        tags,
        isGalleryImage,
        id: optionalGalleryId,
        objectUrl
      });
    } catch (e: any) {
      console.error("Inspect error:", e);
    }
  };

  const handleToggleDirectorySelectMode = () => {
    setIsDirectorySelectMode(!isDirectorySelectMode);
    setDirectorySelectedPaths(new Set());
  };

  const handleToggleDirectorySelectAll = () => {
    const imagesInDir = fileNodes.filter(n => !n.isDirectory && /\.(jpg|jpeg|png|heic|webp)$/i.test(n.name));
    if (directorySelectedPaths.size === imagesInDir.length) {
      setDirectorySelectedPaths(new Set());
    } else {
      setDirectorySelectedPaths(new Set(imagesInDir.map(n => n.path)));
    }
  };

  const handleBatchImportFromDirectory = async () => {
    if (directorySelectedPaths.size === 0) return;
    const pathsToImport = Array.from(directorySelectedPaths);
    await processFilePaths(pathsToImport);
    setIsDirectorySelectMode(false);
    setDirectorySelectedPaths(new Set());
  };

  const handleDirectoryNodeClick = (node: FileNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isDirectory) {
      loadDirectoryContent(node.path);
    } else {
      if (isDirectorySelectMode && /\.(jpg|jpeg|png|heic|webp)$/i.test(node.name)) {
        const newSet = new Set(directorySelectedPaths);
        if (newSet.has(node.path)) newSet.delete(node.path);
        else newSet.add(node.path);
        setDirectorySelectedPaths(newSet);
      } else {
        handleFocusFile(node.path, node.name, false);
      }
    }
  };

  const handleNativeSelect = async () => {
    try {
      const selected = await openDialog({
        multiple: true,
        filters: [{
          name: 'Images',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic']
        }]
      });

      if (selected && Array.isArray(selected)) {
        await processFilePaths(selected);
      } else if (typeof selected === 'string') {
        await processFilePaths([selected]);
      }
    } catch (err) {
      console.error("Failed to open dialog", err);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsCompressing(true);
      setErrorMsg("");
      const droppedFiles = Array.from(e.dataTransfer.files);

      const newImages: Record<string, ProcessedImage> = {};

      for (const file of droppedFiles) {
        if (!file.type.startsWith("image/")) continue;

        const id = generateId();
        const objectUrl = URL.createObjectURL(file);

        try {
          const base64 = await compressImageToBase64(objectUrl);
          newImages[id] = {
            id,
            originalFilePath: (file as any).path || file.name,
            filename: file.name,
            compressedBase64: base64,
            status: "DONE",
          };
        } catch (error) {
          console.error("Compression failed for", file.name, error);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }

      setImages(prev => ({ ...prev, ...newImages }));
      setIsCompressing(false);
    }
  };

  const clearFiles = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Revoke object URLs to prevent memory leaks and ghost rendering
    Object.values(images).forEach(img => {
      if (img.compressedBase64 && img.compressedBase64.startsWith('blob:')) {
        URL.revokeObjectURL(img.compressedBase64);
      }
    });

    setImages({});
    setCriteria(null);
    setEvaluations({});
    setImageCritiques({});
    setSelectedIds(new Set());
    setEnlargedImageId(null);
    setIsEraserMode(false);
    canvasRef.current?.resetCanvas();
    setErrorMsg("");
  };

  const handleRemoveImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Remove from selection if present
    if (selectedIds.has(id)) {
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    }

    // Remove from the main images object
    setImages(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });

    // We can leave evaluations as-is, or optionally delete it:
    // setEvaluations(prev => { ... delete prev[id] ... })
  };

  const imagesArray = Object.values(images);

  // Apply filters and sorting
  const filteredAndSortedImages = imagesArray
    .filter(img => {
      const evalData = evaluations[img.id];
      if (evalData && evalData.score < minScoreFilter) return false;

      if (filterOption === "ALL") return true;
      if (filterOption === "RECOMMENDED") return evalData?.isRecommended;
      if (filterOption === "NOT_RECOMMENDED") return evalData && !evalData.isRecommended;
      if (filterOption === "UNSCORED") return !evalData;
      return true;
    })
    .sort((a, b) => {
      // Unscored first
      const evalA = evaluations[a.id];
      const evalB = evaluations[b.id];
      if (!evalA && evalB) return -1;
      if (evalA && !evalB) return 1;
      // Then by score (high to low)
      if (evalA && evalB) {
        if (evalA.score !== evalB.score) return evalB.score - evalA.score;
      }
      return 0;
    });

  // Handle Keyboard Navigation for Enlarged Viewer
  useEffect(() => {
    if (!enlargedImageId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEraserMode) {
          setIsEraserMode(false);
          canvasRef.current?.resetCanvas();
          return;
        }
        setEnlargedImageId(null);
        return;
      }

      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isEraserMode || isErasing) return;

      const currentIndex = filteredAndSortedImages.findIndex(img => img.id === enlargedImageId);
      if (currentIndex === -1) return; // Image might have been filtered out

      let nextIndex = currentIndex;
      if (e.key === 'ArrowLeft') {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredAndSortedImages.length - 1;
      } else if (e.key === 'ArrowRight') {
        nextIndex = currentIndex < filteredAndSortedImages.length - 1 ? currentIndex + 1 : 0;
      }

      setEnlargedImageId(filteredAndSortedImages[nextIndex].id);
      handleFocusFile(filteredAndSortedImages[nextIndex].originalFilePath, filteredAndSortedImages[nextIndex].filename, true, filteredAndSortedImages[nextIndex].id)
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enlargedImageId, filteredAndSortedImages, isEraserMode, isErasing]);

  useEffect(() => {
    setIsEraserMode(false);
    canvasRef.current?.resetCanvas();
  }, [enlargedImageId]);

  const unEvaluatedImages = imagesArray.filter(file => !evaluations[file.id]);

  const handleStartAnalysis = async (isIncremental: boolean = false) => {
    const targetImages = isIncremental ? unEvaluatedImages : imagesArray;
    if (targetImages.length === 0 || !intent) return;

    try {
      setIsAnalyzing(true);
      setErrorMsg("");

      // Phase 1: Only recreate criteria if not incremental OR we don't have one
      let currentCriteria = criteria;
      if (!isIncremental || !currentCriteria) {
        setEvaluations(isIncremental ? { ...evaluations } : {});
        setAnalysisStep(t('ai.understandingIntent'));
        currentCriteria = await manifestAestheticIntent(intent, llmConfig, i18n.language);
        setCriteria(currentCriteria);
      }

      setAnalysisStep(t('ai.scoringPhotos', { count: isIncremental ? unEvaluatedImages.length : imagesArray.length }));
      // Filter out images that already have evaluations if isIncremental is true
      const imagesToEvaluate = isIncremental
        ? imagesArray.filter(img => !evaluations[img.id])
        : imagesArray;

      const evalResults = await evaluateImages(currentCriteria, imagesToEvaluate, llmConfig, i18n.language);

      const newEvals: Record<string, ImageEvaluationResult> = isIncremental ? { ...evaluations } : {};
      evalResults.forEach(res => {
        newEvals[res.imageId] = res;
      });
      setEvaluations(newEvals);

      setAnalysisStep("");
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "分析过程出现错误");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeepCritique = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!enlargedImageId || isCritiquing) return;

    // Optional: could show some loading state or clear existing cache temporarily
    // imageCritiques[enlargedImageId] = undefined; // We'll just overwrite it below.

    const img = images[enlargedImageId];
    if (!img || !img.compressedBase64) return;

    try {
      setIsCritiquing(true);
      setErrorMsg("");
      // The 'img' variable is already defined above, no need to redefine.
      // const img = images[enlargedImageId];
      // if (!img) return;

      const critique = await critiqueImage(img.compressedBase64, llmConfig, i18n.language);

      setImageCritiques(prev => ({
        ...prev,
        [enlargedImageId]: critique
      }));
    } catch (err: any) {
      console.error(err);
      setErrorMsg("AI点评失败：" + err.message);
    } finally {
      setIsCritiquing(false);
    }
  };

  const handleEraseMask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!enlargedImageId || !canvasRef.current || isErasing) return;

    // Check if stability API is configured
    if (!llmConfig.providers.stability?.apiKey) {
      setErrorMsg("请先在设置中配置 Stability AI API Key 以启用去水印功能。");
      setIsSettingsOpen(true);
      return;
    }

    try {
      setIsErasing(true);
      setErrorMsg("");

      // 1. Export the mask drawn by the user
      // We export the on-screen strokes first, then resample them to the uploaded bitmap size.
      const rawMaskBase64 = await canvasRef.current.exportImage("png");
      const targetImageId = enlargedImageId;
      const img = images[targetImageId];
      if (!img || !img.compressedBase64) throw new Error("缺少原图片数据");
      const sourceImage = await loadImageElement(img.compressedBase64);

      // 2. We need to convert the transparent/black mask to the format required by Stability AI
      // Stability V2 erase API expects: black & white mask image.
      // White pixels denote areas to ERASE; black pixels denote areas to KEEP.
      // The display canvas is viewport-sized, so we resample it back to the uploaded image dimensions first.
      const maskImage = await loadImageElement(rawMaskBase64);

      const offCanvas = document.createElement("canvas");
      offCanvas.width = sourceImage.naturalWidth || sourceImage.width;
      offCanvas.height = sourceImage.naturalHeight || sourceImage.height;
      const ctx = offCanvas.getContext("2d");
      if (!ctx) throw new Error("无法创建遮罩绘图上下文");

      // Fill with BLACK (keep)
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

      // Draw the user's strokes scaled to the exact bitmap that will be uploaded.
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(maskImage, 0, 0, offCanvas.width, offCanvas.height);

      // Now we have a black background with red strokes. We need to convert red to pure white.
      const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // If it's pure black or fully transparent (which is the background we just filled)
        if ((r === 0 && g === 0 && b === 0) || a === 0) {
          data[i] = 0;       // R
          data[i + 1] = 0;   // G
          data[i + 2] = 0;   // B
          data[i + 3] = 255; // A (solid black = KEEP)
        } else {
          // Anything else is the user's stroke (red, anti-aliased edges, etc)
          data[i] = 255;     // R
          data[i + 1] = 255; // G
          data[i + 2] = 255; // B
          data[i + 3] = 255; // A (solid white = ERASE)
        }
      }
      ctx.putImageData(imgData, 0, 0);
      const finalMaskBase64 = offCanvas.toDataURL("image/png");

      // 3. Call Stability API
      const resultBase64 = await eraseImage(img.compressedBase64, finalMaskBase64, llmConfig);

      // 4. Save the result as a new file physically on disk
      try {
        const originalPath = img.originalFilePath;
        const lastDot = originalPath.lastIndexOf('.');
        const lastSlash = Math.max(originalPath.lastIndexOf('/'), originalPath.lastIndexOf('\\'));
        const noExt = lastDot > lastSlash ? originalPath.substring(0, lastDot) : originalPath;
        const ext = "webp"; // We requested webp from stability
        const newFilePath = `${noExt}_erased_${Date.now()}.${ext}`;
        const newFilename = getFilenameFromPath(newFilePath);

        // Convert base64 to binary string then save
        const base64Data = resultBase64.split(',')[1];
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        await invoke("write_binary_file", {
          filePath: newFilePath,
          content: Array.from(bytes)
        });

        setImages(prev => ({
          ...prev,
          [targetImageId]: {
            ...prev[targetImageId],
            originalFilePath: newFilePath,
            filename: newFilename,
            compressedBase64: resultBase64
          }
        }));
        await handleFocusFile(newFilePath, newFilename, true, targetImageId);
      } catch (saveErr: any) {
        console.error("Failed to save erased file:", saveErr);
        const errMsg = typeof saveErr === 'string' ? saveErr : (saveErr?.message || "未知错误");
        setErrorMsg("API请求成功，但保存到本地失败：" + errMsg);
      }

      // 5. Cleanup
      setIsEraserMode(false);
      canvasRef.current.resetCanvas();

    } catch (err: any) {
      console.error("Erase error:", err);
      setErrorMsg(err.message || "抹除水印失败");
    } finally {
      setIsErasing(false);
    }
  };

  const handleToggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds(new Set());
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedImages.length) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set(filteredAndSortedImages.map(img => img.id));
      setSelectedIds(newSelected);
    }
  };

  const handleToggleSelectImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const wrapWithCatch = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "执行操作时发生错误");
    }
  };

  const handleAddTags = () => {
    if (!tagInput.trim()) return;
    const tags = tagInput.split(/[,，\s]+/).filter(t => t.trim() !== "").map(t => t.startsWith('#') ? t : `#${t}`);

    wrapWithCatch(async () => {
      const pendingUpdates: { id: string, newTags: string[], filePath: string }[] = [];
      const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : (enlargedImageId ? [enlargedImageId] : []);

      targetIds.forEach(id => {
        const img = images[id];
        if (img) {
          const existingTags = img.customTags || [];
          const merged = Array.from(new Set([...existingTags, ...tags]));
          pendingUpdates.push({ id, newTags: merged, filePath: img.originalFilePath });
        }
      });

      // 逐个向操作系统的底层写入标签数据
      for (const update of pendingUpdates) {
        await invoke("set_macos_file_tags", { filePath: update.filePath, tags: update.newTags });
      }

      // 所有系统级调用不报错后，再刷新 UI 的渲染数据
      setImages(prev => {
        const next = { ...prev };
        pendingUpdates.forEach(update => {
          if (next[update.id]) {
            next[update.id] = { ...next[update.id], customTags: update.newTags };
          }
        });
        return next;
      });

      // 更新最近标签库 (保留最多 20 个)
      const mergedRecents = Array.from(new Set([...tags, ...recentTags])).slice(0, 20);
      setRecentTags(mergedRecents);
      try {
        localStorage.setItem('goodphoto_recent_tags', JSON.stringify(mergedRecents));
      } catch (e) {
        console.error("Failed to save recent tags", e);
      }

      setTagInput("");
      setIsTagPromptOpen(false);
      setIsSelectMode(false);
      setSelectedIds(new Set());
    });
  };

  const handleModalRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!enlargedImageId) return;

    const currentIndex = filteredAndSortedImages.findIndex(img => img.id === enlargedImageId);
    let nextImageIdToEnlarge: string | null = null;

    // Find the next logical image to show
    if (filteredAndSortedImages.length > 1) {
      // If it's not the last image in the array, show the next one, else show the previous one (which is now last)
      const nextIndex = currentIndex < filteredAndSortedImages.length - 1 ? currentIndex + 1 : currentIndex - 1;
      nextImageIdToEnlarge = filteredAndSortedImages[nextIndex].id;
    }

    // Call existing remove logic
    handleRemoveImage(enlargedImageId, e);

    // If we have a cached critique for the removed image, we could optionally clear it
    // setImageCritiques({ ... }) (Leaving it cached is also fine)

    // Update modal state
    if (nextImageIdToEnlarge) {
      setEnlargedImageId(nextImageIdToEnlarge);
      const nextImg = images[nextImageIdToEnlarge];
      if (nextImg) handleFocusFile(nextImg.originalFilePath, nextImg.filename, true, nextImageIdToEnlarge);
    } else {
      setEnlargedImageId(null);
    }
  };

  const handleBatchReveal = () => {
    wrapWithCatch(async () => {
      for (const id of Array.from(selectedIds)) {
        await revealItemInDir(images[id].originalFilePath);
      }
      setIsSelectMode(false);
      setSelectedIds(new Set());
    });
  };

  const handleBatchOpen = () => {
    wrapWithCatch(async () => {
      for (const id of Array.from(selectedIds)) {
        await openPath(images[id].originalFilePath);
      }
      setIsSelectMode(false);
      setSelectedIds(new Set());
    });
  };

  const handleBatchMoveFolder = () => {
    wrapWithCatch(async () => {
      // Prompt user to select a destination directory
      const destDir = await openDialog({
        directory: true,
        multiple: false,
        title: "选择目标文件夹以批量挪动"
      });

      if (!destDir || typeof destDir !== 'string') return;

      for (const id of Array.from(selectedIds)) {
        const sourcePath = images[id].originalFilePath;
        const filename = images[id].filename;
        const destPath = `${destDir}/${filename}`;

        await invoke("copy_file", { fromPath: sourcePath, toPath: destPath });
      }

      setErrorMsg(`已完成！成功移动 ${selectedIds.size} 张照片。`);
      setTimeout(() => setErrorMsg(""), 3000);

      setIsSelectMode(false);
      setSelectedIds(new Set());
    });
  };

  return (
    <div className="h-screen bg-neutral-900 text-neutral-100 flex flex-col p-4 font-sans overflow-hidden">
      <main className="flex-1 flex flex-row gap-6 max-w-full mx-auto w-full min-h-0">
        {/* Left Sidebar */}
        <aside className="w-80 flex-shrink-0 flex flex-col gap-4 h-full xl:w-96 min-h-0">
          {/* Folder Browser */}
          <div className="flex-1 min-h-0 bg-neutral-800/40 border border-neutral-700/50 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-3 bg-neutral-800/80 border-b border-neutral-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-400" /> {t('main.fileManagement')}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleDirectorySelectMode}
                  className={`text-[10px] px-2 py-1 rounded transition-colors whitespace-nowrap flex items-center gap-1 border border-transparent
                  ${isDirectorySelectMode ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-blue-400 hover:text-blue-300 hover:bg-neutral-700/50"}`}
                >
                  <CheckSquare className="w-3" /> {isDirectorySelectMode ? t('main.cancel') : t('main.multiSelect')}
                </button>
                <button onClick={handleOpenExplorerDialog} className="text-xs text-blue-400 hover:text-blue-300 p-1 hover:bg-neutral-700/50 rounded transition-colors whitespace-nowrap" title="开启目录">
                  <FolderOpen className="w-4" />
                </button>
                <button onClick={() => setIsInfoOpen(true)} className="text-xs text-neutral-400 hover:text-neutral-300 p-1 hover:bg-neutral-700/50 rounded transition-colors whitespace-nowrap" title="关于 / Info">
                  <Info className="w-4" />
                </button>
                <button onClick={() => setIsSettingsOpen(true)} className="text-xs text-neutral-400 hover:text-neutral-300 p-1 hover:bg-neutral-700/50 rounded transition-colors whitespace-nowrap" title="偏好设置">
                  <Settings className="w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {!currentDirectory ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-2 p-4 text-center">
                  <FolderOpen className="w-8 h-8 opacity-50" />
                  <span className="text-xs">{t('main.selectFolderHint')}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div onClick={traverseUpDirectory} className="flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-700/50 rounded-lg cursor-pointer text-xs text-neutral-300 transition-colors">
                    <ChevronLeft className="w-4 h-4 text-neutral-500" />
                    {t('main.goUpDirectory')}
                  </div>
                  {isDirectorySelectMode && fileNodes.some(n => !n.isDirectory && /\.(jpg|jpeg|png|heic|webp)$/i.test(n.name)) && (
                    <div onClick={handleToggleDirectorySelectAll} className="flex items-center justify-between px-2 py-1.5 hover:bg-neutral-700/50 rounded-lg cursor-pointer text-xs transition-colors bg-neutral-800 text-neutral-300 border border-neutral-700 mb-1">
                      <span>{t('main.selectAllImages')}</span>
                      {directorySelectedPaths.size === fileNodes.filter(n => !n.isDirectory && /\.(jpg|jpeg|png|heic|webp)$/i.test(n.name)).length ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4 text-neutral-500" />}
                    </div>
                  )}
                  {fileNodes.map(node => (
                    <div
                      key={node.path}
                      onClick={(e) => handleDirectoryNodeClick(node, e)}
                      className={`flex items-center justify-between px-2 py-1.5 hover:bg-neutral-700/50 rounded-lg cursor-pointer text-xs transition-colors
                                   ${focusedFile?.path === node.path && (!isDirectorySelectMode || node.isDirectory) ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-300'}
                                   ${isDirectorySelectMode && directorySelectedPaths.has(node.path) ? 'bg-blue-600/10 border border-blue-600/30' : 'border border-transparent'}
                      `}
                      title={node.name}
                    >
                      <div className="flex items-center gap-2 truncate flex-1">
                        {node.isDirectory ? <Folder className="w-4 h-4 text-yellow-500 shrink-0" /> : <FileImage className="w-4 h-4 text-neutral-500 shrink-0" />}
                        <span className="truncate">{node.name}</span>
                      </div>
                      {isDirectorySelectMode && !node.isDirectory && /\.(jpg|jpeg|png|heic|webp)$/i.test(node.name) && (
                        <div className="shrink-0 ml-2">
                          {directorySelectedPaths.has(node.path) ? (
                            <CheckSquare className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-500" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isDirectorySelectMode && directorySelectedPaths.size > 0 && (
                <div className="sticky bottom-0 left-0 right-0 p-2 bg-neutral-800/95 backdrop-blur-sm border-t border-neutral-700/80 mt-2 z-10 rounded-b-lg">
                  <button
                    onClick={handleBatchImportFromDirectory}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    {t('main.batchImportToGallery', { count: directorySelectedPaths.size, defaultValue: `批量汇入照片池 (${directorySelectedPaths.size})` })}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Information Panel */}
          <div className="h-2/5 min-h-[300px] bg-neutral-800/40 border border-neutral-700/50 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-3 bg-neutral-800/80 border-b border-neutral-700/50">
              <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-green-400" /> {t('main.imageDetails')}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 relative">
              {!focusedFile ? (
                <div className="h-full flex items-center justify-center text-neutral-500 text-xs text-center">
                  {t('main.selectImageHint')}
                </div>
              ) : (
                <>
                  {focusedFile.objectUrl && (
                    <div className="w-full h-32 bg-neutral-900 rounded-lg overflow-hidden border border-neutral-700 shrink-0">
                      <img src={focusedFile.objectUrl} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-neutral-200 truncate" title={focusedFile.filename}>{focusedFile.filename}</p>
                    <p className="text-xs text-neutral-500">{formatSize(focusedFile.size)}</p>
                  </div>

                  <div className="w-full h-px bg-neutral-700/50 shrink-0"></div>

                  <div className="flex flex-col gap-2 text-xs shrink-0">
                    <h4 className="text-neutral-400 font-semibold mb-1 flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> EXIF</h4>
                    {focusedExif && Object.keys(focusedExif).length > 0 ? (
                      <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-neutral-300">
                        {focusedExif.model && <div className="col-span-2 text-blue-300 truncate" title={focusedExif.model}>{t('main.cameraModel')}: {focusedExif.model}</div>}
                        {focusedExif.width && focusedExif.height && <div className="col-span-2">{t('main.dimensions')}: {focusedExif.width} x {focusedExif.height}</div>}
                        {focusedExif.focalLength && <div>{t('main.focalLength')}: {focusedExif.focalLength}mm</div>}
                        {focusedExif.fNumber && <div>{t('main.aperture')}: f/{focusedExif.fNumber}</div>}
                        {focusedExif.exposureTime && <div>{t('main.exposureTime')}: {focusedExif.exposureTime}s</div>}
                        {focusedExif.iso && <div>ISO: {focusedExif.iso}</div>}
                        {focusedExif.dateTimeOriginal && <div className="col-span-2 text-neutral-500">{t('main.dateTime')}: {focusedExif.dateTimeOriginal}</div>}
                      </div>
                    ) : (
                      <p className="text-neutral-500">{t('main.noExifData')}</p>
                    )}
                  </div>

                  {focusedFile.tags && focusedFile.tags.length > 0 && (
                    <div className="flex flex-col gap-2 text-xs shrink-0 mt-1">
                      <h4 className="text-neutral-400 font-semibold flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> {t('main.systemTags')}</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {focusedFile.tags.map((t, idx) => (
                          <span key={idx} className="bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded-full border border-neutral-600">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!focusedFile.isGalleryImage && (
                    <button
                      onClick={() => processFilePaths([focusedFile.path])}
                      className="mt-2 w-full shrink-0 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg py-2 text-xs font-semibold transition"
                    >
                      {t('main.importToGallery')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Right Content */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 min-h-0 pb-10">
          {errorMsg && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm whitespace-pre-wrap">{errorMsg}</p>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="intent" className="text-sm font-semibold text-neutral-300 ml-1">
                {t('ai.intentTitle')}
              </label>

              <select
                className="bg-neutral-800 border border-neutral-700 focus:border-blue-500 rounded-lg py-1 px-2 text-xs text-neutral-300 outline-none cursor-pointer"
                value={activeProfile.id}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setTempCustomProfile(customProfile);
                    setIsCustomProfileModalOpen(true);
                  } else {
                    const found = DEFAULT_PROFILES.find(p => p.id === val);
                    if (found) {
                      setActiveProfile(found);
                      localStorage.setItem('goodphoto_active_profile_id', found.id);
                    }
                  }
                }}
              >
                {DEFAULT_PROFILES.map(p => (
                  <option key={p.id} value={p.id}>
                    {t(`profiles.${p.id}`, { defaultValue: p.name }).split(':')[0]}
                  </option>
                ))}
                <option value="custom">⚙️ {t('settings.custom', { defaultValue: '自定义' })}</option>
              </select>
            </div>
            <div className="relative">
              <input
                id="intent"
                title={activeProfile.description}
                type="text"
                disabled={isAnalyzing}
                className="w-full bg-neutral-800 border border-neutral-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl py-4 px-5 text-neutral-100 placeholder-neutral-500 transition-all outline-none disabled:opacity-50"
                placeholder={t('ai.intentPlaceholder')}
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              />
            </div>

            {/* Intent Presets */}
            <div className="flex flex-wrap gap-2 mt-4">
              {(t('intents', { returnObjects: true }) as string[]).map((preset: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setIntent(preset)}
                  className="px-3 py-1.5 text-xs text-neutral-400 bg-neutral-800/50 hover:bg-neutral-700/50 hover:text-neutral-200 border border-neutral-800 rounded-full transition-all duration-200 truncate max-w-full"
                  title={preset}
                >
                  {preset}
                </button>
              ))}
            </div>

            {criteria && !isAnalyzing && (
              <div className="mt-2 p-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-sm space-y-1.5">
                <p><strong className="text-blue-400">🎯 {t('main.theme')}：</strong>{criteria.theme}</p>
                {criteria.subject && criteria.subject.length > 0 && (
                  <p><strong className="text-purple-400">👤 {t('main.subject')}：</strong>{criteria.subject.join("；")}</p>
                )}
                {criteria.background && criteria.background.length > 0 && (
                  <p><strong className="text-green-400">🌿 {t('main.background')}：</strong>{criteria.background.join("；")}</p>
                )}
                {criteria.lighting && criteria.lighting.length > 0 && (
                  <p><strong className="text-yellow-400">💡 {t('main.lighting')}：</strong>{criteria.lighting.join("；")}</p>
                )}
                {criteria.colorScheme && criteria.colorScheme.length > 0 && (
                  <p><strong className="text-orange-400">🎨 {t('main.colorScheme')}：</strong>{criteria.colorScheme.join("；")}</p>
                )}
                {criteria.artisticStyle && criteria.artisticStyle.length > 0 && (
                  <p><strong className="text-pink-400">🖼️ {t('main.artisticStyle')}：</strong>{criteria.artisticStyle.join("；")}</p>
                )}
                <p><strong className="text-blue-400">📐 {t('main.compositionRules')}：</strong>{criteria.compositionRules.join("；")}</p>
                <p><strong className="text-red-400">🚫 {t('main.negativeConstraints')}：</strong>{criteria.negativeConstraints.join("；")}</p>
              </div>
            )}
          </section>

          <section className="flex-1 flex flex-col min-h-[300px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-neutral-300 ml-1 whitespace-nowrap">
                {t('gallery.candidatePhotos', { count: imagesArray.length, defaultValue: `Candidate Photos (${imagesArray.length})` })}
              </h2>

              {imagesArray.length > 0 && !isAnalyzing && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                  <button
                    onClick={() => setFilterOption("ALL")}
                    className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterOption === "ALL" ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"}`}
                  >
                    {t('ai.filters.all')} ({imagesArray.length})
                  </button>
                  <button
                    onClick={() => setFilterOption("RECOMMENDED")}
                    className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterOption === "RECOMMENDED" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300 border border-transparent"}`}
                  >
                    ✨ {t('ai.filters.recommended')} ({imagesArray.filter(f => evaluations[f.id]?.isRecommended).length})
                  </button>
                  <button
                    onClick={() => setFilterOption("NOT_RECOMMENDED")}
                    className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterOption === "NOT_RECOMMENDED" ? "bg-red-600/20 text-red-400 border border-red-500/50" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300 border border-transparent"}`}
                  >
                    {t('ai.filters.notRecommended')} ({imagesArray.filter(f => evaluations[f.id] && !evaluations[f.id].isRecommended).length})
                  </button>
                  <button
                    onClick={() => setFilterOption("UNSCORED")}
                    className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterOption === "UNSCORED" ? "bg-yellow-600/20 text-yellow-500 border border-yellow-500/50" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300 border border-transparent"}`}
                  >
                    {t('ai.filters.unscored')} ({unEvaluatedImages.length})
                  </button>

                  <div className="w-px h-4 bg-neutral-700 mx-1"></div>

                  <div className="flex items-center gap-2 bg-neutral-800/80 px-3 py-1.5 rounded-full border border-neutral-700/50">
                    <span className="text-xs text-neutral-400 whitespace-nowrap">≥ {minScoreFilter} {t('main.score')}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={minScoreFilter}
                      onChange={(e) => setMinScoreFilter(parseInt(e.target.value))}
                      className="w-24 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div className="w-px h-4 bg-neutral-700 mx-1"></div>

                  <button
                    onClick={handleToggleSelectMode}
                    className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors flex items-center gap-1 border border-transparent ${isSelectMode ? "bg-blue-600/20 text-blue-400 border-blue-500/50" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300"}`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> {isSelectMode ? t('main.cancelSelection') : t('main.batchOperation')}
                  </button>

                  {isSelectMode && filteredAndSortedImages.length > 0 && (
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-600 flex items-center gap-1"
                    >
                      {selectedIds.size === filteredAndSortedImages.length ? t('main.deselectAll') : t('main.selectAllCurrent')}
                    </button>
                  )}

                  <div className="w-px h-4 bg-neutral-700 mx-1"></div>

                  <button
                    onClick={clearFiles}
                    className="text-xs text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-1 whitespace-nowrap px-2"
                  >
                    <X className="w-3 h-3" /> {t('main.clearAll')}
                  </button>
                </div>
              )}
            </div>

            <div
              onClick={!isAnalyzing && imagesArray.length === 0 ? handleNativeSelect : undefined}
              onDragOver={(e) => (!isAnalyzing ? e.preventDefault() : null)}
              onDrop={handleDrop}
              className={`flex-1 overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-8
              ${imagesArray.length > 0
                  ? "border-neutral-700 bg-neutral-800/30"
                  : "border-neutral-600 bg-neutral-800/50 hover:bg-neutral-800 hover:border-blue-500/50 cursor-pointer"
                }`}
            >
              {imagesArray.length === 0 ? (
                <div className="text-center flex flex-col items-center gap-4 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-neutral-700/50 flex items-center justify-center">
                    {isCompressing ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin" /> : <UploadCloud className="w-8 h-8 text-neutral-400" />}
                  </div>
                  <div>
                    <p className="text-base font-medium text-neutral-300">
                      {isCompressing ? t('main.compressingPhotos') : t('main.selectOrDragPhotos')}
                    </p>
                    <p className="text-sm text-neutral-500 mt-1">
                      {isCompressing ? t('main.noTrafficConsumption') : t('main.macOSNativeSelectorFixed')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col">
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 overflow-y-auto w-full flex-1 pr-2 pb-12 auto-rows-max">
                    {filteredAndSortedImages.map((file) => {
                      const evalData = evaluations[file.id];
                      const isSelected = selectedIds.has(file.id);

                      return (
                        <div
                          key={file.id}
                          onClick={isSelectMode ? (e) => handleToggleSelectImage(file.id, e) : () => { handleFocusFile(file.originalFilePath, file.filename, true, file.id); setEnlargedImageId(file.id); }}
                          className={`aspect-square bg-neutral-800 rounded-xl overflow-hidden relative group transition-all duration-300
                          ${isSelectMode ? 'cursor-pointer' : 'cursor-pointer'}
                          ${focusedFile?.id === file.id && !enlargedImageId ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900' : ''}
                          ${isSelectMode && isSelected ? 'ring-4 ring-blue-500 scale-[0.98]' : ''}
                          ${!isSelectMode && evalData?.isRecommended ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-neutral-900 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : ''}
                          ${!isSelectMode && evalData && !evalData.isRecommended ? 'opacity-40 grayscale blur-[1px] hover:blur-none transition-all' : ''}
                        `}
                        >
                          <img src={file.compressedBase64} alt={file.filename} className={`absolute inset-0 w-full h-full object-cover transition-all ${isSelectMode && isSelected ? 'opacity-70 scale-95' : ''}`} />

                          {/* Close/Remove Button */}
                          {!isSelectMode && (
                            <button
                              onClick={(e) => handleRemoveImage(file.id, e)}
                              className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-30"
                              title={t('main.removePhoto')}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Tags Display */}
                          {!isSelectMode && file.customTags && file.customTags.length > 0 && (
                            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                              {file.customTags.map((tag, idx) => (
                                <span key={idx} className="bg-black/60 backdrop-blur-md text-[#A8C7FA] text-[9px] px-1.5 py-0.5 rounded border border-[#A8C7FA]/30 shadow-sm max-w-[80px] truncate">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Selection Checkbox overlay */}
                          {isSelectMode && (
                            <div className="absolute top-2 right-2 drop-shadow-md z-20">
                              {isSelected ? (
                                <CheckSquare className="w-6 h-6 text-blue-500 bg-white rounded-sm" />
                              ) : (
                                <Square className="w-6 h-6 text-white/70" />
                              )}
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-4 flex flex-col justify-end">
                            <span className="text-[10px] text-neutral-300 w-full truncate text-center mb-1">
                              {file.filename}
                            </span>
                            {evalData && (
                              <div className="absolute top-2 left-2 flex gap-1 z-20">
                                {evalData && (
                                  <div className={`px-2 py-1 rounded-full text-xs font-bold border ${evalData.isRecommended ? "bg-emerald-500/90 text-white border-emerald-400" : "bg-red-500/90 text-white border-red-400"} shadow-lg backdrop-blur-md`}>
                                    {evalData.score}{t('ai.scoreUnit')}
                                  </div>
                                )}
                                {evalData && (
                                  <div className={`px-2 py-1 rounded-full text-xs font-bold border ${evalData.isRecommended ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" : "bg-red-500/20 text-red-300 border-red-500/50"} backdrop-blur-md`}>
                                    {evalData.isRecommended ? t('ai.keep') : t('ai.discard')}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {evalData?.isRecommended && (
                            <div className="absolute top-2 right-2 bg-emerald-500 p-1 rounded-full shadow-lg">
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                          {evalData && (
                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-xs text-white text-center leading-relaxed">
                                {evalData.reasoning}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {filteredAndSortedImages.length === 0 && imagesArray.length > 0 && !isCompressing && (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center text-neutral-500">
                        <p>{t('main.noPhotosDisplayed')}</p>
                      </div>
                    )}

                    {isCompressing && (
                      <div className="aspect-square bg-neutral-800/50 border border-neutral-700 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      </div>
                    )}
                    {!isCompressing && !isAnalyzing && filterOption === "ALL" && !isSelectMode && (
                      <div
                        onClick={(e) => { e.stopPropagation(); handleNativeSelect(); }}
                        className="aspect-square bg-neutral-800/50 hover:bg-neutral-700 border-2 border-dashed border-neutral-600 hover:border-blue-500/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all text-neutral-400 hover:text-blue-400 gap-2"
                        title={t('main.addMorePhotos')}
                      >
                        <UploadCloud className="w-8 h-8" />
                        <span className="text-xs font-medium">{t('main.addMore')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="mt-4 flex justify-between items-center">
            <div className="flex-1">
              {isAnalyzing && (
                <div className="flex items-center gap-3 text-blue-400 font-medium">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{analysisStep}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {Object.keys(evaluations).length > 0 && (
                <>
                  <button
                    onClick={handleExportProofing}
                    disabled={isExportingGallery}
                    className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/50 disabled:opacity-50 disabled:cursor-not-allowed font-medium py-3 px-6 rounded-xl transition-all flex items-center gap-2"
                    title={t('ai.exportProofing')}
                  >
                    {isExportingGallery ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
                    {isExportingGallery ? t('ai.exportingGallery') : t('ai.exportProofing')}
                  </button>
                  <button
                    onClick={handleExportXmp}
                    className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/50 font-medium py-3 px-6 rounded-xl transition-all flex items-center gap-2"
                    title={t('ai.exportXmp')}
                  >
                    <Download className="w-5 h-5" />
                    {t('ai.exportXmp')}
                  </button>
                </>
              )}
              <button
                onClick={() => handleStartAnalysis(true)}
                disabled={imagesArray.length === 0 || unEvaluatedImages.length === 0 || !intent || isCompressing || isAnalyzing}
                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/50 disabled:opacity-50 disabled:cursor-not-allowed font-medium py-3 px-6 rounded-xl transition-all flex items-center gap-2"
                title={t('main.continueScoringHint')}
              >
                {t('main.continueScoring')} {unEvaluatedImages.length > 0 && `(${unEvaluatedImages.length})`}
              </button>
              <button
                onClick={() => handleStartAnalysis(false)}
                disabled={imagesArray.length === 0 || !intent || isCompressing || isAnalyzing}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-8 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                title={t('main.globalScoringHint')}
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {isAnalyzing ? t('main.aiSelecting') : t('main.startGlobalSelection')}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Action Bar for Directory Multi-Select Mode */}
      {isDirectorySelectMode && directorySelectedPaths.size > 0 && (
        <div className="fixed bottom-16 left-6 w-80 xl:w-96 bg-neutral-800/95 backdrop-blur-2xl border border-blue-500/50 shadow-2xl rounded-2xl p-3 flex items-center justify-between z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-blue-600/20 text-blue-400 font-bold px-3 py-1.5 rounded-xl text-sm border border-blue-500/30">
            {t('main.selectedItems', { count: directorySelectedPaths.size })}
          </div>

          <button
            onClick={() => {
              processFilePaths(Array.from(directorySelectedPaths));
              setIsDirectorySelectMode(false);
              setDirectorySelectedPaths(new Set());
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-md text-sm font-medium"
          >
            <UploadCloud className="w-4 h-4" /> {t('main.batchImportToGallery')}
          </button>
        </div>
      )}
      {/* Floating Action Bar for Selection Mode */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-neutral-800/90 backdrop-blur-xl border border-neutral-700 shadow-2xl rounded-2xl p-2 flex items-center gap-2 z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-blue-600/20 text-blue-400 font-bold px-4 py-2 rounded-xl text-sm border border-blue-500/20">
            {t('main.selectedItems', { count: selectedIds.size })}
          </div>

          <div className="w-px h-8 bg-neutral-700 mx-1"></div>

          <button onClick={() => setIsTagPromptOpen(true)} className="flex items-center gap-1.5 px-4 py-2 hover:bg-neutral-700 rounded-xl transition-colors text-neutral-300 text-sm font-medium">
            <Tag className="w-4 h-4" /> {t('main.addTag')}
          </button>

          <button onClick={handleBatchMoveFolder} className="flex items-center gap-1.5 px-4 py-2 hover:bg-neutral-700 rounded-xl transition-colors text-neutral-300 text-sm font-medium">
            <FolderOpen className="w-4 h-4" /> {t('main.copyTo')}
          </button>

          <button onClick={handleBatchReveal} className="flex items-center gap-1.5 px-4 py-2 hover:bg-neutral-700 rounded-xl transition-colors text-neutral-300 text-sm font-medium" title={t('main.revealInFinderHint')}>
            <ExternalLink className="w-4 h-4" /> {t('main.revealInFinder')}
          </button>

          <button onClick={handleBatchOpen} className="flex items-center gap-1.5 px-4 py-2 hover:bg-neutral-700 rounded-xl transition-colors text-neutral-300 text-sm font-medium" title={t('main.openWithDefaultAppHint')}>
            <ExternalLink className="w-4 h-4" /> {t('main.openWithDefaultApp')}
          </button>

          <button onClick={handleToggleSelectMode} className="ml-2 p-2 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Tag Edit Modal */}
      {isTagPromptOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center animate-in fade-in">
          <div className="bg-neutral-800 border border-neutral-700 p-6 rounded-2xl shadow-2xl w-[400px] max-w-[90vw]">
            <h3 className="text-lg font-bold text-neutral-100 mb-2 flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-400" /> {t('tagModal.title', { count: selectedIds.size > 0 ? selectedIds.size : 1 })}
            </h3>
            <p className="text-xs text-neutral-400 mb-4">{t('tagModal.subtitle')}</p>

            <input
              autoFocus
              className="w-full bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-neutral-100 outline-none mb-6"
              placeholder={t('tagModal.placeholder')}
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddTags(); }}
            />

            {recentTags.length > 0 && (
              <div className="mb-6 mb-4 max-h-[150px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                <div className="flex flex-wrap gap-2">
                  {recentTags.map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const activeList = tagInput.split(/[,，\s]+/).filter(t => t.trim() !== "");
                        if (!activeList.includes(tag) && !activeList.includes(tag.replace(/^#/, ''))) {
                          setTagInput(prev => prev ? `${prev}, ${tag}` : tag);
                        }
                      }}
                      className="px-2.5 py-1 bg-neutral-700/50 hover:bg-neutral-600 text-neutral-300 text-xs rounded-lg transition-colors border border-neutral-600/30 font-medium"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setIsTagPromptOpen(false); setTagInput(""); }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition"
              >
                {t('tagModal.cancel')}
              </button>
              <button
                onClick={handleAddTags}
                className="px-6 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50 transition"
              >
                {t('tagModal.saveTags')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About / Info Modal */}
      {isInfoOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center animate-in fade-in">
          <div className="bg-neutral-800/90 border border-neutral-700/50 p-8 rounded-3xl shadow-2xl w-[400px] max-w-[90vw] backdrop-blur-xl relative">
            <button onClick={() => setIsInfoOpen(false)} className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <span className="text-2xl font-bold text-white">PK</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-100 flex items-center justify-center gap-2">
                  Punkcan <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-mono border border-blue-500/20">v{appVersion}</span>
                </h3>
                <p className="text-sm text-neutral-400 mt-1">AI-First Software Architect & Creator</p>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed max-w-[280px]">
                致力于探索 AI Agent 与前端工程的极限。用简洁代码与高级审美，打造具有纯净灵魂的数字体验。
              </p>
              <div className="flex items-center gap-3 mt-2 w-full pt-4 border-t border-neutral-700/50">
                <button onClick={(e) => { e.preventDefault(); openUrl("https://github.com/punkcanyang"); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-black rounded-lg transition-colors border border-neutral-700 hover:border-neutral-500 text-sm font-medium text-neutral-300">
                  <Globe className="w-4 h-4" /> GitHub
                </button>
                <button onClick={(e) => { e.preventDefault(); openUrl("https://x.com/punkcan"); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-black rounded-lg transition-colors border border-neutral-700 hover:border-neutral-500 text-sm font-medium text-neutral-300">
                  <ExternalLink className="w-4 h-4" /> X (Twitter)
                </button>
              </div>
              <div className="text-xs text-neutral-500 mt-2 font-mono">
                Designed & Developed by punkcan © 2026
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center animate-in fade-in">
          <div className="bg-neutral-800 border border-neutral-700 p-6 rounded-2xl shadow-2xl w-[500px] max-w-[90vw]">
            <h3 className="text-lg font-bold text-neutral-100 mb-2 flex items-center gap-2">
              <Settings className="w-5 h-5 text-neutral-400" /> {t('settings.title')}
            </h3>
            <p className="text-xs text-neutral-400 mb-6">{t('settings.subtitle')}</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">{t('settings.interfaceLang')}</label>
                <select
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-neutral-100 outline-none appearance-none cursor-pointer"
                  value={i18n.language}
                  onChange={e => {
                    i18n.changeLanguage(e.target.value);
                    localStorage.setItem('goodphoto_lang', e.target.value);
                  }}
                >
                  <option value="zh-CN">简体中文 (Chinese)</option>
                  <option value="en">English (US)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">{t('settings.provider')}</label>
                <select
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-neutral-100 outline-none appearance-none cursor-pointer"
                  value={tempLlmConfig.activeProvider}
                  onChange={e => setTempLlmConfig({ ...tempLlmConfig, activeProvider: e.target.value as LlmConfig["activeProvider"] })}
                >
                  {LLM_PROVIDER_OPTIONS.map((providerOption) => (
                    <option key={providerOption.id} value={providerOption.id}>
                      {providerOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">{t('settings.modelName')}</label>
                {/* 当该 Provider 有预设模型列表时，显示快速选择下拉框 */}
                {getProviderModels(tempLlmConfig.activeProvider).length > 0 && (
                  <select
                    className="w-full bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-neutral-100 outline-none appearance-none cursor-pointer mb-2"
                    value={
                      // 若当前值在预设清单内则显示对应选项，否则显示「自定义」占位
                      getProviderModels(tempLlmConfig.activeProvider).includes(
                        tempLlmConfig.providers[tempLlmConfig.activeProvider].model
                      )
                        ? tempLlmConfig.providers[tempLlmConfig.activeProvider].model
                        : "__custom__"
                    }
                    onChange={e => {
                      // 选择预设模型时直接写入；「自定义」时不覆盖，让用户在文字框手填
                      if (e.target.value !== "__custom__") {
                        const updated = { ...tempLlmConfig };
                        updated.providers[updated.activeProvider].model = e.target.value;
                        setTempLlmConfig(updated);
                      }
                    }}
                  >
                    {getProviderModels(tempLlmConfig.activeProvider).map((modelId) => (
                      <option key={modelId} value={modelId}>
                        {modelId}
                      </option>
                    ))}
                    <option value="__custom__">✏️ 自定义（手动填写）</option>
                  </select>
                )}
                {/* 文字输入框：允许用户自由填写预设清单之外的任意模型名 */}
                <input
                  type="text"
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-neutral-100 outline-none"
                  placeholder="模型名称，例：gpt-4.5"
                  value={tempLlmConfig.providers[tempLlmConfig.activeProvider].model}
                  onChange={e => {
                    const updated = { ...tempLlmConfig };
                    updated.providers[updated.activeProvider].model = e.target.value;
                    setTempLlmConfig(updated);
                  }}
                />
                <p className="text-xs text-neutral-500 mt-1.5">可从上方快速选择，或直接在此输入任意模型名称</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">{t('settings.apiKey')}</label>
                <input
                  type="password"
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-neutral-100 outline-none"
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={tempLlmConfig.providers[tempLlmConfig.activeProvider].apiKey}
                  onChange={e => {
                    const updated = { ...tempLlmConfig };
                    updated.providers[updated.activeProvider].apiKey = e.target.value;
                    setTempLlmConfig(updated);
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">{t('settings.baseUrl')}</label>
                <input
                  type="text"
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-neutral-100 outline-none"
                  placeholder="https://..."
                  value={tempLlmConfig.providers[tempLlmConfig.activeProvider].baseUrl}
                  onChange={e => {
                    const updated = { ...tempLlmConfig };
                    updated.providers[updated.activeProvider].baseUrl = e.target.value;
                    setTempLlmConfig(updated);
                  }}
                />
              </div>

              <div className="pt-4 border-t border-neutral-700/50 mt-4">
                <h4 className="text-sm font-bold text-neutral-200 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  {t('settings.imageEditing', { defaultValue: '图像修饰与去水印' })}
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-2">Stability AI API Key</label>
                    <input
                      type="password"
                      className="w-full bg-neutral-900 border border-neutral-700 focus:border-purple-500 rounded-xl p-3 text-neutral-100 outline-none"
                      placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                      value={tempLlmConfig.providers.stability?.apiKey || ""}
                      onChange={e => {
                        const updated = { ...tempLlmConfig };
                        if (!updated.providers.stability) {
                          updated.providers.stability = { apiKey: "", baseUrl: "https://api.stability.ai/v2beta/stable-image/edit/erase", model: "erase" };
                        }
                        updated.providers.stability.apiKey = e.target.value;
                        setTempLlmConfig(updated);
                      }}
                    />
                    <p className="text-xs text-neutral-500 mt-2">
                      {t('settings.stabilityHint', { defaultValue: '填写此 Key 后即可激活大图浏览模式下的图片去水印擦除功能。' })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-700/50 mt-4">
                <h4 className="text-sm font-bold text-neutral-200 mb-3 flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-400" />
                  {t("updater.title")}
                </h4>

                {getUpdateStatusKey(updaterState) && (
                  <p className="text-xs text-neutral-400 mb-3">
                    {t(getUpdateStatusKey(updaterState)!, {
                      version: updaterState.version,
                      currentVersion: updaterState.currentVersion,
                      downloadedBytes: updaterState.downloadedBytes ?? 0,
                      contentLength: updaterState.contentLength ?? 0,
                      error: updaterState.error ?? "",
                    })}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (isReadyToInstallUpdate) {
                        void handleInstallUpdate();
                        return;
                      }
                      void handleBackgroundUpdateCheck();
                    }}
                    disabled={
                      updaterState.phase === "checking" ||
                      updaterState.phase === "downloading" ||
                      updaterState.phase === "installing" ||
                      updaterState.phase === "restarting"
                    }
                    className={`px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 ${
                      isReadyToInstallUpdate
                        ? "bg-blue-600 hover:bg-blue-500 text-white"
                        : "bg-neutral-900 border border-neutral-700 text-neutral-200"
                    }`}
                  >
                    {isReadyToInstallUpdate ? t("updater.installNow") : t("updater.checkNow")}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setTempLlmConfig(llmConfig); // re-sync
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition"
              >
                {t('settings.cancel')}
              </button>
              <button
                onClick={() => {
                  setLlmConfig(tempLlmConfig);
                  localStorage.setItem('goodphoto_llm_config', JSON.stringify(tempLlmConfig));
                  setIsSettingsOpen(false);
                }}
                className="px-6 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50 transition"
              >
                {t('settings.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Image Viewer */}
      {enlargedImageId && (
        <div
          className="fixed inset-0 bg-neutral-950/95 z-[100] flex flex-col animate-in fade-in"
          onClick={() => {
            if (!isEraserMode) {
              setEnlargedImageId(null);
            }
          }}
        >
          <div className="flex-1 flex flex-row w-full h-full relative overflow-hidden p-6 gap-6">

            {/* Main Image & Controls Container */}
            <div className={`flex flex-col items-center justify-center relative transition-all duration-300 ${imageCritiques[enlargedImageId] || isCritiquing ? 'w-[65%]' : 'w-full'}`}>

              {/* Close hint */}
              <div className="absolute top-0 right-0 flex items-center gap-2 bg-black/50 text-white px-3 py-1.5 rounded-full backdrop-blur-sm shadow-xl border border-white/10 pointer-events-none z-50">
                {t('viewer.closeHint')} <X className="w-4 h-4 ml-1" />
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEraserMode || isErasing) return;
                  const currentIndex = filteredAndSortedImages.findIndex(img => img.id === enlargedImageId);
                  if (currentIndex !== -1) {
                    const nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredAndSortedImages.length - 1;
                    setEnlargedImageId(filteredAndSortedImages[nextIndex].id);
                    handleFocusFile(filteredAndSortedImages[nextIndex].originalFilePath, filteredAndSortedImages[nextIndex].filename, true, filteredAndSortedImages[nextIndex].id);
                  }
                }}
                disabled={isEraserMode || isErasing}
                className="absolute left-6 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed text-white p-4 rounded-full backdrop-blur-md transition-all z-50 group border border-white/10"
                title={t('viewer.prev')}
              >
                <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEraserMode || isErasing) return;
                  const currentIndex = filteredAndSortedImages.findIndex(img => img.id === enlargedImageId);
                  if (currentIndex !== -1) {
                    const nextIndex = currentIndex < filteredAndSortedImages.length - 1 ? currentIndex + 1 : 0;
                    setEnlargedImageId(filteredAndSortedImages[nextIndex].id);
                    handleFocusFile(filteredAndSortedImages[nextIndex].originalFilePath, filteredAndSortedImages[nextIndex].filename, true, filteredAndSortedImages[nextIndex].id);
                  }
                }}
                disabled={isEraserMode || isErasing}
                className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed text-white p-4 rounded-full backdrop-blur-md transition-all z-50 group border border-white/10"
                title={t('viewer.next')}
              >
                <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Image itself */}
              <div className="relative inline-block max-w-full max-h-[85vh]">
                <img
                  src={images[enlargedImageId]?.compressedBase64}
                  alt="Enlarged"
                  className="max-w-full max-h-[85vh] object-contain drop-shadow-2xl rounded-sm z-10"
                  style={{ pointerEvents: isEraserMode ? 'none' : 'auto' }}
                  onClick={(e) => {
                    if (!isEraserMode) {
                      e.stopPropagation();
                      setEnlargedImageId(null);
                    }
                  }}
                />

                {/* Erase Mask Canvas Overlay */}
                {isEraserMode && (
                  <div
                    className="absolute inset-0 z-20 cursor-crosshair overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => {
                      // Allow changing brush size with mouse wheel
                      e.stopPropagation();
                      setEraserStrokeWidth(prev => Math.max(5, Math.min(100, prev + (e.deltaY > 0 ? -5 : 5))));
                    }}
                  >
                    <ReactSketchCanvas
                      ref={canvasRef}
                      strokeWidth={eraserStrokeWidth}
                      strokeColor="rgba(239, 68, 68, 0.6)" // Red with opacity to see underneath
                      canvasColor="transparent"
                      className="w-full h-full"
                    />

                    {/* Size indicator tooltip */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs backdrop-blur-md pointer-events-none">
                      画笔粗细: {eraserStrokeWidth}px (支持滚轮调节)
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-4 flex flex-col items-center gap-4 z-20 w-full px-8" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  {!isEraserMode ? (
                    <>
                      <button
                        onClick={handleDeepCritique}
                        disabled={isCritiquing}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors backdrop-blur-md border border-blue-500/30 shadow-lg text-sm font-medium"
                      >
                        {isCritiquing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isCritiquing ? t('viewer.critiquing') : (imageCritiques[enlargedImageId] ? t('viewer.regenerateCritique') : t('viewer.getCritique'))}
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); setIsEraserMode(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-xl transition-colors backdrop-blur-md border border-purple-500/30 shadow-lg text-sm font-medium"
                      >
                        <Sparkles className="w-4 h-4" /> {t('viewer.eraseWatermark', { defaultValue: '去水印/杂物' })}
                      </button>

                      <div className="w-px h-4 bg-neutral-600 mx-1"></div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsTagPromptOpen(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-colors backdrop-blur-md border border-neutral-600/50 shadow-lg text-sm font-medium"
                      >
                        <Tag className="w-4 h-4" /> {t('viewer.addTag')}
                      </button>
                      <button
                        onClick={handleModalRemoveImage}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 rounded-xl transition-colors backdrop-blur-md border border-red-500/30 shadow-lg text-sm font-medium"
                      >
                        <X className="w-4 h-4" /> {t('viewer.removePhoto')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); canvasRef.current?.undo(); }}
                        disabled={isErasing}
                        className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800/80 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 rounded-xl transition-colors backdrop-blur-md border border-neutral-600/50 shadow-lg text-sm font-medium"
                      >
                        撤销一笔
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsEraserMode(false); canvasRef.current?.resetCanvas(); }}
                        disabled={isErasing}
                        className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800/80 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 rounded-xl transition-colors backdrop-blur-md border border-neutral-600/50 shadow-lg text-sm font-medium"
                      >
                        <X className="w-4 h-4" /> 取消
                      </button>
                      <button
                        onClick={handleEraseMask}
                        disabled={isErasing}
                        className="flex items-center gap-1.5 px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl transition-colors backdrop-blur-md shadow-lg shadow-purple-900/30 text-sm font-bold"
                      >
                        {isErasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isErasing ? 'AI 魔法擦除中...' : '确认擦除'}
                      </button>
                    </>
                  )}
                </div>

                <div className="text-neutral-400 text-sm font-medium bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5 shadow-md">
                  {images[enlargedImageId]?.filename}
                  <span className="ml-2 opacity-50">
                    ({filteredAndSortedImages.findIndex(img => img.id === enlargedImageId) + 1} / {filteredAndSortedImages.length})
                  </span>
                </div>
              </div>

              {/* AI Critique Panel (if evaluated) - Anchored to Right */}
              {evaluations[enlargedImageId] && (
                <div
                  className="absolute bottom-10 right-8 z-30 bg-black/65 backdrop-blur-xl border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex items-start gap-4 animate-in slide-in-from-right-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`shrink-0 flex items-center justify-center w-14 h-14 rounded-full font-bold text-2xl border-2 shadow-inner ${evaluations[enlargedImageId].score > 70 ? 'bg-green-500/20 text-green-400 border-green-500/40 shadow-green-500/20' : 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-orange-500/20'}`}>
                    {evaluations[enlargedImageId].score}
                  </div>
                  <div className="flex-1 text-[13px] text-neutral-200 leading-relaxed font-medium mt-0.5">
                    <span className="text-white/60 block text-[10px] mb-1.5 uppercase tracking-widest font-extrabold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      大师批判
                    </span>
                    {evaluations[enlargedImageId].reasoning}
                  </div>
                </div>
              )}
              {/* Extracted OCR Data Panel */}
              {evaluations[enlargedImageId]?.extractedData && Object.keys(evaluations[enlargedImageId].extractedData!).length > 0 && (
                <div
                  className="absolute bottom-40 right-8 z-30 bg-neutral-900/90 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-5 max-w-sm w-full shadow-[0_20px_40px_rgba(0,0,0,0.6)] animate-in slide-in-from-right-8 text-neutral-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4 border-b border-neutral-700/50 pb-2">
                    <span className="text-[11px] uppercase tracking-widest font-extrabold flex items-center gap-1.5 text-blue-400">
                      <Tag className="w-3.5 h-3.5" />
                      OCR 解析数据提取 (Extracted)
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(evaluations[enlargedImageId].extractedData, null, 2))}
                      className="text-[10px] bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded text-neutral-400 hover:text-white transition-colors border border-neutral-600"
                      title="复制 JSON 数据"
                    >
                      复制数据
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700">
                    {Object.entries(evaluations[enlargedImageId].extractedData!).map(([key, value]) => (
                      <div key={key} className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{key}</span>
                        <span className="text-[13px] font-medium leading-relaxed bg-black/40 p-2 rounded-lg border border-white/5 break-words">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Critique Panel (Sidebar) */}
            {(imageCritiques[enlargedImageId] || isCritiquing) && (
              <div
                className="w-[35%] h-full bg-neutral-900/80 rounded-2xl flex flex-col border border-neutral-700/50 p-6 shadow-2xl overflow-hidden animate-in slide-in-from-right-10 backdrop-blur-xl z-30 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-6 shrink-0 border-b border-neutral-800 pb-4">
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-100">AI 改进建议</h3>
                    <p className="text-xs text-neutral-500 uppercase tracking-widest">{llmConfig.providers[llmConfig.activeProvider].model}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 scrollbar-track-transparent">
                  {isCritiquing ? (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-5">
                      <Loader2 className="w-12 h-12 animate-spin text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                      <p className="animate-pulse text-sm">大师正在仔细研读照片的光影流光...</p>
                    </div>
                  ) : (
                    <div className="text-neutral-300 text-sm leading-8 whitespace-pre-wrap font-medium">
                      {imageCritiques[enlargedImageId]}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div >
      )
      }

      {/* Custom Profile Modal */}
      {isCustomProfileModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm shadow-2xl" onClick={() => setIsCustomProfileModalOpen(false)} />
          <div className="bg-[#1a1c23] border border-neutral-700 rounded-2xl w-full max-w-2xl overflow-hidden relative shadow-2xl mt-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-black/20">
              <div>
                <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">⚙️ 摄影师审美模型微调 (Custom Aesthetics)</h2>
                <p className="text-sm text-neutral-400 mt-1">完全自定义您的专属摄影流派与大师判图标准。</p>
              </div>
              <button onClick={() => setIsCustomProfileModalOpen(false)} className="text-neutral-400 hover:text-white transition bg-neutral-800/50 hover:bg-neutral-700 p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-neutral-300 mb-2">底层显化人设 (System Prompt)</label>
                <p className="text-xs text-neutral-500 mb-2">在您输入“如：赛博朋克”这种短意图时，这句引子会决定大模型如何将其结构化展开为标准。</p>
                <textarea
                  className="w-full h-24 bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-neutral-100 outline-none resize-none leading-relaxed"
                  value={tempCustomProfile.systemPrompt}
                  onChange={e => setTempCustomProfile({ ...tempCustomProfile, systemPrompt: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-300 mb-2">判图严苛标准参考 (Evaluation Standard)</label>
                <p className="text-xs text-neutral-500 mb-2">在大模型对每张照片进行打分时的死线和美学锚点。</p>
                <textarea
                  className="w-full h-32 bg-neutral-900 border border-neutral-700 focus:border-blue-500 rounded-xl p-3 text-neutral-100 outline-none resize-none leading-relaxed"
                  value={tempCustomProfile.evaluationStandard}
                  onChange={e => setTempCustomProfile({ ...tempCustomProfile, evaluationStandard: e.target.value })}
                />
              </div>
            </div>

            <div className="p-6 border-t border-neutral-800 flex justify-end gap-3 bg-black/20">
              <button
                onClick={() => setIsCustomProfileModalOpen(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setCustomProfile(tempCustomProfile);
                  setActiveProfile(tempCustomProfile);
                  localStorage.setItem('goodphoto_custom_profile', JSON.stringify(tempCustomProfile));
                  localStorage.setItem('goodphoto_active_profile_id', 'custom');
                  setIsCustomProfileModalOpen(false);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-8 rounded-xl shadow-lg shadow-blue-500/20 transition-all"
              >
                保存并使用专属标准
              </button>
            </div>
          </div>
        </div>
      )}

    </div >
  );
}

export default App;

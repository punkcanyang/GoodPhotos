import { ProcessedImage, ImageEvaluationResult } from '../types';
import { mkdir, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';

export interface ProofingGalleryItem {
    id: string;
    filename: string;
    src: string;
    score: number | null;
    isRecommended: boolean;
    reasoning: string | null;
}

export interface ProofingGalleryWriter {
    createDirectory(path: string): Promise<void>;
    writeBinary(path: string, content: Uint8Array): Promise<void>;
    writeText(path: string, content: string): Promise<void>;
}

const DEFAULT_GALLERY_WRITER: ProofingGalleryWriter = {
    createDirectory: (path) => mkdir(path, { recursive: true }),
    writeBinary: (path, content) => writeFile(path, content),
    writeText: (path, content) => writeTextFile(path, content),
};

const IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;

export function parseGalleryImageDataUrl(dataUrl: string): { extension: "jpg" | "png" | "webp"; encoded: string } | null {
    const match = IMAGE_DATA_URL_PATTERN.exec(dataUrl);
    if (!match) return null;
    const extension = match[1] === "image/jpeg" ? "jpg" : match[1].slice("image/".length) as "png" | "webp";
    return { extension, encoded: match[2].replace(/\s/g, "") };
}

export function encodeGalleryData(data: ProofingGalleryItem[]): string {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

export const GALLERY_RUNTIME_JS = `"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const payloadElement = document.getElementById("gallery-data");
    const countDisplay = document.getElementById("count-display");
    const grid = document.getElementById("grid");
    const modal = document.getElementById("modal");
    const modalImg = document.getElementById("modal-img");
    if (!payloadElement || !countDisplay || !grid || !modal || !modalImg) return;

    let data = [];
    try {
        const encoded = payloadElement.getAttribute("data-payload") || "";
        const binary = atob(encoded);
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        const parsed = JSON.parse(new TextDecoder().decode(bytes));
        if (Array.isArray(parsed)) data = parsed;
    } catch (error) {
        console.error("Unable to read gallery data", error);
        return;
    }

    const safeItems = data.filter(item =>
        item &&
        typeof item === "object" &&
        typeof item.src === "string" &&
        /^images\\/image-\\d+\\.(?:jpg|png|webp)$/.test(item.src)
    );
    countDisplay.textContent = String(safeItems.length);

    safeItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";

        const image = document.createElement("img");
        image.src = item.src;
        image.alt = typeof item.filename === "string" ? item.filename : "";
        image.loading = "lazy";

        const content = document.createElement("div");
        content.className = "card-content";

        const filename = document.createElement("h3");
        filename.className = "filename";
        filename.textContent = typeof item.filename === "string" ? item.filename : "";

        const badges = document.createElement("div");
        badges.className = "badges";
        if (typeof item.score === "number" && Number.isFinite(item.score)) {
            const score = document.createElement("span");
            score.className = "badge badge-score";
            score.textContent = String(item.score) + " Score";
            badges.appendChild(score);
        }
        if (item.isRecommended === true) {
            const recommended = document.createElement("span");
            recommended.className = "badge badge-recommend";
            recommended.textContent = "Recommended";
            badges.appendChild(recommended);
        }

        const reasoning = document.createElement("p");
        reasoning.className = "reasoning";
        reasoning.textContent = typeof item.reasoning === "string" ? item.reasoning : "";

        content.append(filename, badges, reasoning);
        card.append(image, content);
        card.addEventListener("click", () => {
            modalImg.src = item.src;
            modal.classList.add("active");
            modal.setAttribute("aria-hidden", "false");
        });
        grid.appendChild(card);
    });

    modal.addEventListener("click", () => {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        modalImg.removeAttribute("src");
    });
});`;

export async function exportProofingGallery(
    imagesIdList: string[],
    images: Record<string, ProcessedImage>,
    evaluations: Record<string, ImageEvaluationResult>,
    targetDir: string,
    writer: ProofingGalleryWriter = DEFAULT_GALLERY_WRITER,
): Promise<number> {
    const imagesPath = `${targetDir}/images`;

    // 1. Create target directories
    try {
        await writer.createDirectory(imagesPath);
    } catch (e: any) {
        throw new Error(`创建目录失败: ${e.toString()}`);
    }

    // 2. Prepare Data Structure and Copy Images
    const galleryData: ProofingGalleryItem[] = [];
    let successCount = 0;

    for (const [position, id] of imagesIdList.entries()) {
        const img = images[id];
        const evalData = evaluations[id];
        if (!img) continue;

        // We save the small compressed copy to keep the gallery loading incredibly fast and purely local
        const imageData = parseGalleryImageDataUrl(img.compressedBase64);
        if (imageData) {
            const binaryString = atob(imageData.encoded);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const fileName = `image-${position + 1}.${imageData.extension}`;
            try {
                await writer.writeBinary(`${imagesPath}/${fileName}`, bytes);
            } catch (e: any) {
                console.error("writeFile error", e);
                // Don't throw, just skip this image instead of aborting the whole gallery
                continue;
            }

            galleryData.push({
                id: id,
                filename: img.filename,
                src: `images/${fileName}`,
                score: evalData ? evalData.score : null,
                isRecommended: evalData ? evalData.isRecommended : false,
                reasoning: evalData ? evalData.reasoning : null
            });
            successCount++;
        }
    }

    // 3. Encode untrusted filenames and model output as inert data.
    // Base64 has no HTML delimiters, so even `</script>` remains non-executable.
    const encodedGalleryData = encodeGalleryData(galleryData);

    // 4. Write index.html. Executable code lives only in the fixed external gallery.js.
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'">
    <title>Client Proofing Gallery</title>
    <style>
        :root { --bg: #0f1115; --card: #1a1d24; --text: #f3f4f6; --text-muted: #9ca3af; --accent: #3b82f6; --success: #10b981; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 2rem; line-height: 1.6; }
        header { text-align: center; margin-bottom: 3rem; }
        h1 { margin: 0 0 0.5rem 0; font-weight: 800; letter-spacing: -0.025em; }
        p.subtitle { color: var(--text-muted); margin: 0; }
        
        .masonry-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
            align-items: start;
        }
        
        .card {
            background: var(--card);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            transition: transform 0.2s;
            position: relative;
            cursor: pointer;
        }
        
        .card:hover { transform: translateY(-4px); }
        
        .card img {
            width: 100%;
            height: auto;
            display: block;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .card-content { padding: 1rem; }
        .filename { font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem 0; word-break: break-all; }
        
        .badges { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
        .badge { padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; }
        .badge-score { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
        .badge-recommend { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
        
        .reasoning { font-size: 0.875rem; color: var(--text-muted); margin: 0; line-height: 1.5; }
        
        /* Modal */
        .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 100; align-items: center; justify-content: center; padding: 2rem; cursor: zoom-out; }
        .modal.active { display: flex; }
        .modal img { max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 4px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    </style>
</head>
<body>
    <header>
        <h1>Selected Gallery</h1>
        <p class="subtitle">AI Curated Collection · <span id="count-display">0</span> Photos</p>
    </header>

    <div class="masonry-grid" id="grid"></div>

    <div class="modal" id="modal" aria-hidden="true">
        <img id="modal-img" alt="Enlarged view">
    </div>

    <div id="gallery-data" hidden data-payload="${encodedGalleryData}"></div>
    <script src="gallery.js" defer></script>
</body>
</html>`;
    try {
        await writer.writeText(`${targetDir}/index.html`, indexHtmlContent);
    } catch (e: any) {
        throw new Error(`写入 index.html 失败: ${e.toString()}`);
    }

    try {
        await writer.writeText(`${targetDir}/gallery.js`, GALLERY_RUNTIME_JS);
    } catch (e: any) {
        throw new Error(`写入 gallery.js 失败: ${e.toString()}`);
    }

    return successCount;
}

// [For Future AI]
// Assumptions: Relying on Base64 -> Uint8Array decoding to physically write `compresedBase64` data out to disk.
// Edge Cases: Existing output directories may retain obsolete files, but index.html only loads the fixed gallery.js.
// Dependencies: Tauri fs runtime scope granted by the directory picker.

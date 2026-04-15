import { ProcessedImage, ImageEvaluationResult } from '../types';
import { invoke } from '@tauri-apps/api/core';

export async function exportProofingGallery(
    imagesIdList: string[],
    images: Record<string, ProcessedImage>,
    evaluations: Record<string, ImageEvaluationResult>,
    targetDir: string
): Promise<number> {
    const imagesPath = `${targetDir}/images`;

    // 1. Create target directories
    try {
        await invoke("create_dir_all", { dirPath: imagesPath });
    } catch (e: any) {
        throw new Error(`创建目录失败: ${e.toString()}`);
    }

    // 2. Prepare Data Structure and Copy Images
    const galleryData = [];
    let successCount = 0;

    for (const id of imagesIdList) {
        const img = images[id];
        const evalData = evaluations[id];
        if (!img) continue;

        // We save the small compressed copy to keep the gallery loading incredibly fast and purely local
        const base64Data = img.compressedBase64.split(',')[1];
        if (base64Data) {
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const fileName = `${id}_${img.filename}`;
            try {
                // In Tauri v2, Uint8Array / ArrayBuffer is automatically mapped to Vec<u8>
                await invoke("write_binary_file", {
                    filePath: `${imagesPath}/${fileName}`,
                    content: Array.from(bytes)
                });
            } catch (e: any) {
                console.error("write_binary_file error", e);
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

    // 3. Write Data JS
    const dataJsContent = `window.GALLERY_DATA = ${JSON.stringify(galleryData, null, 2)};`;
    try {
        await invoke("write_text_file", {
            filePath: `${targetDir}/data.js`,
            content: dataJsContent
        });
    } catch (e: any) {
        throw new Error(`写入 data.js 失败: ${e.toString()}`);
    }

    // 4. Write index.html (The SPA wrapper)
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

    <div class="modal" id="modal">
        <img id="modal-img" src="" alt="Enlarged view">
    </div>

    <!-- Load Data -->
    <script src="data.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const data = window.GALLERY_DATA || [];
            document.getElementById('count-display').textContent = data.length;
            const grid = document.getElementById('grid');
            const modal = document.getElementById('modal');
            const modalImg = document.getElementById('modal-img');

            data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card';
                
                let badgesHtml = '';
                if(item.score) badgesHtml += \`<span class="badge badge-score">\${item.score} Score</span>\`;
                if(item.isRecommended) badgesHtml += \`<span class="badge badge-recommend">Recommended</span>\`;

                card.innerHTML = \`
                    <img src="\${item.src}" alt="\${item.filename}" loading="lazy">
                    <div class="card-content">
                        <h3 class="filename">\${item.filename}</h3>
                        <div class="badges">\${badgesHtml}</div>
                        <p class="reasoning">\${item.reasoning || ''}</p>
                    </div>
                \`;

                card.addEventListener('click', () => {
                    modalImg.src = item.src;
                    modal.classList.add('active');
                });

                grid.appendChild(card);
            });

            modal.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        });
    </script>
</body>
</html>`;
    try {
        await invoke("write_text_file", {
            filePath: `${targetDir}/index.html`,
            content: indexHtmlContent
        });
    } catch (e: any) {
        throw new Error(`写入 index.html 失败: ${e.toString()}`);
    }

    return successCount;
}

// [For Future AI]
// Assumptions: Relying on Base64 -> Uint8Array decoding to physically write `compresedBase64` data out to disk.
// Edge Cases: Folder naming might clash if the user explicitly chooses a non-empty directory. Handled by allowing OS to merge files generally.
// Dependencies: Tauri invoke "create_dir_all" and "write_binary_file".

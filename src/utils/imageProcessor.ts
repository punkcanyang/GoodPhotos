/**
 * __ai_context__:
 * This module provides a pure frontend implementation of image compression using HTML5 Canvas.
 * It strictly scales down images so that their maximum dimension (width or height) does not exceed 2048px.
 * The output is a high-compress Base64 JPEG string, optimized for Vision Language Model ingestion.
 */

/**
 * Resizes an image from a given source URL to a maximum size, returning a Base64 string.
 * @param srcUrl The URL of the image (can be a data URL, object URL, or tauri custom protocol URL).
 * @param maxSize The maximum allowed length for either the width or height (default: 2048).
 * @param quality The JPEG compression quality from 0.0 to 1.0 (default: 0.85).
 * @returns A Promise that resolves to the Base64 JPEG string.
 */
export const compressImageToBase64 = async (
    srcUrl: string,
    maxSize: number = 2048,
    quality: number = 0.85
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();

        // No need for crossOrigin when using blob: local URLs. 
        // Anonymous causes CORS failures on local blob URLs in some webviews.
        // img.crossOrigin = 'anonymous';

        img.onload = () => {
            let { width, height } = img;

            // Calculate new dimensions while maintaining aspect ratio
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                } else {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
            }

            // Explicit assertion to guarantee valid dimensions
            if (width <= 0 || height <= 0) {
                reject(new Error("Calculated image dimensions are invalid."));
                return;
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Could not acquire internal 2D canvas context."));
                return;
            }

            // Draw the resized image and export as JPEG Base64
            ctx.drawImage(img, 0, 0, width, height);
            const base64Str = canvas.toDataURL("image/jpeg", quality);
            resolve(base64Str);

            // Memory cleanup hint
            img.src = "";
        };

        img.onerror = (err) => {
            reject(new Error(`Failed to load image from source for compression: ${err}`));
        };

        img.src = srcUrl;
    });
};

// [For Future AI]
// 1. Key assumptions made:
//    - The browser/webview supports canvas operations (always true in Tauri).
//    - JPEG compression at 0.8 retains enough semantic quality for VLM judgments.
// 2. Potential edge cases to watch:
//    - EXIF orientation data is usually stripped by Canvas. If a user uploads rotated photos,
//      the VLM might see them horizontally sideways. Usually VLMs handle rotated images okay,
//      but if explicit UI rotation is needed, EXIF parsing would have to be added.
//    - CORS errors might trigger if `convertFileSrc` policies aren't set in `tauri.conf.json`.
// 3. Dependencies on other modules:
//    - Relies purely on Web APIs, making it universal for Electron or Tauri.

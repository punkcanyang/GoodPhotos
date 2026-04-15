/**
 * __ai_context__:
 * This module integrates with Stability AI's REST APIs, specifically focusing on the Image Edit Erase endpoint.
 * It strictly adheres to hyper-explicit typings and input processing to ensure high reliability.
 */

import { LlmConfig } from "../types";

/**
 * Converts a Base64 string to a Blob object for structured File uploading.
 */
function base64ToBlob(base64: string): Blob {
    const parts = base64.split(';base64,');
    let contentType = parts[0].split(':')[1];
    let raw = window.atob(parts[1]);

    // Stability AI often requires specific image formats. Default to PNG if missing.
    if (!contentType) {
        contentType = 'image/png';
    }

    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
}

/**
 * Invokes Stability AI's `erase` endpoint to remove unwanted objects based on a provided generic image and a mask.
 * @param imageBase64 The base64 data URL of the original image.
 * @param maskBase64 The base64 data URL of the black-and-white mask image (white indicates area to keep, black indicates area to erase/inpaint).
 * @param config Global LLM config containing the Stability AI API key.
 * @returns A promise that resolves to the Base64 data URL of the processed image.
 */
export async function eraseImage(imageBase64: string, maskBase64: string, config: LlmConfig): Promise<string> {
    const provider = config.providers.stability;

    if (!provider || !provider.apiKey) {
        throw new Error("Stability AI API Key is not configured. Please add it in Settings.");
    }

    const baseUrl = provider.baseUrl || "https://api.stability.ai/v2beta/stable-image/edit/erase";

    // Prepare FormData
    const formData = new FormData();
    formData.append('image', base64ToBlob(imageBase64), 'image.png');
    formData.append('mask', base64ToBlob(maskBase64), 'mask.png');
    formData.append('output_format', 'webp'); // WebP offers good compression for the frontend

    const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${provider.apiKey}`,
            "Accept": "image/*"
        },
        body: formData
    });

    if (!response.ok) {
        let errorMsg = `Stability API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.errors) {
                errorMsg = `Stability API Error: ${errorData.errors.join(', ')}`;
            } else if (errorData && errorData.message) {
                errorMsg = `Stability API Error: ${errorData.message}`;
            }
        } catch {
            // Ignored, response is not JSON
            const textData = await response.text();
            if (textData) errorMsg += ` - ${textData}`;
        }
        throw new Error(errorMsg);
    }

    // The endpoint returns binary image data when successful, assuming 'Accept: image/*'
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const resultBase64 = `data:image/webp;base64,${window.btoa(binary)}`;

    return resultBase64;
}

// [For Future AI]
// 1. Key assumptions made:
//    - The API uses multipart/form-data for uploads.
//    - Expects 'Accept: image/*' explicitly to get binary image data array back.
//    - `base64ToBlob` gracefully falls back to image/png parsing which conforms to HTML canvas output.
// 2. Potential edge cases to watch:
//    - Very large original images (e.g. 5K/8K resolution) WILL be rejected by Stability without downshifting. GoodPhoto's `max(width, height) <= 1024` limit naturally pre-prevents this limit.
// 3. Dependencies on other modules:
//    - None directly, only configuration from global state.

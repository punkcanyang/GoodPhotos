/**
 * __ai_context__:
 * This module integrates with Stability AI's REST APIs, specifically focusing on the Image Edit Erase endpoint.
 * It strictly adheres to hyper-explicit typings and input processing to ensure high reliability.
 */

import { LlmConfig } from "../types";
import { invoke } from "@tauri-apps/api/core";

/**
 * Invokes Stability AI's `erase` endpoint to remove unwanted objects based on a provided generic image and a mask.
 * @param imageBase64 The base64 data URL of the original image.
 * @param maskBase64 The base64 data URL of the black-and-white mask image (white indicates area to keep, black indicates area to erase/inpaint).
 * @param config Global LLM config containing the Stability AI API key.
 * @returns A promise that resolves to the Base64 data URL of the processed image.
 */
export async function eraseImage(imageBase64: string, maskBase64: string, config: LlmConfig): Promise<string> {
    const provider = config.providers.stability;

    if (!provider || !provider.hasCredential) {
        throw new Error("Stability AI API Key is not configured. Please add it in Settings.");
    }

    const baseUrl = provider.baseUrl || "https://api.stability.ai/v2beta/stable-image/edit/erase";

    return invoke<string>("erase_image", {
        imageBase64,
        maskBase64,
        baseUrl,
    });
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

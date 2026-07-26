use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use url::Url;

use crate::credentials;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    status: u16,
    status_text: String,
    body: String,
    headers: HashMap<String, String>,
}

fn validate_endpoint(raw_url: &str) -> Result<Url, String> {
    let url = Url::parse(raw_url).map_err(|error| format!("API 網址無效：{error}"))?;
    let secure = url.scheme() == "https";
    let loopback_http =
        url.scheme() == "http" && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    if !secure && !loopback_http {
        return Err("API 網址必須使用 HTTPS；本機 localhost 服務可使用 HTTP".into());
    }
    Ok(url)
}

#[tauri::command]
pub async fn provider_http_request(
    provider: String,
    url: String,
    body: Value,
) -> Result<HttpResponse, String> {
    let credential = credentials::get(&provider)?;
    let mut endpoint = validate_endpoint(&url)?;
    if endpoint.origin().ascii_serialization() != credential.allowed_origin {
        return Err("請求目的地主機與此 API 金鑰綁定的主機不一致".into());
    }
    if provider == "gemini" {
        endpoint
            .query_pairs_mut()
            .append_pair("key", &credential.api_key);
    }

    let client = reqwest::Client::new();
    let mut request = client
        .post(endpoint)
        .header(CONTENT_TYPE, "application/json")
        .json(&body);
    if provider != "gemini" {
        request = request.header(AUTHORIZATION, format!("Bearer {}", credential.api_key));
    }
    let response = request
        .send()
        .await
        .map_err(|error| format!("API 請求失敗：{}", error.without_url()))?;
    let status = response.status();
    let mut headers = HashMap::new();
    for name in [
        "retry-after",
        "x-ratelimit-reset-tokens",
        "x-ratelimit-remaining-tokens",
    ] {
        if let Some(value) = response
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
        {
            headers.insert(name.to_string(), value.to_string());
        }
    }
    let body = response
        .text()
        .await
        .map_err(|error| format!("無法讀取 API 回應：{error}"))?;
    Ok(HttpResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        body,
        headers,
    })
}

fn decode_data_url(value: &str) -> Result<(String, Vec<u8>), String> {
    let (metadata, encoded) = value
        .split_once(",")
        .ok_or_else(|| "圖片資料格式無效".to_string())?;
    let mime = metadata
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
        .unwrap_or("image/png")
        .to_string();
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|error| format!("圖片 Base64 無效：{error}"))?;
    Ok((mime, bytes))
}

#[tauri::command]
pub async fn erase_image(
    image_base64: String,
    mask_base64: String,
    base_url: String,
) -> Result<String, String> {
    let credential = credentials::get("stability")?;
    let endpoint = validate_endpoint(&base_url)?;
    if endpoint.origin().ascii_serialization() != credential.allowed_origin {
        return Err("請求目的地主機與 Stability API 金鑰綁定的主機不一致".into());
    }
    let (image_mime, image) = decode_data_url(&image_base64)?;
    let (mask_mime, mask) = decode_data_url(&mask_base64)?;
    let image_part = reqwest::multipart::Part::bytes(image)
        .file_name("image.png")
        .mime_str(&image_mime)
        .map_err(|error| error.to_string())?;
    let mask_part = reqwest::multipart::Part::bytes(mask)
        .file_name("mask.png")
        .mime_str(&mask_mime)
        .map_err(|error| error.to_string())?;
    let form = reqwest::multipart::Form::new()
        .part("image", image_part)
        .part("mask", mask_part)
        .text("output_format", "webp");

    let response = reqwest::Client::new()
        .post(endpoint)
        .header(AUTHORIZATION, format!("Bearer {}", credential.api_key))
        .header(ACCEPT, "image/*")
        .multipart(form)
        .send()
        .await
        .map_err(|error| format!("Stability API 請求失敗：{error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Stability API 錯誤：{status} {body}"));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("無法讀取 Stability 圖片：{error}"))?;
    Ok(format!("data:image/webp;base64,{}", STANDARD.encode(bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_https_and_loopback_http_only() {
        assert!(validate_endpoint("https://api.example.com/v1").is_ok());
        assert!(validate_endpoint("http://localhost:8080/v1").is_ok());
        assert!(validate_endpoint("http://127.0.0.1:8080/v1").is_ok());
        assert!(validate_endpoint("http://example.com/v1").is_err());
        assert!(validate_endpoint("file:///tmp/key").is_err());
    }
}

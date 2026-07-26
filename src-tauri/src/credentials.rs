use keyring::{Entry, Error};
use serde::{Deserialize, Serialize};
use url::Url;

const SERVICE: &str = "com.punkcan.GoodPhoto.api-key";
const PROVIDERS: &[&str] = &[
    "qwen",
    "openai",
    "openrouter",
    "siliconflow",
    "together",
    "groq",
    "gemini",
    "deepseek",
    "zhipu",
    "doubao",
    "mistral",
    "stability",
];

fn validate_provider(provider: &str) -> Result<(), String> {
    if PROVIDERS.contains(&provider) {
        Ok(())
    } else {
        Err("不支援的 API 供應商".into())
    }
}

fn entry(provider: &str) -> Result<Entry, String> {
    validate_provider(provider)?;
    Entry::new(SERVICE, provider).map_err(|error| format!("無法存取系統憑證庫：{error}"))
}

#[derive(Deserialize, Serialize)]
pub(crate) struct StoredCredential {
    pub(crate) api_key: String,
    pub(crate) allowed_origin: String,
}

fn endpoint_origin(raw_url: &str) -> Result<String, String> {
    let url = Url::parse(raw_url).map_err(|error| format!("API 網址無效：{error}"))?;
    let secure = url.scheme() == "https";
    let loopback_http =
        url.scheme() == "http" && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    if !secure && !loopback_http {
        return Err("API 網址必須使用 HTTPS；本機 localhost 服務可使用 HTTP".into());
    }
    Ok(url.origin().ascii_serialization())
}

pub(crate) fn get(provider: &str) -> Result<StoredCredential, String> {
    let stored = entry(provider)?
        .get_password()
        .map_err(|error| match error {
            Error::NoEntry => format!("{provider} 尚未設定 API 金鑰"),
            _ => format!("無法讀取系統憑證庫：{error}"),
        })?;
    serde_json::from_str(&stored)
        .map_err(|_| format!("{provider} 的舊憑證尚未綁定 API 主機，請在設定中重新輸入金鑰"))
}

#[tauri::command]
pub fn api_key_status(provider: String) -> Result<bool, String> {
    match entry(&provider)?.get_password() {
        Ok(value) => Ok(!value.is_empty()),
        Err(Error::NoEntry) => Ok(false),
        Err(error) => Err(format!("無法讀取系統憑證庫：{error}")),
    }
}

#[tauri::command]
pub fn store_api_key(provider: String, api_key: String, allowed_url: String) -> Result<(), String> {
    let value = api_key.trim();
    if value.is_empty() {
        return Err("API 金鑰不可為空白".into());
    }
    let stored = StoredCredential {
        api_key: value.to_string(),
        allowed_origin: endpoint_origin(&allowed_url)?,
    };
    let serialized =
        serde_json::to_string(&stored).map_err(|error| format!("無法編碼系統憑證：{error}"))?;
    entry(&provider)?
        .set_password(&serialized)
        .map_err(|error| format!("無法寫入系統憑證庫：{error}"))
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    match entry(&provider)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("無法刪除系統憑證：{error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_binding_keeps_only_a_valid_origin() {
        assert_eq!(
            endpoint_origin("https://api.example.com/v1/chat?ignored=yes").unwrap(),
            "https://api.example.com"
        );
        assert_eq!(
            endpoint_origin("http://localhost:8080/v1").unwrap(),
            "http://localhost:8080"
        );
        assert!(endpoint_origin("http://example.com/v1").is_err());
        assert!(endpoint_origin("file:///tmp/key").is_err());
    }
}

mod credentials;
mod network;
mod xmp;

use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_fs::FsExt;

fn ensure_scoped(app: &AppHandle, file_path: &str) -> Result<(), String> {
    if app.fs_scope().is_allowed(Path::new(file_path)) {
        Ok(())
    } else {
        Err("此檔案不在使用者透過檔案對話框授權的範圍內".into())
    }
}

#[tauri::command]
async fn set_macos_file_tags(
    app: AppHandle,
    file_path: String,
    tags: Vec<String>,
) -> Result<(), String> {
    ensure_scoped(&app, &file_path)?;
    #[cfg(target_os = "macos")]
    {
        // For macOS Finder tags, we write an array to `com.apple.metadata:_kMDItemUserTags`
        // the payload must be a binary plist format.
        let mut plist_bytes = Vec::new();
        plist::to_writer_binary(&mut plist_bytes, &tags)
            .map_err(|e| format!("Failed to encode tags to plist: {}", e))?;

        xattr::set(
            &file_path,
            "com.apple.metadata:_kMDItemUserTags",
            &plist_bytes,
        )
        .map_err(|e| format!("Failed to set xattr for file tags: {}", e))?;

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        // No-op for windows/linux
        println!(
            "Skipping set_macos_file_tags on non-macOS system for: {}",
            file_path
        );
        Ok(())
    }
}

#[tauri::command]
async fn get_macos_file_tags(app: AppHandle, file_path: String) -> Result<Vec<String>, String> {
    ensure_scoped(&app, &file_path)?;
    #[cfg(target_os = "macos")]
    {
        let plist_bytes = xattr::get(&file_path, "com.apple.metadata:_kMDItemUserTags")
            .map_err(|e| format!("Failed to read xattr: {}", e))?;

        if let Some(bytes) = plist_bytes {
            let tags: Vec<String> =
                plist::from_bytes(&bytes).map_err(|e| format!("Failed to decode plist: {}", e))?;
            return Ok(tags);
        }

        Ok(Vec::new())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
async fn write_xmp_rating(
    app: AppHandle,
    original_file_path: String,
    score: f64,
) -> Result<String, String> {
    ensure_scoped(&app, &original_file_path)?;
    xmp::write_rating(Path::new(&original_file_path), score)
        .map(|path| path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(
                tauri_plugin_updater::Builder::new()
                    .pubkey(include_str!("../updater.pubkey").trim().to_owned())
                    .build(),
            )?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_macos_file_tags,
            get_macos_file_tags,
            write_xmp_rating,
            credentials::api_key_status,
            credentials::store_api_key,
            credentials::delete_api_key,
            network::provider_http_request,
            network::erase_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn set_macos_file_tags(file_path: String, tags: Vec<String>) -> Result<(), String> {
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
async fn get_macos_file_tags(file_path: String) -> Result<Vec<String>, String> {
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
async fn read_file_bytes(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| format!("Failed to read file on backend: {}", e))
}

#[tauri::command]
async fn write_text_file(file_path: String, content: String) -> Result<(), String> {
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write text file on backend: {}", e))
}

#[tauri::command]
async fn write_binary_file(file_path: String, content: Vec<u8>) -> Result<(), String> {
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write binary file on backend: {}", e))
}

#[tauri::command]
async fn copy_file(from_path: String, to_path: String) -> Result<(), String> {
    std::fs::copy(&from_path, &to_path)
        .map(|_| ())
        .map_err(|e| format!("Failed to copy file on backend: {}", e))
}

#[tauri::command]
async fn create_dir_all(dir_path: String) -> Result<(), String> {
    std::fs::create_dir_all(&dir_path)
        .map_err(|e| format!("Failed to create directory on backend: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
            greet,
            set_macos_file_tags,
            get_macos_file_tags,
            read_file_bytes,
            write_text_file,
            write_binary_file,
            copy_file,
            create_dir_all
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

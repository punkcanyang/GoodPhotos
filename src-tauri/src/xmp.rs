use quick_xml::events::Event;
use quick_xml::Reader;
use regex::Regex;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

fn rating_and_label(score: f64) -> (u8, Option<&'static str>) {
    if score >= 85.0 {
        (5, Some("Green"))
    } else if score >= 70.0 {
        (4, Some("Yellow"))
    } else if score >= 50.0 {
        (3, Some("Blue"))
    } else if score >= 30.0 {
        (2, None)
    } else {
        (1, Some("Red"))
    }
}

fn validate_xmp(xml: &str) -> Result<(), String> {
    let mut reader = Reader::from_str(xml);
    let mut saw_meta = false;
    let mut saw_rdf = false;
    let mut depth = 0usize;

    loop {
        match reader.read_event() {
            Ok(Event::Start(event)) => {
                let name = event.name();
                if name.as_ref() == b"x:xmpmeta" || name.as_ref() == b"xmpmeta" {
                    saw_meta = true;
                }
                if name.as_ref() == b"rdf:RDF" || name.as_ref() == b"RDF" {
                    saw_rdf = true;
                }
                depth += 1;
            }
            Ok(Event::Empty(event)) => {
                let name = event.name();
                if name.as_ref() == b"x:xmpmeta" || name.as_ref() == b"xmpmeta" {
                    saw_meta = true;
                }
                if name.as_ref() == b"rdf:RDF" || name.as_ref() == b"RDF" {
                    saw_rdf = true;
                }
            }
            Ok(Event::End(_)) => depth = depth.saturating_sub(1),
            Ok(Event::Eof) if depth > 0 => {
                return Err("既有 XMP 不是有效的 XML：標籤未完整結束".into())
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(format!("既有 XMP 不是有效的 XML：{error}")),
            _ => {}
        }
    }

    if !saw_meta || !saw_rdf {
        return Err("既有檔案不是可辨識的 Adobe XMP，為避免破壞內容，已略過寫入".into());
    }
    Ok(())
}

fn replace_element(
    xml: &str,
    qualified_name: &str,
    value: Option<&str>,
) -> Result<(String, bool), String> {
    let pattern = format!(
        r"(?s)<{name}(?:\s[^>]*)?>.*?</{name}\s*>",
        name = regex::escape(qualified_name)
    );
    let re = Regex::new(&pattern).map_err(|error| error.to_string())?;
    let found = re.is_match(xml);
    Ok((
        match value {
            Some(value) => re
                .replace_all(xml, format!("<{qualified_name}>{value}</{qualified_name}>"))
                .into_owned(),
            None => re.replace_all(xml, "").into_owned(),
        },
        found,
    ))
}

fn merge_existing_xmp(xml: &str, score: f64) -> Result<String, String> {
    validate_xmp(xml)?;
    let (rating, label) = rating_and_label(score);
    let description_re =
        Regex::new(r"(?s)<rdf:Description\b[^>]*?(?:/>|>.*?</rdf:Description\s*>)")
            .map_err(|error| error.to_string())?;
    let description_match = description_re
        .find_iter(xml)
        .find(|candidate| {
            let value = candidate.as_str();
            value.contains("xmp:Rating") || value.contains("xmp:Label")
        })
        .or_else(|| description_re.find(xml))
        .ok_or_else(|| "既有 XMP 缺少 rdf:Description，為避免破壞內容，已略過寫入".to_string())?;
    let description = description_match.as_str();

    let mut updated = description.to_string();
    if updated.ends_with("/>") {
        updated.truncate(updated.len() - 2);
        updated.push_str("></rdf:Description>");
    }
    if !updated.contains("xmlns:xmp=") && !xml.contains("xmlns:xmp=") {
        updated = updated.replacen(
            "<rdf:Description",
            r#"<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/""#,
            1,
        );
    }

    let rating_double = Regex::new(r#"xmp:Rating\s*=\s*"[^"]*""#).unwrap();
    let rating_single = Regex::new(r#"xmp:Rating\s*=\s*'[^']*'"#).unwrap();
    let has_rating_attribute = rating_double.is_match(&updated) || rating_single.is_match(&updated);
    if has_rating_attribute {
        updated = rating_double
            .replace_all(&updated, format!(r#"xmp:Rating="{rating}""#))
            .into_owned();
        updated = rating_single
            .replace_all(&updated, format!(r#"xmp:Rating="{rating}""#))
            .into_owned();
        (updated, _) = replace_element(&updated, "xmp:Rating", None)?;
    } else {
        let (next, had_rating_element) =
            replace_element(&updated, "xmp:Rating", Some(&rating.to_string()))?;
        updated = next;
        if !had_rating_element {
            updated = updated.replacen(
                "</rdf:Description>",
                &format!("<xmp:Rating>{rating}</xmp:Rating></rdf:Description>"),
                1,
            );
        }
    }

    let label_double = Regex::new(r#"xmp:Label\s*=\s*"[^"]*""#).unwrap();
    let label_single = Regex::new(r#"xmp:Label\s*=\s*'[^']*'"#).unwrap();
    let has_label_attribute = label_double.is_match(&updated) || label_single.is_match(&updated);
    if has_label_attribute {
        if let Some(label) = label {
            updated = label_double
                .replace_all(&updated, format!(r#"xmp:Label="{label}""#))
                .into_owned();
            updated = label_single
                .replace_all(&updated, format!(r#"xmp:Label="{label}""#))
                .into_owned();
        } else {
            updated = label_double.replace_all(&updated, "").into_owned();
            updated = label_single.replace_all(&updated, "").into_owned();
        }
        (updated, _) = replace_element(&updated, "xmp:Label", None)?;
    } else {
        let (next, had_label_element) = replace_element(&updated, "xmp:Label", label)?;
        updated = next;
        if let Some(value) = label.filter(|_| !had_label_element) {
            updated = updated.replacen(
                "</rdf:Description>",
                &format!("<xmp:Label>{value}</xmp:Label></rdf:Description>"),
                1,
            );
        }
    }

    Ok(format!(
        "{}{}{}",
        &xml[..description_match.start()],
        updated,
        &xml[description_match.end()..]
    ))
}

fn new_xmp(score: f64) -> String {
    let (rating, label) = rating_and_label(score);
    let label_xml = label
        .map(|value| format!("\n   <xmp:Label>{value}</xmp:Label>"))
        .unwrap_or_default();
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="GoodPhoto">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:Rating>{rating}</xmp:Rating>{label_xml}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>"#
    )
}

fn sidecar_path(original: &Path) -> PathBuf {
    original.with_extension("xmp")
}

pub fn write_rating(original: &Path, score: f64) -> Result<PathBuf, String> {
    let sidecar = sidecar_path(original);
    if fs::metadata(&sidecar)
        .map(|metadata| metadata.permissions().readonly())
        .unwrap_or(false)
    {
        return Err("既有 XMP 是唯讀檔，為避免違反檔案保護設定，已略過寫入".into());
    }
    let existing = if sidecar.exists() {
        Some(fs::read_to_string(&sidecar).map_err(|error| format!("無法讀取既有 XMP：{error}"))?)
    } else {
        None
    };
    let content = match existing {
        Some(existing) => merge_existing_xmp(&existing, score)?,
        None => new_xmp(score),
    };

    let file_name = sidecar
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "XMP 路徑無效".to_string())?;
    let temp_path =
        sidecar.with_file_name(format!(".{file_name}.goodphoto.{}.tmp", std::process::id()));
    let permissions = fs::metadata(&sidecar).ok().map(|meta| meta.permissions());
    let mut temp = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temp_path)
        .map_err(|error| format!("無法建立 XMP 暫存檔：{error}"))?;
    let write_result = (|| -> Result<(), String> {
        temp.write_all(content.as_bytes())
            .map_err(|error| format!("無法寫入 XMP 暫存檔：{error}"))?;
        temp.sync_all()
            .map_err(|error| format!("無法同步 XMP 暫存檔：{error}"))?;
        if let Some(permissions) = permissions {
            fs::set_permissions(&temp_path, permissions)
                .map_err(|error| format!("無法保留 XMP 權限：{error}"))?;
        }
        fs::rename(&temp_path, &sidecar).map_err(|error| format!("無法替換 XMP：{error}"))
    })();
    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    write_result?;
    Ok(sidecar)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("goodphoto-xmp-test-{nonce}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn creates_new_xmp_with_expected_rating() {
        let xml = new_xmp(88.0);
        assert!(xml.contains("<xmp:Rating>5</xmp:Rating>"));
        assert!(xml.contains("<xmp:Label>Green</xmp:Label>"));
        validate_xmp(&xml).unwrap();
    }

    #[test]
    fn preserves_unrelated_lightroom_fields() {
        let original = r#"<?xml version="1.0"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"><crs:Exposure2012>0.35</crs:Exposure2012><xmp:Rating>2</xmp:Rating></rdf:Description></rdf:RDF></x:xmpmeta>"#;
        let merged = merge_existing_xmp(original, 92.0).unwrap();
        assert!(merged.contains("<crs:Exposure2012>0.35</crs:Exposure2012>"));
        assert!(merged.contains("<xmp:Rating>5</xmp:Rating>"));
        assert!(merged.contains("<xmp:Label>Green</xmp:Label>"));
    }

    #[test]
    fn updates_attribute_form_without_duplicate_elements() {
        let original = r#"<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:Rating="1" xmp:Label="Red"/></rdf:RDF></x:xmpmeta>"#;
        let merged = merge_existing_xmp(original, 72.0).unwrap();
        assert!(merged.contains(r#"xmp:Rating="4""#));
        assert!(merged.contains(r#"xmp:Label="Yellow""#));
        assert!(!merged.contains("<xmp:Rating>"));
    }

    #[test]
    fn rejects_invalid_xml_without_trying_to_repair_it() {
        let error = merge_existing_xmp("<x:xmpmeta><rdf:RDF>", 80.0).unwrap_err();
        assert!(error.contains("不是有效的 XML"));
    }

    #[test]
    fn corrupt_sidecar_is_left_byte_for_byte_unchanged() {
        let dir = test_dir();
        let original = dir.join("photo.jpg");
        let sidecar = dir.join("photo.xmp");
        fs::write(&original, b"image").unwrap();
        fs::write(&sidecar, b"<broken>").unwrap();
        assert!(write_rating(&original, 90.0).is_err());
        assert_eq!(fs::read(&sidecar).unwrap(), b"<broken>");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn readonly_sidecar_is_not_replaced() {
        let dir = test_dir();
        let original = dir.join("photo.jpg");
        let sidecar = dir.join("photo.xmp");
        fs::write(&original, b"image").unwrap();
        fs::write(&sidecar, new_xmp(10.0)).unwrap();
        let original_permissions = fs::metadata(&sidecar).unwrap().permissions();
        let mut permissions = original_permissions.clone();
        permissions.set_readonly(true);
        fs::set_permissions(&sidecar, permissions).unwrap();
        assert!(write_rating(&original, 90.0).unwrap_err().contains("唯讀"));
        fs::set_permissions(&sidecar, original_permissions).unwrap();
        fs::remove_dir_all(dir).unwrap();
    }
}

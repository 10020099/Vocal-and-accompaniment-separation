use std::path::PathBuf;

use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Multipart, Path, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Json, Response};
use axum::routing::{get, post};
use axum::Router;
use serde::Deserialize;
use serde_json::json;
use tokio::io::AsyncWriteExt;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::separate;

#[derive(Clone)]
pub struct AppState {
    pub uploads_dir: PathBuf,
    pub outputs_dir: PathBuf,
}

pub async fn start_server(port: u16) {
    match separate::ensure_ffmpeg_available().await {
        Ok(()) => println!("✓ FFmpeg 检测成功"),
        Err(msg) => {
            eprintln!("✗ FFmpeg 检测失败: {msg}");
            eprintln!("请安装 FFmpeg 并确保其在系统 PATH 中可用。");
            std::process::exit(1);
        }
    }

    let uploads_dir = PathBuf::from("uploads");
    let outputs_dir = PathBuf::from("outputs");
    tokio::fs::create_dir_all(&uploads_dir).await.ok();
    tokio::fs::create_dir_all(&outputs_dir).await.ok();

    let state = AppState {
        uploads_dir,
        outputs_dir,
    };

    let app = Router::new()
        .route("/api/formats", get(get_formats))
        .route("/api/upload", post(upload_file))
        .route("/api/separate", post(separate_handler))
        .route("/api/download/{filename}", get(download_file))
        .layer(DefaultBodyLimit::max(500 * 1024 * 1024))
        .layer(CorsLayer::permissive())
        .fallback_service(ServeDir::new("public"))
        .with_state(state);

    println!();
    println!("═══════════════════════════════════════════════════════════");
    println!("  人声与伴奏分离工具 - WEB 应用服务器");
    println!("═══════════════════════════════════════════════════════════");
    println!();
    println!("  ► 服务器地址: http://localhost:{port}");
    println!("  ► 按 Ctrl+C 停止服务器");
    println!();
    println!("═══════════════════════════════════════════════════════════");

    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn get_formats() -> Json<serde_json::Value> {
    Json(json!({
        "success": true,
        "formats": separate::supported_formats(),
    }))
}

const ALLOWED_EXTS: [&str; 6] = ["wav", "mp3", "flac", "ogg", "aac", "m4a"];

async fn upload_file(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Response {
    while let Ok(Some(mut field)) = multipart.next_field().await {
        if field.name() != Some("audio") {
            continue;
        }

        let original_name = field.file_name().unwrap_or("unknown").to_string();

        let ext = std::path::Path::new(&original_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !ALLOWED_EXTS.contains(&ext.as_str()) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "success": false, "message": "不支持的文件格式" })),
            )
                .into_response();
        }

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let unique_id = uuid::Uuid::new_v4();
        let filename = format!("{timestamp}-{unique_id}-{original_name}");
        let file_path = state.uploads_dir.join(&filename);

        let mut file = match tokio::fs::File::create(&file_path).await {
            Ok(f) => f,
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "success": false, "message": "创建文件失败" })),
                )
                    .into_response()
            }
        };

        let mut size: u64 = 0;
        while let Ok(Some(chunk)) = field.chunk().await {
            size += chunk.len() as u64;
            if file.write_all(&chunk).await.is_err() {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "success": false, "message": "写入文件失败" })),
                )
                    .into_response();
            }
        }

        return Json(json!({
            "success": true,
            "file": {
                "filename": filename,
                "originalName": original_name,
                "path": file_path.to_string_lossy(),
                "size": size,
            }
        }))
        .into_response();
    }

    (
        StatusCode::BAD_REQUEST,
        Json(json!({ "success": false, "message": "未上传文件" })),
    )
        .into_response()
}

#[derive(Deserialize)]
struct SeparateRequest {
    filename: String,
    #[serde(default = "default_format")]
    format: String,
}

fn default_format() -> String {
    "wav".into()
}

async fn separate_handler(
    State(state): State<AppState>,
    Json(req): Json<SeparateRequest>,
) -> Response {
    if req.filename.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "message": "缺少文件名参数" })),
        )
            .into_response();
    }

    let input_path = state.uploads_dir.join(&req.filename);
    if !input_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "success": false, "message": "找不到上传的文件" })),
        )
            .into_response();
    }

    match separate::separate_audio(&input_path, &state.outputs_dir, &req.format).await {
        Ok(result) => {
            let instrumental_filename = result
                .instrumental_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let vocal_filename = result
                .vocal_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            Json(json!({
                "success": true,
                "result": {
                    "instrumental": format!("/api/download/{instrumental_filename}"),
                    "vocal": format!("/api/download/{vocal_filename}"),
                    "instrumentalFilename": instrumental_filename,
                    "vocalFilename": vocal_filename,
                }
            }))
            .into_response()
        }
        Err(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "success": false, "message": msg })),
        )
            .into_response(),
    }
}

async fn download_file(
    State(state): State<AppState>,
    Path(filename): Path<String>,
) -> Response {
    let file_path = state.outputs_dir.join(&filename);
    if !file_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "success": false, "message": "文件不存在" })),
        )
            .into_response();
    }

    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("wav");
    let mime = separate::get_mime_for_ext(ext);

    match tokio::fs::read(&file_path).await {
        Ok(data) => Response::builder()
            .header(header::CONTENT_TYPE, mime)
            .header(
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{filename}\""),
            )
            .body(Body::from(data))
            .unwrap(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "success": false, "message": "读取文件失败" })),
        )
            .into_response(),
    }
}

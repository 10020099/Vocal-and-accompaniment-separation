use std::path::PathBuf;

use crate::separate;

pub async fn run_cli(input: PathBuf, out_dir: PathBuf, format: String) {
    let format = if separate::supported_formats().contains(&format.as_str()) {
        format
    } else {
        eprintln!("不支持的输出格式 {format}, 已回退为 wav。");
        "wav".into()
    };

    if let Err(msg) = separate::ensure_ffmpeg_available().await {
        eprintln!("{msg}");
        std::process::exit(1);
    }

    if !input.exists() {
        eprintln!("找不到输入文件: {}", input.display());
        std::process::exit(1);
    }

    println!("开始处理...");
    match separate::separate_audio(&input, &out_dir, &format).await {
        Ok(result) => {
            println!("伴奏已输出: {}", result.instrumental_path.display());
            println!("人声已输出: {}", result.vocal_path.display());
        }
        Err(msg) => {
            eprintln!("处理失败: {msg}");
            std::process::exit(1);
        }
    }
}

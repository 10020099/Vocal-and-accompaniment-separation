use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::process::Command;

pub struct CodecInfo {
    pub codec: &'static str,
    pub extra: &'static [&'static str],
    pub mime: &'static str,
}

pub fn codec_map() -> HashMap<&'static str, CodecInfo> {
    HashMap::from([
        ("wav", CodecInfo { codec: "pcm_s16le", extra: &[], mime: "audio/wav" }),
        ("flac", CodecInfo { codec: "flac", extra: &[], mime: "audio/flac" }),
        ("mp3", CodecInfo { codec: "libmp3lame", extra: &["-b:a", "192k"], mime: "audio/mpeg" }),
        ("ogg", CodecInfo { codec: "libvorbis", extra: &["-q:a", "5"], mime: "audio/ogg" }),
        ("aac", CodecInfo { codec: "aac", extra: &["-b:a", "192k"], mime: "audio/aac" }),
        ("m4a", CodecInfo { codec: "aac", extra: &["-b:a", "192k"], mime: "audio/mp4" }),
    ])
}

pub fn supported_formats() -> Vec<&'static str> {
    vec!["wav", "flac", "mp3", "ogg", "aac", "m4a"]
}

pub fn get_mime_for_ext(ext: &str) -> &'static str {
    match ext {
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "aac" => "audio/aac",
        "m4a" => "audio/mp4",
        _ => "application/octet-stream",
    }
}

struct CompressorConfig {
    threshold: i32,
    ratio: u32,
    attack: u32,
    release: u32,
}

struct GateConfig {
    threshold: i32,
    ratio: u32,
    attack: u32,
    release: u32,
}

struct EqConfig {
    enabled: bool,
    f: u32,
    width: u32,
    gain: i32,
}

struct VocalConfig {
    highpass: u32,
    lowpass: u32,
    compressor: CompressorConfig,
}

struct InstrumentalConfig {
    gate: GateConfig,
    compressor: CompressorConfig,
    eq: EqConfig,
}

struct SeparateConfig {
    vocal: VocalConfig,
    instrumental: InstrumentalConfig,
}

impl Default for SeparateConfig {
    fn default() -> Self {
        Self {
            vocal: VocalConfig {
                highpass: 80,
                lowpass: 8000,
                compressor: CompressorConfig {
                    threshold: -20,
                    ratio: 4,
                    attack: 5,
                    release: 50,
                },
            },
            instrumental: InstrumentalConfig {
                gate: GateConfig {
                    threshold: -60,
                    ratio: 2,
                    attack: 5,
                    release: 50,
                },
                compressor: CompressorConfig {
                    threshold: -12,
                    ratio: 2,
                    attack: 5,
                    release: 50,
                },
                eq: EqConfig {
                    enabled: true,
                    f: 1000,
                    width: 1,
                    gain: -2,
                },
            },
        }
    }
}

fn build_vocal_filter(config: &SeparateConfig) -> String {
    let pan = "pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1";
    let highpass = format!("highpass=f={}", config.vocal.highpass);
    let lowpass = format!("lowpass=f={}", config.vocal.lowpass);
    let c = &config.vocal.compressor;
    let compressor = format!(
        "acompressor=threshold={}dB:ratio={}:attack={}:release={}",
        c.threshold, c.ratio, c.attack, c.release
    );
    format!("{pan},{highpass},{lowpass},{compressor}")
}

fn build_instrumental_filter(config: &SeparateConfig) -> String {
    let pan = "pan=stereo|c0=c0-c1|c1=c1-c0";
    let g = &config.instrumental.gate;
    let gate = format!(
        "agate=threshold={}dB:ratio={}:attack={}:release={}",
        g.threshold, g.ratio, g.attack, g.release
    );
    let c = &config.instrumental.compressor;
    let compressor = format!(
        "acompressor=threshold={}dB:ratio={}:attack={}:release={}",
        c.threshold, c.ratio, c.attack, c.release
    );
    let mut chain = format!("{pan},{gate},{compressor}");
    if config.instrumental.eq.enabled {
        let e = &config.instrumental.eq;
        chain += &format!(",equalizer=f={}:t=q:w={}:g={}", e.f, e.width, e.gain);
    }
    chain
}

pub async fn ensure_ffmpeg_available() -> Result<(), String> {
    let result = Command::new("ffmpeg").arg("-version").output().await;
    match result {
        Ok(output) if output.status.success() => Ok(()),
        _ => Err("未检测到 FFmpeg, 请先在系统中安装并配置到 PATH。".into()),
    }
}

async fn run_ffmpeg(args: &[String]) -> Result<(), String> {
    let status = Command::new("ffmpeg")
        .args(args)
        .status()
        .await
        .map_err(|e| format!("FFmpeg 启动失败: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "FFmpeg 执行失败, 退出码 {}",
            status.code().unwrap_or(-1)
        ))
    }
}

pub struct SeparateResult {
    pub instrumental_path: PathBuf,
    pub vocal_path: PathBuf,
    pub out_dir: PathBuf,
}

pub async fn separate_audio(
    input: &Path,
    out_dir: &Path,
    format: &str,
) -> Result<SeparateResult, String> {
    if !input.exists() {
        return Err(format!("找不到输入文件: {}", input.display()));
    }

    if !out_dir.exists() {
        std::fs::create_dir_all(out_dir).map_err(|e| format!("创建输出目录失败: {e}"))?;
    }

    let config = SeparateConfig::default();
    let codecs = codec_map();
    let target = codecs
        .get(format)
        .unwrap_or_else(|| codecs.get("wav").unwrap());

    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");

    let instrumental_path = out_dir.join(format!("{stem}_instrumental.{format}"));
    let vocal_path = out_dir.join(format!("{stem}_vocals.{format}"));

    let instrumental_filter = build_instrumental_filter(&config);
    let vocal_filter = build_vocal_filter(&config);

    let build_args = |filter: String, output: &Path| -> Vec<String> {
        let mut args = vec![
            "-i".into(),
            input.to_string_lossy().into_owned(),
            "-y".into(),
            "-ac".into(),
            "2".into(),
            "-filter_complex".into(),
            filter,
            "-c:a".into(),
            target.codec.into(),
        ];
        for &extra in target.extra {
            args.push(extra.into());
        }
        args.push(output.to_string_lossy().into_owned());
        args
    };

    run_ffmpeg(&build_args(instrumental_filter, &instrumental_path)).await?;
    run_ffmpeg(&build_args(vocal_filter, &vocal_path)).await?;

    Ok(SeparateResult {
        instrumental_path,
        vocal_path,
        out_dir: out_dir.to_path_buf(),
    })
}

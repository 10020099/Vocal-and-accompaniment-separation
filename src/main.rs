mod cli;
mod separate;
mod server;

use std::path::PathBuf;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "vocal-split")]
#[command(about = "基于 FFmpeg 的人声与伴奏分离工具")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// 启动 Web 服务器
    Serve {
        /// 服务器端口号
        #[arg(short, long, default_value_t = 3000)]
        port: u16,
    },
    /// 分离音频文件（CLI 模式）
    Split {
        /// 音频文件路径
        input: PathBuf,
        /// 输出目录
        #[arg(short, long, default_value = "output")]
        out: PathBuf,
        /// 输出格式 (wav, mp3, flac, ogg, aac, m4a)
        #[arg(short, long, default_value = "wav")]
        format: String,
    },
}

#[tokio::main]
async fn main() {
    let args = Cli::parse();
    match args.command {
        Some(Commands::Serve { port }) => {
            server::start_server(port).await;
        }
        Some(Commands::Split { input, out, format }) => {
            cli::run_cli(input, out, format).await;
        }
        None => {
            let port: u16 = std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3000);
            server::start_server(port).await;
        }
    }
}

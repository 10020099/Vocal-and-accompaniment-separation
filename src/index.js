'use strict';

const { existsSync } = require('fs');
const { resolve } = require('path');
const { ensureFfmpegAvailable, separateAudio, codecMap } = require('./separate');

const HELP_TEXT = `\n用法: vocal-split <音频文件路径> [--out <输出目录>] [--format <输出格式>]\n\n描述:\n  调用本地 FFmpeg, 尝试将输入的双声道音频分离成人声与伴奏两份文件。\n\n参数:\n  --out, -o     输出目录(默认: ./output)\n  --format, -f 输出文件格式(默认: wav)\n  --help, -h   显示帮助\n\n示例:\n  vocal-split ./song.mp3\n  vocal-split ./song.mp3 --out ./stems --format flac\n`;

function parseArgs(argv) {
  const args = { input: null, outDir: resolve(process.cwd(), 'output'), format: 'wav', help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!args.input && !token.startsWith('-')) {
      args.input = resolve(process.cwd(), token);
      continue;
    }
    switch (token) {
      case '--out':
      case '-o':
        i += 1;
        args.outDir = argv[i] ? resolve(process.cwd(), argv[i]) : args.outDir;
        break;
      case '--format':
      case '-f':
        i += 1;
        args.format = argv[i] ? String(argv[i]).toLowerCase() : args.format;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        console.warn(`未知参数: ${token}`);
    }
  }
  return args;
}

(async () => {
  const options = parseArgs(process.argv);
  if (options.help || !options.input) {
    console.log(HELP_TEXT);
    return;
  }

  if (!codecMap.has(options.format)) {
    console.warn(`不支持的输出格式 ${options.format}, 已回退为 wav。`);
    options.format = 'wav';
  }

  try {
    await ensureFfmpegAvailable();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  try {
    if (!existsSync(options.input)) {
      throw new Error('找不到输入文件: ' + options.input);
    }

    console.log('开始处理...');
    const { instrumentalPath, vocalPath } = await separateAudio(options);
    console.log(`伴奏已输出: ${instrumentalPath}`);
    console.log(`人声已输出: ${vocalPath}`);
  } catch (err) {
    console.error('处理失败: ' + err.message);
    process.exitCode = 1;
  }
})();

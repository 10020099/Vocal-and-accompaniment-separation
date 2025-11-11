'use strict';

const { spawn } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const { basename, dirname, extname, join } = require('path');

const codecMap = new Map([
  ['wav', { codec: 'pcm_s16le', mime: 'audio/wav' }],
  ['flac', { codec: 'flac', mime: 'audio/flac' }],
  ['mp3', { codec: 'libmp3lame', extra: ['-b:a', '192k'], mime: 'audio/mpeg' }],
  ['ogg', { codec: 'libvorbis', extra: ['-q:a', '5'], mime: 'audio/ogg' }],
  ['aac', { codec: 'aac', extra: ['-b:a', '192k'], mime: 'audio/aac' }],
  ['m4a', { codec: 'aac', extra: ['-b:a', '192k'], mime: 'audio/mp4' }],
]);

function ensureFfmpegAvailable() {
  return new Promise((resolve, reject) => {
    const probe = spawn('ffmpeg', ['-version']);
    probe.once('error', () => {
      reject(new Error('未检测到 FFmpeg, 请先在系统中安装并配置到 PATH。'));
    });
    const onSuccess = () => resolve();
    probe.stdout.once('data', onSuccess);
    probe.stderr.once('data', onSuccess);
  });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg 执行失败, 退出码 ${code}`));
      }
    });
    child.on('error', reject);
  });
}

function buildFfmpegArgs(options, filterExpr, outputPath) {
  const target = codecMap.get(options.format) || codecMap.get('wav');
  const args = [
    '-i', options.input,
    '-y',
    '-ac', '2',
    '-filter_complex', filterExpr,
    '-c:a', target.codec,
  ];
  if (target.extra) {
    args.push(...target.extra);
  }
  args.push(outputPath);
  return args;
}

async function separateAudio({ input, outDir, format = 'wav' }) {
  if (!existsSync(input)) {
    throw new Error('找不到输入文件: ' + input);
  }

  const targetDir = outDir || join(dirname(input), 'output');

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const inputBase = basename(input, extname(input));
  const target = codecMap.get(format) || codecMap.get('wav');
  const instrumentalPath = join(targetDir, `${inputBase}_instrumental.${format}`);
  const vocalPath = join(targetDir, `${inputBase}_vocals.${format}`);

  const instrumentalArgs = buildFfmpegArgs({ input, format }, 'pan=stereo|c0=c0-c1|c1=c1-c0', instrumentalPath);
  const vocalArgs = buildFfmpegArgs({ input, format }, 'pan=stereo|c0=c0+c1|c1=c0+c1', vocalPath);

  await runFfmpeg(instrumentalArgs);
  await runFfmpeg(vocalArgs);

  return {
    instrumentalPath,
    vocalPath,
    mime: target.mime,
    outDir: targetDir,
  };
}

module.exports = {
  ensureFfmpegAvailable,
  separateAudio,
  codecMap,
};

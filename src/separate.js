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

// Default configuration for filters
const defaultConfig = {
  vocal: {
    highpass: 80,
    lowpass: 8000,
    compressor: {
      threshold: -20,
      ratio: 4,
      attack: 5,
      release: 50
    }
  },
  instrumental: {
    gate: {
      threshold: -60,
      ratio: 2,
      attack: 5,
      release: 50
    },
    compressor: {
      threshold: -12,
      ratio: 2,
      attack: 5,
      release: 50
    },
    eq: {
      enabled: true,
      f: 1000,
      width: 1,
      gain: -2
    }
  }
};

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

function buildVocalFilter(config) {
  // 1. Center Extraction (Mono sum for now, effectively center if panned hard L/R are distinct)
  // Using 0.5 to avoid clipping
  const pan = 'pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1';
  
  // 2. Frequency Isolation
  const highpass = `highpass=f=${config.vocal.highpass}`;
  const lowpass = `lowpass=f=${config.vocal.lowpass}`;
  
  // 3. Compressor
  const c = config.vocal.compressor;
  const compressor = `acompressor=threshold=${c.threshold}dB:ratio=${c.ratio}:attack=${c.attack}:release=${c.release}`;
  
  return `${pan},${highpass},${lowpass},${compressor}`;
}

function buildInstrumentalFilter(config) {
  // 1. OOPS (Phase Cancellation)
  const pan = 'pan=stereo|c0=c0-c1|c1=c1-c0';
  
  // 2. Noise Gate
  const g = config.instrumental.gate;
  const gate = `agate=threshold=${g.threshold}dB:ratio=${g.ratio}:attack=${g.attack}:release=${g.release}`;
  
  // 3. Compressor
  const c = config.instrumental.compressor;
  const compressor = `acompressor=threshold=${c.threshold}dB:ratio=${c.ratio}:attack=${c.attack}:release=${c.release}`;
  
  // 4. EQ
  let filterChain = `${pan},${gate},${compressor}`;
  if (config.instrumental.eq.enabled) {
      const e = config.instrumental.eq;
      // equalizer=f=1000:width_type=q:width=1:g=-2
      filterChain += `,equalizer=f=${e.f}:t=q:w=${e.width}:g=${e.gain}`;
  }
  
  return filterChain;
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

// Deep merge helper
function mergeConfig(def, ovr) {
  const res = { ...def };
  for (const k in ovr) {
    if (typeof ovr[k] === 'object' && ovr[k] !== null && !Array.isArray(ovr[k])) {
      res[k] = mergeConfig(res[k], ovr[k]);
    } else {
      res[k] = ovr[k];
    }
  }
  return res;
}

async function separateAudio({ input, outDir, format = 'wav', params = {} }) {
  if (!existsSync(input)) {
    throw new Error('找不到输入文件: ' + input);
  }

  const targetDir = outDir || join(dirname(input), 'output');

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const finalConfig = mergeConfig(defaultConfig, params);

  const inputBase = basename(input, extname(input));
  const target = codecMap.get(format) || codecMap.get('wav');
  const instrumentalPath = join(targetDir, `${inputBase}_instrumental.${format}`);
  const vocalPath = join(targetDir, `${inputBase}_vocals.${format}`);

  const instrumentalFilter = buildInstrumentalFilter(finalConfig);
  const vocalFilter = buildVocalFilter(finalConfig);

  const instrumentalArgs = buildFfmpegArgs({ input, format }, instrumentalFilter, instrumentalPath);
  const vocalArgs = buildFfmpegArgs({ input, format }, vocalFilter, vocalPath);

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

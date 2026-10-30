'use strict';

/**
 * 路径中心
 * ------------------------------------------------------------
 * 所有"东西放在哪"只在这里定义一次，其它模块不许自己拼路径。
 *
 *   <root>\app        ← 源码（构建时同步到 runtime\resources\app）
 *   <root>\runtime    ← Electron 运行时
 *   <root>\plugins    ← 插件
 *   <root>\data       ← 用户数据（设置、数据库、日志、会话）
 *   <root>\cache      ← 缓存（随时可删）
 *
 * 全部在同一个文件夹里：拷走整个 <root> 就是完整搬家。
 */

const path = require('node:path');
const fs = require('node:fs');

function resolveRoot() {
  // DSH_OPEN_ROOT 可以用来强行指定（测试、多开）
  const forced = String(process.env.DSH_OPEN_ROOT || '').trim();
  if (forced) return forced;

  try {
    // <root>\runtime\DShOpen.exe  →  <root>
    const root = path.dirname(path.dirname(process.execPath));
    // 源码形态：<root>\app\core\...
    if (fs.existsSync(path.join(root, 'app'))) return root;
    // 打包形态：<root>\runtime\resources\app\...
    if (fs.existsSync(path.join(root, 'runtime', 'resources', 'app'))) return root;
  } catch (_) {
    /* 继续走兜底 */
  }
  // 兜底：<root>\app\core → <root>（从源码运行时也成立）
  return path.resolve(__dirname, '..', '..');
}

const ROOT = resolveRoot();

/** 能不能在 dir 下写文件（会顺手建目录） */
function writable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 数据放哪：默认和程序放一起（便携）；程序和目录不可写时（比如装在
 * Program Files）退到 %LOCALAPPDATA%\DSh Open，保证设置和聊天记录存得住。
 * DSH_OPEN_DATA_DIR 可以强行指定。
 */
function resolveDataDir() {
  const forced = String(process.env.DSH_OPEN_DATA_DIR || '').trim();
  if (forced) return forced;
  const beside = path.join(ROOT, 'data');
  if (writable(beside)) return beside;
  const fallback = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'),
    'DSh Open',
    'data',
  );
  writable(fallback);
  return fallback;
}

const DATA = resolveDataDir();
const BASE = path.dirname(ROOT);
const NAME = path.basename(ROOT);

const P = {
  root: ROOT,
  base: BASE,
  app: path.join(ROOT, 'app'),
  runtime: path.join(ROOT, 'runtime'),
  plugins: path.join(ROOT, 'plugins'),
  assets: path.join(ROOT, 'app', 'assets'),

  data: DATA,
  cache: path.join(ROOT, 'cache'),
  // 程序目录写不了的时候，缓存也跟着数据走
  cacheFallback: path.join(path.dirname(DATA), 'cache'),
};

if (!writable(P.cache)) P.cache = P.cacheFallback;

P.settingsFile = path.join(P.data, 'settings.json');
P.databaseFile = path.join(P.data, 'dsh-open.db');
P.logs = path.join(P.data, 'logs');
P.userData = path.join(P.data, 'userData');
P.sessionData = path.join(P.userData, 'session');
P.crashDumps = path.join(P.data, 'crashDumps');
P.pluginData = path.join(P.data, 'plugin-data');

P.temp = path.join(P.cache, 'temp');
P.chromiumCache = path.join(P.cache, 'chromium');

/** 建目录，失败不抛（日志在旁边由调用方决定） */
function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {
    /* 目录建不出来就让后续读写自己报错 */
  }
  return dir;
}

/** 一次建一批 */
function ensure(...dirs) {
  dirs.forEach(ensureDir);
  return P;
}

module.exports = { ...P, ensure, ensureDir };

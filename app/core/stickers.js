'use strict';

/**
 * 表情包
 * ------------------------------------------------------------
 * 不搬文件，只记路径：
 *   - 图存在你自己选的目录里（在「表情包」页设置）
 *   - 扫一遍把文件名、大小、情绪标签记进 <data>\stickers.json 缓存
 *   - 发的时候用 base64 塞进 CQ 码，不依赖 OneBot 能不能读本地路径
 *
 * 情绪标签靠文件名猜（"笑""哭""摸头"这类），猜不准的归到"其它"，
 * 玩家以后可以在界面上改（M 后续）。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const P = require('./paths');
const settings = require('./settings');
const log = require('./logger');

const EXT = new Set(['.gif', '.png', '.jpg', '.jpeg', '.webp', '.bmp']);

// 文件名关键词 -> 情绪分组（先匹配到的算数，所以顺序有讲究）
const RULES = [
  ['庆祝', ['庆祝', '胜利', '耶', '烟花', 'party']],
  ['开心', ['笑', '开心', '高兴', '哈', 'happy', '嘿嘿']],
  ['喜欢', ['爱心', '喜欢', '心动', '比心', '亲', 'love']],
  ['害羞', ['害羞', '脸红', '羞', '撒娇']],
  ['摸头', ['摸头', '安慰', '抱', '贴贴', '顺毛']],
  ['点赞', ['点赞', '赞', '牛', 'good', 'ok']],
  ['加油', ['加油', '打气', '冲', 'fighting']],
  ['生气', ['生气', '怒', '气', '抗议', '摔']],
  ['难过', ['哭', '难过', '委屈', '泪', '悲']],
  ['疑惑', ['问号', '疑惑', '懵', 'what', '？', '?']],
  ['震惊', ['震惊', '惊吓', '惊', '呆']],
  ['无语', ['无语', '汗', '汗颜', '小丑', '尴尬', '呆']],
  ['困', ['睡', '困', '晚安', '睡懒觉', 'zzz']],
  ['吃', ['吃', '馋', '饭', '西瓜', '茶', '喝']],
  ['游戏', ['游戏', '打游戏', '开黑']],
  ['期待', ['期待', '等']],
  ['害怕', ['害怕', '慌张', '怕']],
  ['拒绝', ['摇头', '拒绝', '不要', 'no']],
  ['认同', ['点头', '认同', '嗯', 'yes']],
  ['道别', ['再见', '拜拜', '下班', '收工', '停止工作']],
  ['音乐', ['音乐', '唱歌', '听歌', '放歌']],
  ['礼物', ['礼', '玫瑰', '花']],
  ['威胁', ['撬棍', '刀', '威胁']],
];

const CACHE_FILE = () => path.join(P.data, 'stickers.json');
let cache = null; // { source, scannedAt, items: [{file,name,ext,size,emotion}] }

// 玩家手动改过的东西单独存，文件重扫也不会丢
// { "<绝对路径>": { emotion: "开心", favorite: true } }
const OVERRIDE_FILE = () => path.join(P.data, 'stickers-overrides.json');
let overrides = null;

function loadOverrides() {
  if (overrides) return overrides;
  try {
    overrides = JSON.parse(fs.readFileSync(OVERRIDE_FILE(), 'utf8')) || {};
    if (typeof overrides !== 'object' || Array.isArray(overrides)) overrides = {};
  } catch (_) {
    overrides = {};
  }
  return overrides;
}

function saveOverrides() {
  try {
    const tmp = OVERRIDE_FILE() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(loadOverrides(), null, 2), 'utf8');
    fs.renameSync(tmp, OVERRIDE_FILE());
  } catch (err) {
    log.warn('stickers: 手动分组存不进去 —', err && err.message);
  }
}

function ovOf(file) {
  return loadOverrides()[file] || null;
}

/** 这张图最终的标签：玩家改过的优先，否则用文件名猜的 */
function emotionOf(file, name) {
  const ov = ovOf(file);
  return (ov && ov.emotion) || classify(name);
}

function isFav(file) {
  const ov = ovOf(file);
  return !!(ov && ov.favorite);
}

function trashDir() {
  return path.join(P.data, 'stickers-trash');
}

function sourceDir() {
  const s = settings.getIn('stickers') || {};
  // 不预设目录：没选过就是空的，界面上让用户自己挑（默认值里不许出现作者本机的路径）
  return String(s.source || '').trim();
}

function defaultCache() {
  return { source: '', scannedAt: 0, items: [] };
}

function loadCache() {
  if (cache) return cache;
  try {
    if (fs.existsSync(CACHE_FILE())) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE(), 'utf8'));
      if (!Array.isArray(cache.items)) cache = defaultCache();
    } else {
      cache = defaultCache();
    }
  } catch (err) {
    log.warn('stickers: 缓存读不动，重新扫 —', err && err.message);
    cache = defaultCache();
  }
  return cache;
}

function saveCache() {
  try {
    const tmp = CACHE_FILE() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache), 'utf8');
    fs.renameSync(tmp, CACHE_FILE());
  } catch (err) {
    log.warn('stickers: 缓存写不进去 —', err && err.message);
  }
}

function classify(name) {
  const lower = String(name).toLowerCase();
  for (const [emotion, words] of RULES) {
    if (words.some((w) => lower.includes(String(w).toLowerCase()))) return emotion;
  }
  return '其它';
}

/** 所有可用标签：内置 23 个 + 「其它」+ 玩家自己起的名字（按出现顺序） */
function allEmotions() {
  const set = new Set(RULES.map(([name]) => name));
  set.add('其它');
  for (const ov of Object.values(loadOverrides())) {
    if (ov && ov.emotion) set.add(ov.emotion);
  }
  return Array.from(set);
}

/** 重新扫一遍目录；只保留一层（不递归子目录，够用且快） */
function scan() {
  const dir = sourceDir();
  // 还没选目录：空着就好，不去读盘（scandir('') 会报 ENOENT）
  if (!dir) {
    cache = defaultCache();
    saveCache();
    return api.stats();
  }
  const items = [];
  let files = [];
  try {
    files = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    log.warn('stickers: 目录读不了 —', dir, err && err.message);
    cache = { ...defaultCache(), source: dir };
    saveCache();
    return api.stats();
  }
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!EXT.has(ext)) continue;
    // PNGTuber 立绘不是表情，跳过
    if (/_?FXDS\.png$/i.test(entry.name)) continue;
    items.push({
      file: path.join(dir, entry.name),
      name: entry.name,
      ext: ext.slice(1),
      emotion: '',
    });
  }
  for (const item of items) {
    item.emotion = emotionOf(item.file, item.name);
    item.favorite = isFav(item.file);
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  cache = { source: dir, scannedAt: Date.now(), items };
  saveCache();
  log.info('stickers: 扫描完成 ' + items.length + ' 张（' + dir + '）');
  return api.stats();
}

function ensure() {
  const c = loadCache();
  const dir = sourceDir();
  // 还没选目录：就当空的，不去读盘、也不打日志
  if (!dir) {
    if (c.items.length || c.source) {
      cache = defaultCache();
      saveCache();
    }
    return loadCache();
  }
  if (!c.items.length || c.source !== dir) scan();
  return loadCache();
}

const api = {
  /** 表情包在哪、有多少 */
  stats() {
    ensure();
    const counts = {};
    let favorites = 0;
    for (const item of cache.items) {
      counts[item.emotion] = (counts[item.emotion] || 0) + 1;
      if (item.favorite) favorites += 1;
    }
    return {
      source: cache.source || sourceDir(),
      scannedAt: cache.scannedAt,
      total: cache.items.length,
      favorites,
      uncategorized: counts['其它'] || 0,
      groups: Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      /** 可以选的标签（内置 + 玩家自定义） */
      emotions: allEmotions(),
      trashDir: trashDir(),
      defaultSource: '',
    };
  },

  /** 列表（可按情绪过滤、分页），给界面用 */
  list(options) {
    ensure();
    const opts = options || {};
    const sel = opts.emotion && opts.emotion !== '全部' ? opts.emotion : '';
    const offset = Math.max(0, Number(opts.offset) || 0);
    const limit = Math.min(200, Math.max(1, Number(opts.limit) || 60));
    let pool = cache.items;
    if (sel === '@fav') pool = pool.filter((x) => x.favorite);
    else if (sel) pool = pool.filter((x) => x.emotion === sel);
    if (opts.keyword) {
      const kw = String(opts.keyword).toLowerCase();
      pool = pool.filter((x) => x.name.toLowerCase().includes(kw));
    }
    return {
      total: pool.length,
      offset,
      items: pool.slice(offset, offset + limit).map((x) => ({
        name: x.name,
        file: x.file,
        url: 'file:///' + x.file.replace(/\\/g, '/'),
        emotion: x.emotion,
        favorite: !!x.favorite,
        ext: x.ext,
      })),
    };
  },

  /** 把一张（或一批）改成某个分组；emotion 传空 = 恢复成按文件名自动猜 */
  setEmotion(files, emotion) {
    const list = Array.isArray(files) ? files : [files];
    const bag = loadOverrides();
    const value = String(emotion || '').trim();
    for (const file of list) {
      if (!file) continue;
      const prev = bag[file] || {};
      if (value) bag[file] = { ...prev, emotion: value };
      else {
        const next = { ...prev };
        delete next.emotion;
        bag[file] = next;
      }
      if (!bag[file].emotion && !bag[file].favorite) delete bag[file];
    }
    saveOverrides();
    api.rescan();
    return { ok: true, changed: list.length, emotion: value || '自动' };
  },

  /** 收藏 / 取消收藏 */
  setFavorite(files, on) {
    const list = Array.isArray(files) ? files : [files];
    const bag = loadOverrides();
    for (const file of list) {
      if (!file) continue;
      const prev = bag[file] || {};
      if (on) bag[file] = { ...prev, favorite: true };
      else {
        const next = { ...prev };
        delete next.favorite;
        bag[file] = next;
      }
      if (!bag[file].emotion && !bag[file].favorite) delete bag[file];
    }
    saveOverrides();
    api.rescan();
    return { ok: true, changed: list.length, favorite: !!on };
  },

  /** 删除 = 移到回收站（不动玩家原目录之外的判断，只移走这一张） */
  remove(files) {
    const list = Array.isArray(files) ? files : [files];
    const bag = loadOverrides();
    const dir = path.join(trashDir(), String(Date.now()));
    let moved = 0;
    for (const file of list) {
      if (!file) continue;
      try {
        if (fs.existsSync(file)) {
          fs.mkdirSync(dir, { recursive: true });
          fs.renameSync(file, path.join(dir, path.basename(file)));
          moved += 1;
        }
        delete bag[file];
      } catch (err) {
        log.warn('stickers: 删不动 —', file, err && err.message);
      }
    }
    saveOverrides();
    api.rescan();
    log.info('stickers: 已移走 ' + moved + ' 张到回收站 ' + dir);
    return { ok: true, moved, trash: dir };
  },

  /** 把一个分组整体改名（等于批量改标签） */
  renameGroup(from, to) {
    ensure();
    const list = cache.items.filter((x) => x.emotion === from).map((x) => x.file);
    return api.setEmotion(list, to);
  },

  /** 分组名清单（内置 + 自定义），给下拉框用 */
  emotions() {
    ensure();
    return allEmotions();
  },

  rescan() {
    cache = null;
    return scan();
  },

  /** 换一个目录（空 = 回到默认） */
  setSource(dir) {
    settings.patch({ stickers: { source: String(dir || '') } });
    return api.rescan();
  },

  /** 收一份外面的图进表情包目录（QQ 收到的表情、截图之类） */
  importFile(file, options) {
    const src = String(file || '');
    if (!src) throw new Error('没有文件');
    if (!fs.existsSync(src)) throw new Error('找不到这张图');
    const ext = path.extname(src).toLowerCase();
    if (!EXT.has(ext)) throw new Error('不支持这种文件：' + (ext || '无后缀'));
    const buf = fs.readFileSync(src);
    if (!buf.length) throw new Error('空文件');
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
    const dir = sourceDir();
    fs.mkdirSync(dir, { recursive: true });
    // 同一张图只收一次（按内容哈希认）
    let existed = '';
    try {
      existed = fs.readdirSync(dir).find((n) => n.toLowerCase().includes('-' + hash)) || '';
    } catch (_) {
      existed = '';
    }
    if (existed) {
      return { ok: true, existed: true, file: path.join(dir, existed), name: existed, hash };
    }
    const d = new Date();
    const stamp =
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') +
      '-' +
      String(d.getHours()).padStart(2, '0') +
      String(d.getMinutes()).padStart(2, '0') +
      String(d.getSeconds()).padStart(2, '0');
    const name = 'QQ收到-' + stamp + '-' + hash + ext;
    const dest = path.join(dir, name);
    fs.copyFileSync(src, dest);
    api.rescan();
    const item = (cache.items || []).find((x) => x.file === dest);
    log.info('stickers: 收到一张，已存进表情包 ' + dest);
    return { ok: true, existed: false, file: dest, name, emotion: item ? item.emotion : '其它', hash };
  },

  /** 随机挑一张，给"自动配图"用 */
  pick(emotion) {
    ensure();
    const pool = emotion ? cache.items.filter((x) => x.emotion === emotion) : cache.items;
    if (!pool.length) return null;
    const item = pool[Math.floor(Math.random() * pool.length)];
    return {
      name: item.name,
      file: item.file,
      url: 'file:///' + item.file.replace(/\\/g, '/'),
      emotion: item.emotion,
    };
  },

  /** 读成 base64（发 QQ 用；OneBot 支持 base64://） */
  toBase64(file) {
    const buf = fs.readFileSync(file);
    return buf.toString('base64');
  },

  /** 拼一条 CQ 图片码 */
  cqOf(file) {
    const ext = path.extname(file).slice(1).toLowerCase() || 'gif';
    return '[CQ:image,file=base64://' + api.toBase64(file) + ']';
  },
};

module.exports = api;

'use strict';

/**
 * 插件加载器
 * ------------------------------------------------------------
 * 插件就是一个文件夹，放在 <root>\plugins\ 下面：
 *
 *   plugins\my-plugin\
 *     plugin.json     ← 清单（必须）
 *     index.js        ← 入口（清单里的 main）
 *
 * 本体只认清单，不认代码。清单里写清楚"我要什么、我提供什么"，
 * 本体照着登记；清单之外的东西一律不加载。
 *
 * 这一层是整个软件能不能"越加越多还不乱"的关键，改动要慎重。
 */

const fs = require('node:fs');
const path = require('node:path');
const P = require('./paths');
const log = require('./logger');
const registry = require('./registry');
const qq = require('./qq');
const settings = require('./settings');
const permissions = require('./permissions');

const MANIFEST_NAMES = ['plugin.json', 'manifest.json'];
const records = new Map(); // id -> record

function isSafeId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{1,63}$/i.test(id);
}

function readManifest(dir) {
  for (const name of MANIFEST_NAMES) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const raw = JSON.parse(text);
    const id = raw.id || path.basename(dir);
    if (!isSafeId(id)) throw new Error(`插件 id 不合法：${id}`);

    // 权限：写错了不算致命错误，一律归到"默认"，并记一条警告
    let permission = permissions.normalize(raw.permission);
    if (raw.permission && !permissions.isValid(raw.permission)) {
      log.warn(`plugins: ${id} 的权限 "${raw.permission}" 不认识，按默认处理`);
    }

    return {
      id,
      name: raw.name || id,
      version: raw.version || '0.0.0',
      description: raw.description || '',
      author: raw.author || '',
      main: raw.main || 'index.js',
      permission,
      permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
      enabledByDefault: raw.enabledByDefault !== false,
      manifest: raw,
    };
  }
  return null;
}

function activate(rec) {
  const entry = path.join(rec.dir, rec.manifest.main);
  if (!fs.existsSync(entry)) throw new Error(`入口文件不存在：${rec.manifest.main}`);

  // 重新加载时清掉 require 缓存，否则改了插件代码不会生效
  try {
    delete require.cache[require.resolve(entry)];
  } catch (_) {
    /* 没缓存就算了 */
  }

  rec.handlers = new Map();
  rec.messageHandlers = [];

  const pluginSettings = () => settings.getIn('pluginSettings.' + rec.id) || {};

  const ctx = {
    id: rec.id,
    manifest: rec.manifest.manifest,
    dir: rec.dir,
    dataDir: P.ensureDir(path.join(P.pluginData, rec.id)),
    permission: rec.manifest.permission,
    // 这个权限默认挂到哪个模块（人格管理 / 客户端 / 通道 ……），没有就是 null
    target: permissions.targetOf(rec.manifest.permission),
    log: {
      info: (...a) => log.info('[plugin:' + rec.id + ']', ...a),
      warn: (...a) => log.warn('[plugin:' + rec.id + ']', ...a),
      error: (...a) => log.error('[plugin:' + rec.id + ']', ...a),
      debug: (...a) => log.debug('[plugin:' + rec.id + ']', ...a),
    },
    registerPage: (def) =>
      registry.addPage({
        ...def,
        id: def.id || rec.id,
        source: rec.id,
        kind: 'plugin',
      }),
    registerChannel: (def) =>
      registry.addChannel({
        ...def,
        id: def.id || rec.id,
        source: rec.id,
      }),
    registerTool: (def) =>
      registry.addTool({
        ...def,
        id: def.id || rec.id,
        source: rec.id,
      }),
    /**
     * 往已有页面的末尾插一段自己的功能区（声明式：字段 + 按钮）。
     * 渲染由本体统一做，插件只要实现 handle('state'|'set'|'action')。
     */
    registerSection: (def) =>
      registry.addSection({
        ...def,
        pluginId: rec.id,
        order: Number.isFinite(def.order) ? def.order : 100,
      }),
    /**
     * 注册一个可以被界面调用的处理函数。
     * 界面侧：window.dsh.plugin.call(插件id, 名字, 参数)
     */
    handle: (name, fn) => {
      if (typeof fn !== 'function') throw new Error('ctx.handle: 第二个参数要是函数');
      rec.handlers.set(String(name), fn);
    },
    /** 挂一个"来消息了"的钩子；插件自己判断要不要理 */
    onMessage: (fn) => {
      if (typeof fn === 'function') rec.messageHandlers.push(fn);
    },
    /** 让插件能问模型（用的是本体当前接入的模型） */
    ai: {
      chat: (messages, opts) => require('./ai').chat(settings.getIn('model.active'), messages, opts),
    },
    /** 让插件能用 B 站接口（只放行 bilibili.com） */
    bili: {
      status: () => require('./bilibili').status(),
      me: () => require('./bilibili').me(),
      get: (url) => require('./bilibili').apiGet(url),
      post: (url, form) => require('./bilibili').apiPost(url, form),
    },
    /** 让插件能用 QQ 通道（发消息 / 调 OneBot 接口） */
    qq: {
      status: () => qq.status(),
      call: (action, params) => qq.call(action, params),
      sendPrivate: (userId, text) => qq.sendPrivate(userId, text),
      sendGroup: (groupId, text) => qq.sendGroup(groupId, text),
      zone: (text) => require('./qqzone').publish(text),
    },
    /**
     * 发说说：识别说法 / 没给内容时自己写一句 / 真发出去。
     * 插件和「对话」页共用这一套，免得两边行为不一致。
     */
    qzone: {
      detect: (text) => require('./qzoneIntent').detect(text),
      compose: (hint) => require('./qzoneIntent').compose(hint),
      publish: (text) => require('./qzoneIntent').publish(text),
    },
    /**
     * 把自己的能力交给"默认模块"。不传 moduleId 就走权限对应的模块：
     * PC 插件 → 人格管理，Cli 插件 → 客户端，Chn 插件 → 通道……
     * 对应模块做出来以后，直接从 registry.getModule(名字) 取用。
     */
    expose: (api, moduleId) => {
      const target = moduleId || permissions.targetOf(rec.manifest.permission);
      if (!target) {
        log.warn(`plugins: ${rec.id} 是默认权限，没有可挂载的模块（想要可以显式传模块名）`);
        return null;
      }
      registry.expose(target, { pluginId: rec.id, api });
      log.info(`plugins: ${rec.id} 已挂到模块 ${target}`);
      return target;
    },
    settings: {
      /** 读本体设置（只读），比如 channels.qq.ownerQq */
      getGlobal: (key) => settings.getIn(key),
      get: pluginSettings,
      patch: (partial) =>
        settings.patch({
          pluginSettings: { [rec.id]: { ...pluginSettings(), ...partial } },
        }),
    },
  };

  const mod = require(entry);
  const activateFn = typeof mod === 'function' ? mod : mod && mod.activate;
  if (typeof activateFn !== 'function') {
    throw new Error('入口没有导出 activate 函数');
  }
  const maybePromise = activateFn(ctx);
  if (maybePromise && typeof maybePromise.catch === 'function') {
    maybePromise.catch((err) => {
      rec.status = 'error';
      rec.error = err && err.message ? err.message : String(err);
      log.ex(`插件 ${rec.id} 异步启动失败`, err);
    });
  }
  rec.status = 'active';
}

function deactivate(rec) {
  registry.removeBySource(rec.id);
  try {
    const entry = path.join(rec.dir, rec.manifest.main);
    const mod = require.cache[require.resolve(entry)];
    if (mod && mod.exports && typeof mod.exports.deactivate === 'function') {
      mod.exports.deactivate();
    }
  } catch (_) {
    /* 卸载失败不影响主流程 */
  }
}

function scan() {
  records.clear();
  P.ensureDir(P.plugins);

  let dirs = [];
  try {
    dirs = fs
      .readdirSync(P.plugins, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(P.plugins, d.name));
  } catch (err) {
    log.ex('plugins: 扫描插件目录失败', err);
    return;
  }

  for (const dir of dirs) {
    let manifest;
    try {
      manifest = readManifest(dir);
    } catch (err) {
      log.ex('plugins: 清单解析失败 ' + dir, err);
      records.set('!' + path.basename(dir), {
        id: path.basename(dir),
        name: path.basename(dir),
        version: '-',
        description: '插件清单无法解析',
        author: '',
        dir,
        manifest: {},
        status: 'error',
        error: err && err.message ? err.message : String(err),
      });
      continue;
    }
    if (!manifest) continue; // 不是插件，忽略（比如放了说明文件）

    const rec = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      permissions: manifest.permissions,
      enabledByDefault: manifest.enabledByDefault,
      dir,
      manifest,
      status: 'disabled',
      error: '',
    };

    const wanted = settings.pluginEnabled(rec.id, rec.enabledByDefault);
    if (wanted) {
      try {
        activate(rec);
      } catch (err) {
        rec.status = 'error';
        rec.error = err && err.message ? err.message : String(err);
        log.ex('插件 ' + rec.id + ' 加载失败', err);
      }
    }
    records.set(rec.id, rec);
  }

  log.info(
    'plugins: 扫描完成',
    `${records.size} 个插件`,
    [...records.values()].map((r) => `${r.id}:${r.status}`).join(', ') || '(空)',
  );
}

function publicRecord(rec) {
  if (rec.id.startsWith('!')) {
    return {
      id: rec.id.slice(1),
      name: rec.name,
      version: rec.version,
      description: rec.description,
      author: rec.author,
      permission: 'default',
      permissionBadge: 'Def',
      permissionTarget: null,
      permissions: [],
      status: 'error',
      error: rec.error,
      enabled: false,
      dir: rec.dir,
    };
  }
  const perm = permissions.get(rec.manifest.permission) || permissions.get('default');
  return {
    id: rec.id,
    name: rec.name,
    version: rec.version,
    description: rec.description,
    author: rec.author,
    permission: perm.id,
    permissionBadge: perm.badge,
    permissionTarget: perm.target,
    permissions: rec.permissions || [],
    status: rec.status,
    error: rec.error || '',
    enabled: rec.status === 'active',
    dir: rec.dir,
  };
}

const plugins = {
  scan,

  list() {
    return [...records.values()].map(publicRecord);
  },

  reload() {
    for (const rec of records.values()) {
      if (!rec.id.startsWith('!')) deactivate(rec);
    }
    scan();
    return plugins.list();
  },

  setEnabled(id, enabled) {
    const rec = records.get(id);
    if (!rec) throw new Error('插件不存在：' + id);
    settings.setPluginEnabled(id, !!enabled, rec.enabledByDefault);
    if (enabled) {
      try {
        activate(rec);
      } catch (err) {
        rec.status = 'error';
        rec.error = err && err.message ? err.message : String(err);
        log.ex('插件 ' + id + ' 启用失败', err);
      }
    } else {
      deactivate(rec);
      rec.status = 'disabled';
      rec.error = '';
    }
    return publicRecord(rec);
  },

  /**
   * 删除插件：先卸载，再删掉它的文件夹（和它自己的数据目录），最后重新扫描。
   * 只删 plugins 根目录下的直接子文件夹，路径越界一律拒绝。
   */
  remove(id) {
    // 清单坏掉的插件在 records 里以「!id」为键，这里一并能删
    const rec = records.get(id) || records.get('!' + id);
    if (!rec) throw new Error('插件不存在：' + id);

    const root = path.resolve(P.plugins);
    const dir = path.resolve(rec.dir);
    const rel = path.relative(root, dir);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) {
      throw new Error('插件目录不在插件根目录下，拒绝删除：' + dir);
    }

    if (!rec.id.startsWith('!')) deactivate(rec);

    // 先甩掉 require 缓存，免得文件被占用删不掉
    try {
      const entry = path.join(rec.dir, rec.manifest.main || 'index.js');
      delete require.cache[require.resolve(entry)];
    } catch (_) {
      /* 没加载过就算了 */
    }

    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 });
    } catch (err) {
      throw new Error('删除插件文件夹失败（可能被占用）：' + (err && err.message ? err.message : err));
    }
    log.info('plugins: 已删除插件文件夹', dir);

    // 插件自己的数据目录（<data>\plugin-data\<id>）一并清掉
    if (isSafeId(rec.id)) {
      const dataDir = path.join(P.pluginData, rec.id);
      try {
        fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 });
        log.info('plugins: 已删除插件数据目录', dataDir);
      } catch (err) {
        log.ex('plugins: 删除插件数据目录失败 ' + dataDir, err);
      }
    }

    settings.forgetPlugin(rec.id);
    records.delete(rec.id);
    scan();
    return { id, removed: true };
  },

  // ---------------- 界面/逻辑调用插件的入口 ----------------
  /**
   * 界面调插件：window.dsh.plugin.call(插件id, 'state' | 'set' | 'action', 参数)
   * 插件用 ctx.handle(名字, 函数) 注册。
   */
  async call(id, name, payload) {
    const rec = records.get(id) || records.get('!' + id);
    if (!rec) throw new Error('插件没在跑：' + id);
    if (rec.status !== 'active') throw new Error('插件没启用：' + id);
    const fn = rec.handlers && rec.handlers.get(String(name));
    if (typeof fn !== 'function') throw new Error('插件没有提供这个入口：' + name);
    return await fn(payload || {});
  },

  /** 收到 QQ 消息时，把事件分发给所有挂了 onMessage 的插件 */
  dispatchMessage(event, text) {
    for (const rec of records.values()) {
      if (rec.status !== 'active' || !rec.messageHandlers || !rec.messageHandlers.length) continue;
      for (const fn of rec.messageHandlers) {
        try {
          const r = fn(event, text);
          if (r && typeof r.catch === 'function') r.catch((err) => log.ex('插件消息钩子出错 ' + rec.id, err));
        } catch (err) {
          log.ex('插件消息钩子出错 ' + rec.id, err);
        }
      }
    }
  },
};

module.exports = plugins;

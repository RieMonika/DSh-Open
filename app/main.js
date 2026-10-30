'use strict';

/**
 * DSh Open — 主进程（薄壳）
 * ------------------------------------------------------------
 * 这里只做四件事：
 *   1. 决定数据放哪（全在 D 盘）
 *   2. 开窗口、管单实例
 *   3. 按顺序启动各层（设置 → 数据库 → 插件 → IPC）
 *   4. 把"应用信息"交给界面
 *
 * 业务逻辑一律不写在这里，写到 core/ 或插件里。
 */

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const P = require('./core/paths');
const log = require('./core/logger');
const settings = require('./core/settings');
const db = require('./core/db');
const registry = require('./core/registry');
const plugins = require('./core/plugins');
const autolaunch = require('./core/autolaunch');
const permissions = require('./core/permissions');
const qq = require('./core/qq');
const autoreply = require('./core/autoreply');
const proactive = require('./core/proactive');
const biliLife = require('./core/biliLife');
const pet = require('./core/pet');
const growth = require('./core/growth');
const bond = require('./core/bond');
const usage = require('./core/usage');
const ai = require('./core/ai');
const ipc = require('./core/ipc');
const remote = require('./core/remote');

// ---------------------------------------------------------------------------
// 0. 日志 + 兜底异常
// ---------------------------------------------------------------------------
log.boot(true);
log.info('---- boot ----', process.execPath, process.argv.slice(1).join(' '));

process.on('uncaughtException', (err) => log.ex('UNCAUGHT', err));
process.on('unhandledRejection', (err) => log.ex('UNHANDLED', err));

// ---------------------------------------------------------------------------
// 1. 数据目录：全部落 D 盘（必须在 ready 之前设置）
// ---------------------------------------------------------------------------
P.ensure(P.data, P.cache, P.logs, P.userData, P.crashDumps, P.temp, P.pluginData, P.plugins);

const APP_PATHS = {
  userData: P.userData,
  sessionData: P.sessionData,
  logs: P.logs,
  crashDumps: P.crashDumps,
  temp: P.temp,
};

for (const [name, dir] of Object.entries(APP_PATHS)) {
  try {
    app.setPath(name, dir);
    log.info('setPath ok:', name, '->', dir);
  } catch (err) {
    log.ex('setPath failed: ' + name, err);
  }
}

app.commandLine.appendSwitch('disk-cache-dir', P.chromiumCache);

// 调试开关：只有设置 DSH_OPEN_DEBUG=1 才开遥控端口（平时永远不监听，避免暴露）
if (process.env.DSH_OPEN_DEBUG === '1') {
  const debugPort = String(process.env.DSH_OPEN_DEBUG_PORT || 9223);
  app.commandLine.appendSwitch('remote-debugging-port', debugPort);
  log.info('debug: remote-debugging-port =', debugPort);
}

// ---------------------------------------------------------------------------
// 2. 内置页面登记（以后加页面：在这里加一条；插件页面由插件自己登记）
// ---------------------------------------------------------------------------
function registerBuiltinPages() {
  registry.addPage({ id: 'dashboard', title: '总览', titleKey: 'nav.dashboard', icon: '◎', group: 'work', order: 10 });
  registry.addPage({ id: 'inbox', title: '消息', titleKey: 'nav.inbox', icon: '✉', group: 'work', order: 15 });
  registry.addPage({ id: 'chat', title: '对话', titleKey: 'nav.chat', icon: '💬', group: 'work', order: 20 });
  registry.addPage({ id: 'memory', title: '记忆', titleKey: 'nav.memory', icon: '🧠', group: 'life', order: 10 });
    registry.addPage({ id: 'pet', title: '桌宠', titleKey: 'nav.pet', icon: '🐾', group: 'life', order: 15 });
  registry.addPage({ id: 'channels', title: '通道', titleKey: 'nav.channels', icon: '⇄', group: 'work', order: 20 });
  registry.addPage({ id: 'growth', title: '养成', titleKey: 'nav.growth', icon: '🌱', group: 'life', order: 5 });
  registry.addPage({ id: 'model', title: '模型', titleKey: 'nav.model', icon: '✦', group: 'work', order: 30 });
  registry.addPage({ id: 'stickers', title: '表情包', titleKey: 'nav.stickers', icon: '☺', group: 'work', order: 35 });
  registry.addPage({ id: 'abilities', title: '能力说明', titleKey: 'nav.abilities', icon: '☑', group: 'work', order: 37 });
  registry.addPage({ id: 'plugins', title: '插件中心', titleKey: 'nav.plugins', icon: '⊞', group: 'work', order: 40 });
  registry.addPage({ id: 'tutorial', title: '教程', titleKey: 'nav.tutorial', icon: '📖', group: 'work', order: 45 });
  registry.addPage({ id: 'admin', title: '管理员', titleKey: 'nav.admin', icon: '🔑', group: 'system', order: 89 });
  registry.addPage({ id: 'settings', title: '设置', titleKey: 'nav.settings', icon: '⚙', group: 'system', order: 90, hidden: true });
}

// ---------------------------------------------------------------------------
// 3. 窗口
// ---------------------------------------------------------------------------
let mainWindow = null;

function buildInfo() {
  const s = settings.get();
  return {
    app: { version: app.getVersion(), name: 'DSh Open' },
    runtime: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    },
    paths: {
      root: P.root,
      app: P.app,
      data: P.data,
      cache: P.cache,
      logs: P.logs,
      plugins: P.plugins,
    },
    settings: s,
    locales: settings.LOCALES,
    startOnBootActual: autolaunch.isEnabled(),
    dbBackend: db.backend,
    pages: registry.listPages(),
    channels: registry.listChannels(),
    // 插件权限清单（界面的「权限说明」弹窗直接照着渲染）
    permissions: permissions.list(),
  };
}

function createWindow() {
  const win = settings.getIn('window') || {};

  mainWindow = new BrowserWindow({
    width: win.width,
    height: win.height,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0e1117',
    title: 'DSh Open',
    icon: path.join(__dirname, 'assets', 'app-icon.ico'),
    autoHideMenuBar: true,
    // 自绘深色标题栏（保留系统的最小化/最大化/关闭按钮）
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#141922',
      symbolColor: '#c9d3e6',
      height: 38,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  if (win.maximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    log.info('ready-to-show');
    mainWindow.show();
  });

  // 记住窗口大小，下次打开还原
  mainWindow.on('close', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const bounds = mainWindow.getNormalBounds();
      settings.patch({
        window: {
          width: bounds.width,
          height: bounds.height,
          maximized: mainWindow.isMaximized(),
        },
      });
    } catch (err) {
      log.ex('保存窗口尺寸失败', err);
    }
  });

  mainWindow.on('closed', () => {
    log.info('window closed');
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => log.error('did-fail-load:', code, desc));
  mainWindow.webContents.on('render-process-gone', (_e, details) =>
    log.error('render-process-gone:', JSON.stringify(details)),
  );

  // 页面里的外链一律交给系统浏览器，不在客户端里开新窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch((err) => {
    log.ex('loadFile 失败', err);
  });
}

// ---------------------------------------------------------------------------
// 4. 启动流程
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  log.info('single instance lock NOT acquired, quitting');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    log.info('app ready');

    // 4.1 设置
    settings.load();
  // 每次启动都算「没关」状态，避免上次的「全部关闭」残留
  try { settings.patch({ ui: { stopped: false } }); } catch (_) {}

    // 4.2 数据库
    db.init();

    // 4.3 内置页面
    registerBuiltinPages();

    // 4.4 开机自启状态对齐（用户手动删了注册表项也能自愈）
    if (settings.getIn('general.startOnBoot')) autolaunch.sync(true);

    // 4.5 插件
    plugins.scan();

    // 4.6 IPC
    remote.attach({
    settings,
    sendPrivate: qq.sendPrivate,
    log,
    aiChat: (messages, opts) => ai.chat(settings.getIn('model.active'), messages, opts),
  });

  ipc.register({ getInfo: buildInfo });

    Menu.setApplicationMenu(null);
    createWindow();

    // 4.7 通道：QQ 的状态/新消息转发给界面；配了「开机自动连」就直接连
    qq.onEvent((payload) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (win && !win.isDestroyed()) win.webContents.send('qq:event', payload);
      }
    });
    if (settings.getIn('channels.qq.autoConnect')) {
      log.info('qq: 自动连接已开启，开始连接');
      qq.connect();
    }
    // 4.8 自动回复：挂在 QQ 事件上，开关在「通道」页
    autoreply.attach();
    // 4.9 主动聊天：定时器，名单为空或没开就不做事
    growth.ensure();
    bond.ensure();
  usage.ensure();
    proactive.start();
    // 4.10 B 站：她会自己刷视频，隔一段时间私信推荐给你
    biliLife.start();
  pet.init();
    // 4.11 记忆：每 6 小时按遗忘曲线归档一次（不删）
    require('./core/memory').start();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    log.info('window-all-closed -> quit');
    app.quit();
  });

  app.on('before-quit', () => {
    log.info('before-quit');
    db.close();
  });
}

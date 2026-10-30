'use strict';
/**
 * 桌宠（自己的窗口版）
 * 用原版素材（pet-native\assets\webm，106 个动作），自己开一个透明置顶窗口。
 * 不依赖 DSH 宿主管道，全部落在本软件目录内。
 */
const path = require('path');
const fs = require('fs');
const { BrowserWindow, screen, ipcMain, Menu } = require('electron');
const settings = require('./settings');
const logger = require('./logger');

let win = null;
let holding = false;   // 鼠标按在桌宠上期间，禁止「点穿」定时器改窗口状态

function root() {
  const P = require('./paths');
  return path.join(P.root, 'pet-native');
}
function assetDir() {
  // 开发目录里有 pet-native\assets\webm（原版 106 个动作）；
  // 便携版/安装版只带 app\assets\pet 里那几张兜底素材，没有就走它。
  const native = path.join(root(), 'assets', 'webm');
  try {
    if (fs.existsSync(native)) return native;
  } catch (_) {
    /* 忽略 */
  }
  return path.join(path.dirname(__dirname), 'assets', 'pet');
}
function cfg() {
  const p = settings.getIn('pet') || {};
  return {
    enabled: !!p.enabled,
    size: Math.max(160, Math.min(600, Number(p.size) || 340)),
    opacity: Math.max(0.2, Math.min(1, Number(p.opacity) || 1)),
    alwaysOnTop: p.alwaysOnTop !== false,
    corner: p.corner || 'bottom-right',
  };
}
function running() {
  return !!(win && !win.isDestroyed());
}
function animList() {
  try {
    return fs.readdirSync(assetDir()).filter((f) => /\.webm$/i.test(f) && !/^余额-/.test(f));
  } catch (e) {
    logger.ex('pet.assets', e);
    return [];
  }
}
function pos(size) {
  const c = cfg().corner;
  const d = screen.getPrimaryDisplay().workAreaSize;
  const m = 24;
  const x = /left/.test(c) ? m : d.width - size - m;
  const y = /top/.test(c) ? m + 60 : d.height - size - m;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}
function open() {
  if (running()) {
    win.show();
    return cfg();
  }
  const dir = assetDir();
  const list = animList();
  if (!list.length) {
    logger.warn('pet: 没找到动作素材 ' + dir);
    return cfg();
  }
  const c = cfg();
  const p = pos(c.size);
  const idle = list.filter((n) => /原地漂浮踏步|东张西望/.test(n));
  const happy = list.filter((n) => /可爱宅舞|优雅女仆舞|凭空生花|原地跳跃抓碎头顶物品/.test(n));
  win = new BrowserWindow({
    width: c.size,
    height: c.size,
    x: p.x,
    y: p.y,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, '..', 'pet-preload.js') },
  });
  bindMove();
  win.setAlwaysOnTop(c.alwaysOnTop, 'screen-saver');
  win.setOpacity(c.opacity);
  const qs = new URLSearchParams({ dir, list: JSON.stringify(list), idle: idle.join('|'), happy: happy.join('|') });
  win.loadFile(path.join(__dirname, '..', 'pet.html'), { search: qs.toString() });
  win.once('ready-to-show', () => {
    win.showInactive();
  startHitTest();
    logger.info('pet: 桌宠窗口已显示（' + list.length + ' 个动作，' + c.size + 'px）');
  });
  win.on('closed', () => {
    win = null;
  });
  return cfg();
}
let moveBound = false;
let drag = null;   // 拖拽会话：光标相对窗口的抓取偏移 + 抓起时的真实宽高
function bindMove() {
  if (moveBound) return;
  moveBound = true;
  ipcMain.on('pet:move', (_e, dx, dy) => {
    if (!win || win.isDestroyed()) return;
    const [x, y] = win.getPosition();
    win.setPosition(x + Math.round(dx), y + Math.round(dy), false);
  });
  ipcMain.on('pet:dragStart', () => {
    if (!win || win.isDestroyed()) return;
    try {
      const b = win.getBounds();
      const cb = win.getContentBounds();
      const p = screen.getCursorScreenPoint();
      // 透明无边框窗在 150% 缩放下，getBounds（外框）比 setBounds 认的宽高多一圈「外框厚度」，
      // 直接回传 getBounds 的宽高会让窗口每拖一次胖 2px（实测 224→226→228…），所以这里先减掉再回传。
      drag = { ox: p.x - b.x, oy: p.y - b.y, w: b.width - (b.width - cb.width), h: b.height - (b.height - cb.height) };
    } catch (_) { drag = null; }
  });
  ipcMain.on('pet:dragMove', () => {
    if (!drag || !win || win.isDestroyed()) return;
    try {
      const p = screen.getCursorScreenPoint();
      // 位置用「光标 - 抓取偏移」算，不做累加，拖快了也不会越拖越偏；
      // 宽高用 drag.w/h（已扣掉外框），保证「拖多少次窗口都不会变胖」。
      win.setBounds({ x: p.x - drag.ox, y: p.y - drag.oy, width: drag.w, height: drag.h }, false);
    } catch (_) {}
  });
  ipcMain.on('pet:dragEnd', () => { drag = null; });
  // 按住鼠标期间强制「可点」：否则拖快了光标离开身体区域，startHitTest 会把窗口设成穿透，
  // 后续 pointerup 收不到，桌宠就一直以为鼠标还按着，再也点不动。
  ipcMain.on('pet:hold', (_e, on) => {
    holding = !!on;
    if (holding && win && !win.isDestroyed()) {
      try { win.setIgnoreMouseEvents(false); } catch (_) {}
    }
  });
}

  ipcMain.on('pet:menu', () => {
    if (!win || win.isDestroyed()) return;
    const c = cfg();
    const menu = Menu.buildFromTemplate([
      { label: '跟她说句话', click: () => win && win.webContents.send('pet:say') },
      { label: '换个动作', click: () => win && win.webContents.send('pet:act') },
      { type: 'separator' },
      { label: '大小', submenu: [
        { label: '小 (220)', click: () => apply({ size: 220, enabled: true }) },
        { label: '中 (340)', click: () => apply({ size: 340, enabled: true }) },
        { label: '大 (460)', click: () => apply({ size: 460, enabled: true }) },
      ] },
      { label: '总在最前', type: 'checkbox', checked: c.alwaysOnTop, click: (it) => apply({ alwaysOnTop: it.checked }) },
      { label: '贴哪个角', submenu: [
        { label: '右下', click: () => apply({ corner: 'bottom-right' }) },
        { label: '左下', click: () => apply({ corner: 'bottom-left' }) },
        { label: '右上', click: () => apply({ corner: 'top-right' }) },
        { label: '左上', click: () => apply({ corner: 'top-left' }) },
      ] },
      { type: 'separator' },
      { label: '隐藏桌宠', click: () => apply({ enabled: false }) },
    ]);
    menu.popup({ window: win });
  });
function close() {
  stopHitTest();
  holding = false;
  drag = null;
  if (running()) {
    try {
      win.destroy();
    } catch (_) {}
  }
  win = null;
}
function apply(patch) {
  let keepPos = null;
  let keepH = 0;
  if (win && !win.isDestroyed()) { try { const bb = win.getBounds(); keepPos = [bb.x, bb.y]; keepH = bb.height; } catch (_) {} }
  const next = cfg();
  Object.assign(next, patch || {});
  settings.patch({ pet: next });
  close();
  if (next.enabled) {
    open();
    if (keepPos && win && !win.isDestroyed()) {
      try {
        const nb = win.getBounds();
        // 以「脚底」为锚点：窗口高度变了就把 y 往上抬，位置看起来不飘
        const ny = keepPos[1] + (keepH ? keepH - nb.height : 0);
        win.setPosition(keepPos[0], ny, false);
      } catch (_) {}
    }
  }
  return next;
}
function init() {
  if (cfg().enabled) open();
}
function packs() {
  const base = path.join(root(), 'packs');
  const out = [];
  try {
    for (const d of fs.readdirSync(base, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const dir = path.join(base, d.name);
      let meta = { name: d.name };
      try { meta = Object.assign(meta, JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8'))); } catch (_) {}
      let count = 0;
      try { count = fs.readdirSync(dir).filter((f) => /\.webm$/i.test(f)).length; } catch (_) {}
      out.push({ id: d.name, name: meta.name || d.name, count });
    }
  } catch (_) {}
  // 内置：原版素材
  out.unshift({ id: 'maid', name: '蓝毛小女仆（原版）', count: animList().length });
  return out;
}
module.exports = { cfg, open, close, apply, init, running, assetDir, packs };
let hitTimer = null;
/** 只有光标落在角色身体那块区域才吃鼠标事件，周围透明区一律穿透 */
function startHitTest() {
  stopHitTest();
  const { screen } = require('electron');
  hitTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    if (holding) return;
    let b;
    try { b = win.getBounds(); } catch (_) { return; }
    const p = screen.getCursorScreenPoint();
    const w = b.width * 0.62;
    const h = b.height * 0.88;
    const left = b.x + (b.width - w) / 2;
    const top = b.y + (b.height - h);
    const inside = p.x >= left && p.x <= left + w && p.y >= top && p.y <= top + h;
    try { win.setIgnoreMouseEvents(!inside, { forward: true }); } catch (_) {}
  }, 45);
  if (hitTimer.unref) hitTimer.unref();
}
function stopHitTest() {
  if (hitTimer) { clearInterval(hitTimer); hitTimer = null; }
}
'use strict';

/**
 * 一键启动：把上次的配置原样拉起来，不用一项项点。
 *
 * 顺序：
 *   1. NapCat / QQ —— 没开就开（NapCat 的启动脚本会自己拉起 QQ，可能要等扫码/确认）
 *   2. QQ 通道 —— 等 3001 端口起来，再连进去
 *   3. B 站 —— 已经在跑，这里只确认登录态 + 自动私信是否开着
 *   4. 聊天 —— 自动回复、主动聊天都按设置里的开关走
 *
 * 设计原则：任何一步失败都不中断后面的步骤，最后把每一步的结果原样返回给界面。
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, execFileSync } = require('child_process');

const qq = require('./qq');
const bilibili = require('./bilibili');
const settings = require('./settings');
const log = require('./logger');
const proactive = require('./proactive');
const biliLife = require('./biliLife');

/** 以管理员身份注册的计划任务名（见 tools/napcat-task.ps1） */
const NAPCAT_TASK = 'DShOpen NapCat';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 端口探活（只看能不能连上，不做任何协议交互） */
function portOpen(port, timeout = 1200) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch (_) {
        /* ignore */
      }
      resolve(ok);
    };
    sock.setTimeout(timeout);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(port, '127.0.0.1');
  });
}

/** NapCat 的启动器是不是已经在跑 */
function napcatRunning() {
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq NapCatWinBootMain.exe', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 4000,
    });
    return /NapCatWinBootMain/i.test(out || '');
  } catch (_) {
    return false;
  }
}

function qqStatusText(st) {
  if (st === 'online') return '已连上';
  if (st === 'connecting') return '正在连';
  return '没连上';
}

/** 用计划任务静默拉起 NapCat（任务是以管理员身份注册的，所以不弹 UAC）。成功返回 true */
function runNapcatTask() {
  try {
    execFileSync('schtasks', ['/Run', '/TN', NAPCAT_TASK], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8000,
    });
    log.info('boot: 已用计划任务拉起 NapCat（' + NAPCAT_TASK + '）');
    return true;
  } catch (err) {
    log.warn('boot: 计划任务没跑起来，退回直接启动：' + String((err && err.message) || err));
    return false;
  }
}

/** NapCat 登录二维码（刚生成 2 分钟内的才算数），有就返回 data URL 给界面显示 */
function freshQr() {
  try {
    const p = path.join(path.dirname(qq.config().napcatPath || ''), 'cache', 'qrcode.png');
    if (!fs.existsSync(p)) return '';
    const st = fs.statSync(p);
    if (Date.now() - st.mtimeMs > 120000) return '';
    return 'file:///' + p.replace(/\\/g, '/') + '?t=' + Math.round(st.mtimeMs);
  } catch (_) {
    return '';
  }
}

// ---------------------------------------------------------------------------

async function startQQ(report) {
  const st = qq.status();
  const path = st.napcatPath;

  if (st.status === 'online') {
    report('qq', 'QQ 通道', true, '已经在线了：' + (st.selfName || st.selfId));
    return true;
  }

  // 1) 先把 NapCat/QQ 拉起来
  if (!path) {
    report('napcat', 'NapCat / QQ', false, '还没填 NapCat 启动程序，去「通道」页选一次');
    return false;
  }
  if (!fs.existsSync(path)) {
    report('napcat', 'NapCat / QQ', false, '找不到启动程序：' + path);
    return false;
  }

  const alreadyOpen = await portOpen(3001, 800);
  if (alreadyOpen) {
    report('napcat', 'NapCat / QQ', true, '已经在跑（3001 端口通）');
  } else {
    const running = napcatRunning();
    try {
      const silent = runNapcatTask();
      if (!silent) qq.launchNapCat();
      report(
        'napcat',
        'NapCat / QQ',
        true,
        silent
          ? '已用计划任务静默拉起（不弹权限框）'
          : running
            ? '已经开着，重新拉一次让它挂上钩子'
            : '已发出启动；Windows 会弹一个权限框，点「是」就行',
      );
    } catch (err) {
      report('napcat', 'NapCat / QQ', false, String(err.message || err));
      return false;
    }

    // 等端口：一直等到扫码完（最长 4 分钟）。二维码一出来就交给界面显示，
    // 但**不中断**——扫完 3001 会自己开，接着就连 QQ，不用再点第二次。
    let opened = false;
    for (let i = 0; i < 96; i++) {
      await sleep(2500);
      if (await portOpen(3001, 800)) {
        opened = true;
        break;
      }
      const qr = freshQr();
      if (qr && qr !== state.qr) {
        state.qr = qr;
        report('qq', 'QQ 通道', false, 'QQ 还没登录 —— 在下面扫码，扫完会自动接着连，不用再点一次', { qr });
      }
    }
    if (!opened) {
      report(
        'qq',
        'QQ 通道',
        false,
        freshQr() ? '等太久没登录：扫完码再点一次' : '等了 4 分钟 3001 还没开：QQ 可能卡在登录界面',
        freshQr() ? { qr: freshQr() } : null,
      );
      return false;
    }
    state.qr = '';
  }

  // 2) 连上去
  try {
    await qq.connect();
  } catch (err) {
    report('qq', 'QQ 通道', false, '连接失败：' + String(err.message || err));
    return false;
  }

  for (let i = 0; i < 12; i++) {
    const now = qq.status();
    if (now.status === 'online') {
      report('qq', 'QQ 通道', true, '已连上：' + (now.selfName || now.selfId));
      return true;
    }
    await sleep(1000);
  }
  report('qq', 'QQ 通道', false, '连接没成功，看看 NapCat 那边是不是没登录：' + qqStatusText(qq.status().status));
  return false;
}

async function startBili(report) {
  const st = bilibili.status();
  const logged = !!st.hasCookie;
  if (!logged) {
    report('bili', 'B 站', false, '还没登录，去「通道 → B 站账号」扫码登录');
    return false;
  }
  if (!st.ownerUid) {
    report('bili', 'B 站', false, '登录了，但还没填「管理员 UID」（私信只发给这个号）');
    return false;
  }
  const auto = st.autoDaily;
  report(
    'bili',
    'B 站',
    true,
    auto ? '已登录，自动私信开着（每 ' + st.everyMinutes + ' 分钟一条）' : '已登录，自动私信关着',
  );
  return true;
}

function reportChat(report) {
  const ar = settings.getIn('autoreply') || {};
  const pr = (settings.getIn('channels.qq.proactive') || {});
  report('reply', '聊天', true, ar.enabled ? '收到消息会自动回' : '自动回复关着（不会主动回话）');
  report(
    'proactive',
    '主动找你',
    true,
    pr.enabled ? '开着，大约每 ' + (pr.everyMinutes || 90) + ' 分钟看一次' : '关着，她不会主动说话',
  );
}

// ---------------------------------------------------------------------------

/** 最近一次启动的进度：界面可以轮询它，边跑边看 */
let state = { running: false, ok: false, steps: [], qr: '', startedAt: 0, finishedAt: 0 };

function snapshot() {
  return {
    running: state.running,
    ok: state.ok,
    steps: state.steps.slice(),
    qr: state.qr,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
  };
}

async function run() {
  const t0 = Date.now();
  const report = (key, label, ok, msg, extra) => {
    const step = { key, label, ok: !!ok, msg: String(msg || '') };
    if (extra && extra.qr) step.qr = extra.qr;
    // 同一个 key 再报一次就替换（比如扫码前后 QQ 那一步会从“还没登录”变成“已连上”）
    const idx = state.steps.findIndex((s) => s.key === key);
    if (idx >= 0) state.steps.splice(idx, 1, step);
    else state.steps.push(step);
    log.info('boot:', label, ok ? 'OK' : 'FAIL', '-', msg);
  };

  let qqOk = false;
  state.steps = [];
  try {
    qqOk = await startQQ(report);
  } catch (err) {
    report('qq', 'QQ 通道', false, String(err.message || err));
  }
  try {
    await startBili(report);
  } catch (err) {
    report('bili', 'B 站', false, String(err.message || err));
  }
  reportChat(report);

  state.ok = !!qqOk;
  state.finishedAt = Date.now();
  log.info('boot: 结束，用时 ' + (Date.now() - t0) + 'ms，QQ ' + (qqOk ? 'OK' : '没连上'));
}

/** 点按钮：立刻返回，实际在后台跑；界面轮询 status() 看进度 */
async function start() {
  if (state.running) return { started: false, ...snapshot() };
  state = { running: true, ok: false, paused: false, steps: [], qr: '', startedAt: Date.now(), finishedAt: 0 };
  try { settings.patch({ ui: { stopped: false } }); } catch (_) {}
  run()
    .catch((err) => log.error('boot: 意外错误 ' + String((err && err.message) || err)))
    .finally(() => {
      state.running = false;
      state.finishedAt = state.finishedAt || Date.now();
    });
  return { started: true, ...snapshot() };
}

/** 全部关闭：断开 QQ、停掉主动聊天和自动私信（本体的自动回复随之失效） */
async function stop() {
  if (state.running) return { stopped: false, ...snapshot() };
  const steps = [];
  try {
    await qq.disconnect();
    steps.push({ key: 'qq', label: 'QQ 通道', ok: true, msg: '已经断开' });
  } catch (err) {
    steps.push({ key: 'qq', label: 'QQ 通道', ok: false, msg: String((err && err.message) || err) });
  }
  try {
    proactive.stop();
    steps.push({ key: 'proactive', label: '主动聊天', ok: true, msg: '已经停了' });
  } catch (_) {
    /* 停不了也继续往下 */
  }
  try {
    biliLife.stop();
    steps.push({ key: 'bili', label: 'B 站 自动私信', ok: true, msg: '已经停了' });
  } catch (_) {
    /* 同上 */
  }
  state = { running: false, ok: false, paused: true, steps, qr: '', startedAt: state.startedAt, finishedAt: Date.now() };
  try { settings.patch({ ui: { stopped: true } }); } catch (_) {}
  log.info('boot: 已全部关闭');
  return { stopped: true, ...snapshot() };
}

/** 不触发任何动作，只把当前状态读出来（界面初始化 / 轮询进度用） */
function status() {
  const st = qq.status();
  const bi = bilibili.status();
  const ar = settings.getIn('autoreply') || {};
  const pr = settings.getIn('channels.qq.proactive') || {};
  return {
    ...snapshot(),
    paused: !!(state.paused || settings.getIn('ui.stopped')),
    qq: { status: st.status, selfName: st.selfName, selfId: st.selfId },
    bili: { logged: !!bi.hasCookie, autoDaily: !!bi.autoDaily, ownerUid: bi.ownerUid || '' },
    chat: { autoreply: !!ar.enabled, proactive: !!pr.enabled },
  };
}

module.exports = { start, stop, status };

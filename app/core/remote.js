'use strict';

/**
 * QQ 遥控电脑
 * ------------------------------------------------------------
 * 你在 QQ 里说一句话，她把这句翻译成一个受控动作，执行完回你结果。
 *
 * 三道闸：
 *   1. 总开关（设置里关着就完全不理）
 *   2. 谁可以遥控：只认管理员 QQ + 这个白名单
 *   3. 危险动作（关机/重启/锁屏/打字/跑命令）要带「确认」两个字
 *
 * 危险动作默认连开关都没有：run_cmd 必须在设置里单独打开。
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const P = require('./paths');

const ACTIONS = [
  { id: 'open_url', desc: '用默认浏览器打开网址', arg: 'url' },
  { id: 'web_search', desc: '在浏览器里搜一句话', arg: 'q' },
  { id: 'open_app', desc: '打开本机某个程序（记事本、计算器等）', arg: 'name' },
  { id: 'volume', desc: '音量加/减/静音', arg: 'mode' },
  { id: 'media', desc: '播放暂停/下一首/上一首', arg: 'mode' },
  { id: 'screenshot', desc: '截屏并发回来', arg: '' },
  { id: 'sysinfo', desc: '看 CPU、内存、磁盘', arg: '' },
  { id: 'ls', desc: '列出某个目录里有啥', arg: 'path' },
  { id: 'lock', desc: '锁屏（危险）', arg: '' },
  { id: 'sleep', desc: '睡眠（危险）', arg: '' },
  { id: 'shutdown', desc: '关机（危险）', arg: '' },
  { id: 'restart', desc: '重启（危险）', arg: '' },
  { id: 'type_text', desc: '在活动窗口里打一段字（危险）', arg: 'text' },
  { id: 'clipboard_get', desc: '读剪贴板', arg: '' },
  { id: 'clipboard_set', desc: '写剪贴板', arg: 'text' },
  { id: 'run_cmd', desc: '跑一条 PowerShell 命令（最危险，要单独开）', arg: 'cmd' },
  { id: 'signout', desc: '注销当前 Windows 用户（危险）', arg: '' },
  { id: 'uninstall', desc: '卸载一个程序（危险，走 winget）', arg: 'name' },
];

const DANGEROUS = new Set(['lock', 'sleep', 'shutdown', 'restart', 'type_text', 'run_cmd', 'signout', 'uninstall']);

// ---- 「!Control computer：确认关机」这一行，是危险动作唯一放行的凭据 ----
// 规矩：这一行必须自己占一行，行首就是它，前面不能有任何字。
// 这样模型在闲聊里顺手写出这几个词也不会被当成指令（防止误答）。
const PREFIX = '!Control computer';
const PENDING_MS = 5 * 60 * 1000;
const pending = new Map(); // userId -> { action, arg, label, at }

const REFUSALS = ['没有权限哦~嘻嘻', '没有权限哦~嘻嘻', '这个我可不敢乱来，嘻嘻', '这种大事得先有权限才行。'];

const VERBS = [
  { re: /取消关机|取消重启|别关机|不要关机/, action: 'cancel_shutdown', label: '取消关机' },
  { re: /关机|关电脑|关掉电脑/, action: 'shutdown', label: '关机' },
  { re: /重启|重新启动/, action: 'restart', label: '重启' },
  { re: /注销|登出/, action: 'signout', label: '注销' },
  { re: /睡眠|休眠/, action: 'sleep', label: '睡眠' },
  { re: /锁屏/, action: 'lock', label: '锁屏' },
  { re: /卸载\s*([^\n，。！？,.!?]+)?/, action: 'uninstall', label: '卸载' },
];

function dangerOf(text) {
  const t = String(text || '');
  for (const v of VERBS) {
    const m = t.match(v.re);
    if (!m) continue;
    return { action: v.action, arg: v.action === 'uninstall' ? String(m[1] || '').trim() : '', label: v.label };
  }
  return null;
}

function isCommandLine(line) {
  return new RegExp('^[ \\t]*!control computer[ \\t]*[:：]', 'i').test(String(line || ''));
}

function parseCommandLine(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    if (!isCommandLine(line)) continue;
    let body = String(line).replace(/^[ \t]*!control computer[ \t]*[:：]/i, '').trim();
    body = body.replace(/^(确认|确定|执行|请|帮我)[\s:：]*/gi, '').trim();
    const d = dangerOf(body);
    if (d) return d;
    const m = body.match(/^(run_cmd|命令|cmd)[:：\s]+([\s\S]+)$/i);
    if (m) return { action: 'run_cmd', arg: m[2], label: '跑命令' };
  }
  return null;
}

let settings = null;
let ctx = null; // { sendPrivate, log, aiChat }

const NLU = `你在把用户的话翻译成电脑操作，输出 JSON，不要解释。
可用动作：
open_url{url} / web_search{q} / open_app{name} / volume{mode: up|down|mute} / media{mode: playpause|next|prev}
screenshot / sysinfo / ls{path} / lock / sleep / shutdown / restart / type_text{text} / clipboard_get / clipboard_set{text} / run_cmd{cmd} / none
例子：{"action":"open_url","url":"https://www.bilibili.com"}
如果不是在指挥电脑，输出 {"action":"none"}
只输出 JSON。`;

function cfg() {
  const r = (settings.getIn('remote') || {});
  return {
    enabled: !!r.enabled,
    allowed: Array.isArray(r.allowed) ? r.allowed.map(String) : [],
    allowRunCmd: !!r.allowRunCmd,
    maxPerMinute: Math.min(30, Math.max(1, Number(r.maxPerMinute) || 8)),
  };
}

function ownerQq() {
  try {
    return String(settings.getIn('channels.qq.ownerQq') || '');
  } catch (_) {
    return '';
  }
}

function allowed(userId) {
  const id = String(userId || '');
  if (!id) return false;
  if (ownerQq() && id === ownerQq()) return true;
  return cfg().allowed.includes(id);
}

// ---------------------------------------------------------------- 执行

function ps(script, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, windowsHide: true, encoding: 'utf8' },
      (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout || '').trim(), err: String(stderr || (err && err.message) || '').trim() }),
    );
  });
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

async function shot() {
  const dir = path.join(P.data, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'shot-' + Date.now() + '.png');
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
    '$b = [System.Windows.Forms.SystemInformation]::VirtualScreen',
    '$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height',
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    '$g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)',
    '$bmp.Save(' + q(file) + ', [System.Drawing.Imaging.ImageFormat]::Png)',
    '$g.Dispose(); $bmp.Dispose()',
  ].join('; ');
  const r = await ps(script, 20000);
  return r.ok && fs.existsSync(file) ? file : '';
}

async function run(action, arg, text) {
  const a = String(action || '');
  const v = String(arg || '').trim();

  if (a === 'open_url') {
    if (!/^https?:\/\//i.test(v)) return '这个地址不太对，我只开 http/https 开头的。';
    await ps('Start-Process ' + q(v));
    return '打开了：' + v;
  }
  if (a === 'web_search') {
    const u = 'https://www.bing.com/search?q=' + encodeURIComponent(v || '');
    await ps('Start-Process ' + q(u));
    return '搜了：' + (v || '');
  }
  if (a === 'open_app') {
    const map = { 记事本: 'notepad', 计算器: 'calc', 画图: 'mspaint', 资源管理器: 'explorer', 任务管理器: 'taskmgr', 设置: 'ms-settings:' };
    const cmd = map[v] || v;
    if (!cmd) return '要打开哪个程序？';
    await ps('Start-Process ' + q(cmd));
    return '试着打开了：' + cmd;
  }
  if (a === 'volume') {
    const step = v === 'mute' ? '' : '($w = New-Object -ComObject WScript.Shell); ' + (v === 'down' ? '[void]$w.SendKeys([char]174)' : '[void]$w.SendKeys([char]175)');
    if (v === 'mute') await ps('(New-Object -ComObject WScript.Shell).SendKeys([char]173)');
    else await ps(step);
    return v === 'mute' ? '静音切换了一下' : v === 'down' ? '音量调小了一点' : '音量调大了一点';
  }
  if (a === 'media') {
    const key = { playpause: 179, next: 176, prev: 177 }[v] || 179;
    await ps('(New-Object -ComObject WScript.Shell).SendKeys([char]' + key + ')');
    return '媒体键点了：' + v;
  }
  if (a === 'screenshot') {
    const f = await shot();
    return f ? '__SHOT__' + f : '截屏没成功（可能是权限问题）';
  }
  if (a === 'sysinfo') {
    const r = await ps(
      "$os=Get-CimInstance Win32_OperatingSystem; $cpu=(Get-CimInstance Win32_Processor).LoadPercentage; $d=Get-PSDrive D; '内存剩余 {0:N1} GB / 共 {1:N1} GB；CPU {2}%；D 盘剩余 {3:N0} GB' -f ($os.FreePhysicalMemory/1MB),($os.TotalVisibleMemorySize/1MB),$cpu,($d.Free/1GB)",
      20000,
    );
    return r.ok ? r.out : '没读到系统信息：' + r.err.slice(0, 120);
  }
  if (a === 'ls') {
    const target = v || 'D:\\';
    const r = await ps('(Get-ChildItem -LiteralPath ' + q(target) + ' -ErrorAction Stop | Select-Object -First 30 | ForEach-Object { if ($_.PSIsContainer) { "[目录] " + $_.Name } else { $_.Name + "  (" + [math]::Round($_.Length/1KB) + " KB)" } }) -join "`n"', 20000);
    return r.ok ? '(' + target + ')\n' + (r.out || '（空）') : '打不开这个目录：' + r.err.slice(0, 120);
  }
  if (a === 'lock') {
    await ps('rundll32.exe user32.dll,LockWorkStation');
    return '锁屏了，等下见。';
  }
  if (a === 'sleep') {
    await ps('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
    return '让她睡了一会儿（电脑进入睡眠）。';
  }
  if (a === 'shutdown') {
    await ps('shutdown.exe /s /t 60');
    return '60 秒后关机。反悔的话发「取消关机」。';
  }
  if (a === 'restart') {
    await ps('shutdown.exe /r /t 60');
    return '60 秒后重启。反悔的话发「取消关机」。';
  }
  if (a === 'cancel_shutdown') {
    const r = await ps('shutdown.exe /a');
    return r.ok ? '好，关机/重启取消了。' : '现在没有在等的关机/重启，不用取消。';
  }
  if (a === 'type_text') {
    await ps('(New-Object -ComObject WScript.Shell).SendKeys(' + q(String(text || v).replace(/[+^%~(){}[\]]/g, ' ')) + ')');
    return '打进去了：' + String(text || v).slice(0, 40);
  }
  if (a === 'clipboard_get') {
    const r = await ps('Get-Clipboard');
    return r.ok ? '剪贴板：\n' + (r.out || '（空）').slice(0, 500) : '读不到剪贴板';
  }
  if (a === 'clipboard_set') {
    await ps('Set-Clipboard -Value ' + q(v));
    return '写进剪贴板了：' + v.slice(0, 60);
  }
  if (a === 'run_cmd') {
    if (!cfg().allowRunCmd) return '跑命令这个开关没开，去「模型 → 遥控电脑」里打开才能用。';
    const r = await ps(v, 60000);
    return '命令跑完了：\n' + (r.out || r.err || '（没有输出）').slice(0, 1200);
  }
  if (a === 'signout') {
    await ps('shutdown.exe /l');
    return '注销了，等下见。';
  }
  if (a === 'uninstall') {
    if (!v) return '要卸载哪个？说个程序名（比如 微信）。';
    const r = await ps(
      'winget uninstall --name ' + q(v) + ' --silent --accept-source-agreements --disable-interactivity',
      120000,
    );
    return r.ok ? '开始卸载「' + v + '」了：\n' + (r.out || '（没输出，多半在后台装）').slice(0, 400) : '卸载没成：' + (r.err || '（winget 没认出来）').slice(0, 200);
  }
  return '';
}

// ---------------------------------------------------------------- 入口

function logLine(entry) {
  try {
    const f = path.join(P.data, 'remote-log.jsonl');
    fs.appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  } catch (_) {
    /* 记不住就算了 */
  }
}

function needsConfirm(text) {
  return /确认|确定|真的|execute|confirm/i.test(String(text || ''));
}

function labelOf(action) {
  const a = ACTIONS.find((x) => x.id === action);
  return a ? String(a.desc).replace(/（.*?）/g, '') || action : action;
}

/**
 * 管理员问了危险动作时给的「格式提示」：告诉他该发哪一行，本身绝不执行。
 * 注意这里不调 applyOutgoing —— 提示里那行是给他复制用的，不是给她执行的。
 */
function hintOf(d) {
  const line = PREFIX + '：确认' + d.label + (d.arg ? ' ' + d.arg : '');
  return '要' + d.label + '的话，把这行原样发给我（`!` 和冒号都要，前面别加别的话）：\n' + line;
}

async function execNow(userId, action, arg, raw) {
  try {
    pending.delete(String(userId || ''));
    const out = await run(action, arg, raw);
    logLine({
      user: String(userId),
      text: String(raw || '').slice(0, 200),
      action,
      arg: String(arg || '').slice(0, 120),
      ok: !!out,
      via: 'confirm',
    });
    return out || '';
  } catch (err) {
    return '没做成：' + String((err && err.message) || err);
  }
}

/**
 * 任何要发出去的话都先过这里：
 * 看到「!Control computer：…」这一行就执行，再从文字里把这行摘掉（聊天里不留这行）。
 * 写这话的人没权限 → 一个字都不执行，换成一句拒绝。
 */
async function applyOutgoing(text, userId) {
  const s = String(text == null ? '' : text);
  const cmd = parseCommandLine(s);
  if (!cmd) return { text: s, ran: false };
  const cleaned = s
    .split(/\r?\n/)
    .filter((line) => !isCommandLine(line))
    .join('\n')
    .trim();
  if (!allowed(userId)) {
    logLine({ user: String(userId), text: s.slice(0, 200), action: cmd.action, ok: false, via: 'denied' });
    return { text: cleaned || '嘻嘻~你没有权限啦~快去找管理员要吧', ran: false, denied: true };
  }
  const out = await execNow(userId, cmd.action, cmd.arg, s);
  const body = [cleaned, out].filter(Boolean).join('\n');
  return { text: body, ran: true, result: out };
}

async function handle(userId, text) {
  const c = cfg();
  if (!c.enabled) return '';
  const raw = String(text || '').trim();
  if (!raw) return '';

  // 有人直接把「!Control computer：确认关机」发过来（等于自己按了确认）
  const cmdIn = parseCommandLine(raw);
  if (cmdIn) {
    if (!allowed(userId)) {
      logLine({ user: String(userId), text: raw.slice(0, 200), action: cmdIn.action, ok: false, via: 'denied' });
      return '嘻嘻~你没有权限啦~快去找管理员要吧';
    }
    return execNow(userId, cmdIn.action, cmdIn.arg, raw);
  }

  const id = String(userId || '');
  const pend = pending.get(id);

  // 「为什么没有权限 / 凭什么 / 怎么才能用」→ 这时候才查权限：有就给出确认指令，没有就让他去找管理员
  if (
    pend &&
    Date.now() - pend.at < PENDING_MS &&
    /权限|为什么|为啥|凭什么|怎么才|怎么才能|谁允许|谁给的|找谁|哪儿问/.test(raw)
  ) {
    pending.delete(id);
    return '嘻嘻~你没有权限啦~快去找管理员要吧';
  }

  // 危险动作：管理员 → 只告诉他该发哪一行（本身不执行）；别人 → 一律拒绝一次并记住
  const d = dangerOf(raw);
  if (d) {
    if (d.action === 'cancel_shutdown') return allowed(userId) ? execNow(userId, 'cancel_shutdown', '', raw) : '';
    if (allowed(userId)) return hintOf(d);
    pending.set(id, { ...d, at: Date.now() });
    return REFUSALS[Math.floor(Math.random() * REFUSALS.length)];
  }

  if (!allowed(userId)) return '';

  let parsed = null;
  try {
    const out = await ctx.aiChat(
      [
        { role: 'system', content: NLU },
        { role: 'user', content: raw.slice(0, 300) },
      ],
      { temperature: 0, maxTokens: 120, timeoutMs: 15000 },
    );
    const m = String(out || '').match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (_) {
    return ''; // 模型没看懂就当不是命令，交回普通聊天
  }
  if (!parsed || !parsed.action || parsed.action === 'none') return '';

  const action = String(parsed.action);
  const arg = parsed.url || parsed.q || parsed.name || parsed.mode || parsed.path || parsed.text || parsed.cmd || '';

  if (DANGEROUS.has(action) && !needsConfirm(raw)) {
    return hintOf({ action, label: labelOf(action), arg: String(arg || '').slice(0, 40) });
  }

  let out = '';
  try {
    out = await run(action, arg, raw);
  } catch (err) {
    out = '没做成：' + String((err && err.message) || err);
  }
  logLine({ user: String(userId), text: raw, action, arg: String(arg).slice(0, 120), ok: !!out });

  if (!out) return '';
  if (out.startsWith('__SHOT__')) {
    const file = out.slice(8);
    return { text: '截了张屏，看看：', file };
  }
  return out;
}

module.exports = {
  ACTIONS,
  PREFIX,
  attach({ settings: s, sendPrivate, log, aiChat }) {
    settings = s;
    ctx = { sendPrivate, log, aiChat };
    settings = s;
  },
  cfg,
  allowed,
  handle,
  run,
  applyOutgoing,
  parseCommandLine,
  dangerOf,
  isCommandLine,
};

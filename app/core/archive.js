'use strict';
/**
 * 全量存档（只追加、永不注入提示词）
 * 记忆卡会被遗忘、归压缩；这里另存一份原材料，JSONL 按月分文件。
 * 它只占硬盘不占 token —— 检索时才读，而且只读命中的几行。
 */
const fs = require('fs');
const path = require('path');
const P = require('./paths');

function dir() {
  const d = path.join(P.data, 'archive');
  try { fs.mkdirSync(d, { recursive: true }); } catch (_) {}
  return d;
}

function fileOf(d = new Date()) {
  const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return path.join(dir(), ym + '.jsonl');
}

/** 追加一条：{who, text, at, kind} */
function append(entry) {
  try {
    const line = JSON.stringify({ at: Date.now(), ...entry }) + '\n';
    fs.appendFileSync(fileOf(), line, 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}

function listFiles() {
  try {
    return fs.readdirSync(dir()).filter((f) => f.endsWith('.jsonl')).sort().reverse();
  } catch (_) {
    return [];
  }
}

/** 读最近 n 条（倒序取文件，遇到够数就停） */
function recent(n = 50) {
  const out = [];
  for (const f of listFiles()) {
    let lines = [];
    try {
      lines = fs.readFileSync(path.join(dir(), f), 'utf8').split('\n').filter(Boolean);
    } catch (_) { continue; }
    for (let i = lines.length - 1; i >= 0 && out.length < n; i--) {
      try { out.push(JSON.parse(lines[i])); } catch (_) {}
    }
    if (out.length >= n) break;
  }
  return out;
}

/** 在存档里搜关键词（不走向量，纯文本），最多扫描最近 3000 条 */
function search(q, limit = 10) {
  const key = String(q || '').trim();
  if (!key) return [];
  const out = [];
  let scanned = 0;
  for (const f of listFiles()) {
    let lines = [];
    try { lines = fs.readFileSync(path.join(dir(), f), 'utf8').split('\n').filter(Boolean); } catch (_) { continue; }
    for (let i = lines.length - 1; i >= 0; i--) {
      scanned += 1;
      if (scanned > 3000) return out.slice(0, limit);
      try {
        const o = JSON.parse(lines[i]);
        if (String(o.text || '').includes(key)) out.push(o);
        if (out.length >= limit) return out;
      } catch (_) {}
    }
  }
  return out;
}

function stats() {
  let count = 0;
  let bytes = 0;
  const files = listFiles();
  for (const f of files) {
    try {
      const st = fs.statSync(path.join(dir(), f));
      bytes += st.size;
      count += Math.max(0, Math.round(st.size / 120)); // 粗估，界面上不追求精确
    } catch (_) {}
  }
  return { files: files.length, months: files.map((f) => f.replace('.jsonl', '')), approx: count, mb: +(bytes / 1048576).toFixed(2) };
}

module.exports = { append, recent, search, stats, dir };

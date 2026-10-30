'use strict';
/* 记忆预生成卡：把记忆压成一张固定预算的卡，省掉每轮向量检索。 */
const fs = require('fs');
const path = require('path');
const P = require('./paths');
const memory = require('./memory');

const FILE = path.join(P.data, 'memcard.json');
const TTL = 3 * 60 * 60 * 1000;   // 3 小时或记忆数变了才重建
const BUDGET = 520;               // 卡片字数上限

let cache = null;

function read() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) { cache = null; }
  return cache;
}
function write(obj) {
  cache = obj;
  try {
    fs.mkdirSync(P.data, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(obj), 'utf8');
  } catch (_) {}
}

/** 重建卡片：按强度排序取前若干条，拼成预算内的一段话 */
function rebuild(force) {
  const v = read();
  const stat = memory.stats();
  const count = (stat && stat.total) || 0;
  if (!force && v && v.count === count && Date.now() - v.at < TTL) return v;
  let list = [];
  try { list = memory.list() || []; } catch (_) { list = []; }
  list.sort((a, b) => (b.strength || 0) - (a.strength || 0));
  const picked = [];
  let used = 0;
  for (const m of list) {
    const line = '· ' + String(m.text || '').trim();
    if (used + line.length > BUDGET) break;
    picked.push(line);
    used += line.length;
  }
  const obj = { at: Date.now(), count, text: picked.join('\n'), n: picked.length };
  write(obj);
  return obj;
}

/** 取卡片文本（没有就用空串，调用方自己兜底） */
function get(force) {
  const v = rebuild(!!force);
  return (v && v.text) || '';
}
function info() {
  const v = rebuild(false);
  return { n: v.n || 0, count: v.count || 0, chars: (v.text || '').length, at: v.at || 0, text: v.text || '' };
}

module.exports = { get, rebuild, info };
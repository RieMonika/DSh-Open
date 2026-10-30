'use strict';
/**
 * 主动动机
 * 「主动找你」以前只会挑最久没聊的人说一句干巴巴的话。
 * 这里让她先想明白「我最近在意什么」，再带着这个由头来找你。
 * 用本地小模型（qwen2.5:0.5b）跑，不花钱；缓存 6 小时。
 */
const fs = require('fs');
const path = require('path');
const P = require('./paths');
const settings = require('./settings');
const ai = require('./ai');
const memory = require('./memory');

const TTL = 6 * 3600 * 1000;

function fileOf() {
  return path.join(P.data, 'motive.json');
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(fileOf(), 'utf8')) || {};
  } catch (_) {
    return {};
  }
}

function save(o) {
  try {
    fs.mkdirSync(P.data, { recursive: true });
    fs.writeFileSync(fileOf(), JSON.stringify(o, null, 2), 'utf8');
  } catch (_) {}
}

/** 当前动机（可能为空） */
function current(force = false) {
  const o = load();
  if (!force && o.text && Date.now() - (o.at || 0) < TTL) return o;
  return o;
}

/**
 * 刷新动机：拿最近几条记忆，让小模型挑一条她“最在意的”，写成一句好奇。
 * 失败就退回一条记忆原文。
 */
async function refresh() {
  const items = (memory.list(8) || []).map((m) => m.text).filter(Boolean);
  if (!items.length) return current();
  const sys =
    '你是一个爱琢磨的人。下面是你最近记住的关于主人的事。' +
    '从中挑一件你最想弄明白、或者最想接着聊的，用一句 15~30 字的话写出来，' +
    '只输出这一句话，不要解释、不要列表、不要引号。';
  let text = '';
  try {
    const reply = await ai.chat(settings.getIn('model.memory.distill.provider') || 'ollama', [
      { role: 'system', content: sys },
      { role: 'user', content: items.join('\n') },
    ], {
      model: settings.getIn('model.memory.distill.model') || 'qwen2.5:0.5b',
      temperature: 0.8,
      maxTokens: 80,
      timeoutMs: 25000,
    });
    text = String(reply || '').replace(/^["「『]|["」』]$/g, '').trim().split('\n')[0];
  } catch (_) {}
  if (!text || text.length < 6) text = items[0];
  const o = { text: text.slice(0, 60), from: items[0], at: Date.now() };
  save(o);
  return o;
}

/** 给提示词用的一句话 */
function hint() {
  const o = current();
  return o && o.text ? '你最近一直在琢磨的事：' + o.text + '。' : '';
}

module.exports = { current, refresh, hint, fileOf };

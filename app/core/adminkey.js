'use strict';

/**
 * 管理员页的密钥
 * ------------------------------------------------------------
 * 单独一个文件放着（data\admin-key.json），里面只有 scrypt 哈希 + 随机 salt，
 * 不存明文 —— 就算别人翻到 data 目录也看不到密钥本身。
 *
 * 规则（界面上也照这个校验）：
 *   随机生成：正好 15 位，含大写、小写、数字，下划线最多一个
 *   自己填：长度 6–15，必须同时有大写、小写、数字，下划线最多一个
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const paths = require('./paths');
const log = require('./logger');

const FILE = path.join(paths.data, 'admin-key.json');
const MIN_LEN = 6;
const MAX_LEN = 15;
const RANDOM_LEN = 15;
const MAX_UNDERSCORE = 1;
const MAX_TRIES = 5;
const COOL_MS = 30 * 1000;

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGIT = '23456789';
const ALNUM = UPPER + LOWER + DIGIT;

let fails = 0;
let coolUntil = 0;

function rules() {
  return { min: MIN_LEN, max: MAX_LEN, randomLen: RANDOM_LEN, maxUnderscore: MAX_UNDERSCORE };
}

function readFile() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.hash !== 'string' || typeof obj.salt !== 'string') return null;
    return obj;
  } catch (_) {
    return null;
  }
}

function writeFile(obj) {
  paths.ensureDir(paths.data);
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2), 'utf8');
}

/** 校验一条用户自己填的密钥 */
function validate(key) {
  const s = String(key == null ? '' : key);
  if (!s) return { ok: false, error: '密钥不能是空的' };
  if (s.length < MIN_LEN || s.length > MAX_LEN) {
    return { ok: false, error: '长度要在 ' + MIN_LEN + '–' + MAX_LEN + ' 位之间（现在是 ' + s.length + ' 位）' };
  }
  if (!/^[A-Za-z0-9_]+$/.test(s)) return { ok: false, error: '只能用字母、数字和下划线' };
  const under = (s.match(/_/g) || []).length;
  if (under > MAX_UNDERSCORE) return { ok: false, error: '下划线最多一个' };
  if (!/[A-Z]/.test(s)) return { ok: false, error: '至少要有一个大写字母' };
  if (!/[a-z]/.test(s)) return { ok: false, error: '至少要有一个小写字母' };
  if (!/[0-9]/.test(s)) return { ok: false, error: '至少要有一个数字' };
  return { ok: true };
}

function pick(str) {
  return str[crypto.randomInt(0, str.length)];
}

/** 随机 15 位：至少一个大写、一个小写、一个数字、正好一个下划线 */
function generate() {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), '_'];
  while (chars.length < RANDOM_LEN) chars.push(pick(ALNUM));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    const t = chars[i];
    chars[i] = chars[j];
    chars[j] = t;
  }
  const out = chars.join('');
  // 万一洗牌后把唯一的 _ 洗到不合规的位置也无所谓，规则只限制数量
  if (validate(out).ok) return out;
  return generate();
}

function hashOf(key, salt) {
  return crypto.scryptSync(String(key), salt, 32).toString('hex');
}

function status() {
  const data = readFile();
  return {
    hasKey: !!data,
    createdAt: data && data.createdAt ? data.createdAt : 0,
    mode: data && data.mode ? data.mode : '',
    rules: rules(),
    tries: fails,
    coolRemainMs: Math.max(0, coolUntil - Date.now()),
  };
}

/** 第一次设密钥；mode = 'random' | 'custom' */
function setup(patch) {
  const p = patch || {};
  if (readFile()) return { ok: false, error: '已经设过密钥了，直接输密钥进就行（要换的话在页面里改）' };
  let key = '';
  let mode = p.mode === 'random' ? 'random' : 'custom';
  if (mode === 'random') {
    key = generate();
  } else {
    const check = validate(p.key);
    if (!check.ok) return { ok: false, error: check.error };
    key = String(p.key);
  }
  const salt = crypto.randomBytes(16).toString('hex');
  writeFile({ algo: 'scrypt', salt, hash: hashOf(key, salt), mode, createdAt: Date.now() });
  fails = 0;
  coolUntil = 0;
  log.info('adminkey: 已设置密钥（' + mode + '，' + key.length + ' 位）');
  return { ok: true, key: mode === 'random' ? key : '', mode, rules: rules() };
}

function verify(key) {
  const now = Date.now();
  if (coolUntil > now) {
    return { ok: false, error: '试太多次了，' + Math.ceil((coolUntil - now) / 1000) + ' 秒再试', coolRemainMs: coolUntil - now };
  }
  const data = readFile();
  if (!data) return { ok: false, error: '还没设过密钥' };
  const a = Buffer.from(hashOf(key, data.salt), 'hex');
  const b = Buffer.from(data.hash, 'hex');
  const same = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (same) {
    fails = 0;
    coolUntil = 0;
    return { ok: true };
  }
  fails += 1;
  if (fails >= MAX_TRIES) {
    fails = 0;
    coolUntil = now + COOL_MS;
    return { ok: false, error: '错了太多次，等 30 秒再试', coolRemainMs: COOL_MS };
  }
  return { ok: false, error: '密钥不对（还能试 ' + (MAX_TRIES - fails) + ' 次）' };
}

/** 换密钥：先验旧的 */
function change(patch) {
  const p = patch || {};
  const old = verify(p.oldKey);
  if (!old.ok) return old;
  const check = validate(p.newKey);
  if (!check.ok) return { ok: false, error: check.error };
  const salt = crypto.randomBytes(16).toString('hex');
  const prev = readFile() || {};
  writeFile({ algo: 'scrypt', salt, hash: hashOf(p.newKey, salt), mode: prev.mode || 'custom', createdAt: prev.createdAt || Date.now() });
  log.info('adminkey: 密钥已更换');
  return { ok: true };
}

module.exports = { status, setup, verify, change, validate, generate, rules };

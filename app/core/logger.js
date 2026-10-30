'use strict';

/**
 * 日志
 * ------------------------------------------------------------
 * 按天写 <data>\logs\app-YYYY-MM-DD.log。
 * 启动早期（日志系统还没准备好时）可以打开 boot 镜像，同时写 <data>\boot.log，
 * 这样"软件一启动就崩"也有痕迹可查。
 */

const fs = require('node:fs');
const path = require('node:path');
const P = require('./paths');

let mirrorBoot = false;
let ready = false;

function safe(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function dayFile() {
  return path.join(P.logs, 'app-' + new Date().toISOString().slice(0, 10) + '.log');
}

function write(level, parts) {
  const line = `[${new Date().toISOString()}] [${level}] ${parts.map(safe).join(' ')}\n`;
  try {
    if (!ready) {
      P.ensureDir(P.data);
      P.ensureDir(P.logs);
      ready = true;
    }
    fs.appendFileSync(dayFile(), line);
    if (mirrorBoot) fs.appendFileSync(path.join(P.data, 'boot.log'), line);
  } catch (_) {
    /* 日志写不进去也不能影响主流程 */
  }
}

const logger = {
  /** 打开 boot.log 镜像（启动阶段用） */
  boot(on = true) {
    mirrorBoot = !!on;
    return logger;
  },
  info: (...a) => write('INFO', a),
  warn: (...a) => write('WARN', a),
  error: (...a) => write('ERROR', a),
  debug: (...a) => write('DEBUG', a),
  /** 记录异常，带调用位置 */
  ex(tag, err) {
    write('ERROR', [tag + ':', err && err.stack ? err.stack : safe(err)]);
  },
  dayFile,
};

module.exports = logger;

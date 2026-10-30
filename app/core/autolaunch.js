'use strict';

/**
 * 开机自启动
 * ------------------------------------------------------------
 * 用注册表 HKCU\...\Run 实现。
 * 特意不用"启动文件夹里的快捷方式"——那个会往 C 盘写文件，
 * 注册表项不产生文件，而且用户随时能在任务管理器里看到。
 */

const { execFileSync } = require('node:child_process');
const log = require('./logger');

const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_VALUE = 'DShOpen';

function run(args) {
  return execFileSync('reg', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
}

const autolaunch = {
  supported: process.platform === 'win32',

  isEnabled() {
    if (!autolaunch.supported) return false;
    try {
      const out = run(['query', REG_KEY, '/v', REG_VALUE]);
      return /DShOpen|DSh[ _-]Open/i.test(out || '');
    } catch (_) {
      return false;
    }
  },

  setEnabled(on) {
    if (!autolaunch.supported) return false;
    try {
      if (on) {
        run(['add', REG_KEY, '/v', REG_VALUE, '/t', 'REG_SZ', '/d', `"${process.execPath}"`, '/f']);
      } else {
        run(['delete', REG_KEY, '/v', REG_VALUE, '/f']);
      }
      const now = autolaunch.isEnabled();
      log.info('autolaunch: 设置开机自启 =', on, '实际 =', now);
      return now;
    } catch (err) {
      log.ex('autolaunch: 设置失败', err);
      return autolaunch.isEnabled();
    }
  },

  /** 让注册表里的路径始终指向当前 exe（软件被移动过也能自愈） */
  sync(enabled) {
    if (!autolaunch.supported) return false;
    if (enabled && !autolaunch.isEnabled()) return autolaunch.setEnabled(true);
    return autolaunch.isEnabled();
  },
};

module.exports = autolaunch;

'use strict';

/** QQ 遥控电脑 */
const remote = require('./remote');

/**
 * IPC 总线（主进程侧）
 * ------------------------------------------------------------
 * 渲染进程能做的事情，全在这里列一遍。没登记的调用一律不响应，
 * 所以界面那边不可能偷偷调出什么奇怪的能力。
 *
 * 加新能力 = 在这里加一条 handle + preload 里加一个方法。
 */

const { ipcMain, shell, app } = require('electron');
const fs = require('fs');
const settings = require('./settings');
const plugins = require('./plugins');
const registry = require('./registry');
const autolaunch = require('./autolaunch');
const ai = require('./ai');
const personas = require('./personas');
const memory = require('./memory');
const qq = require('./qq');
const inbox = require('./inbox');
const stickers = require('./stickers');
const stickerRules = require('./stickerRules');
const autoreply = require('./autoreply');
const guard = require('./guard');
const adminkey = require('./adminkey');
const proactive = require('./proactive');
const growth = require('./growth');
const bond = require('./bond');
const distill = require('./distill');
const vision = require('./vision');
const voice = require('./voice');
const bilibili = require('./bilibili');
const biliLife = require('./biliLife');
const bililogin = require('./bililogin');
const chat = require('./chat');
const abilities = require('./abilities');
const log = require('./logger');
const boot = require('./boot');
const usage = require('./usage');

function register({ getInfo }) {
  const handle = (channel, fn) => {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        log.ex(`IPC ${channel} 失败`, err);
        // 把可读的错误信息抛回渲染进程（Electron 会包装成 Error）
        throw new Error(err && err.message ? err.message : String(err));
      }
    });
  };

  // ---- 应用信息 ----
  handle('app:info', () => getInfo());
  handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  // ---- 设置 ----
  handle('settings:get', () => settings.get());
  handle('settings:patch', (partial) => settings.patch(partial || {}));
  handle('settings:reset', () => settings.reset());

  /** 开机自启单独一条：要真的去写注册表，并回报真实状态 */
  handle('settings:setStartOnBoot', (on) => {
    const actual = autolaunch.setEnabled(!!on);
    settings.patch({ general: { startOnBoot: actual } });
    return { settings: settings.get(), actual };
  });

  // ---- 插件 ----
  handle('plugins:list', () => plugins.list());
  handle('plugins:reload', () => plugins.reload());
  handle('plugins:setEnabled', (id, on) => plugins.setEnabled(id, !!on));
  handle('plugins:remove', (id) => plugins.remove(id));
  // ---- QQ 遥控电脑 ----
  handle('remote:config', () => {
    const r = settings.getIn('remote') || {};
    return { ...remote.cfg(), actions: remote.ACTIONS };
  });
  handle('remote:save', (patch) => {
    const r = { ...(settings.getIn('remote') || {}), ...(patch || {}) };
    settings.patch({ remote: r });
    return remote.cfg();
  });
  handle('remote:test', async (text) => {
    const owner = String(settings.getIn('channels.qq.ownerQq') || '');
    if (!owner) throw new Error('先去侧栏底部的「管理员」页填管理员 QQ（那页要输密钥）');
    const raw = String(text || '');
    // 测试框永远只演流程：输入本身就带指令行时，绝不能在这里真执行
    const typedCmd = remote.parseCommandLine(raw);
    if (typedCmd) {
      return `（演流程）这行会被当成「${typedCmd.label}」执行；这里不真跑。真要动手的话，到 QQ 里把这行原样发给我。`;
    }
    const res = await remote.handle(owner, raw);
    // 回复里带格式提示（那行是给他复制去 QQ 的）时，补一句说明
    if (typeof res === 'string' && remote.parseCommandLine(res)) {
      return res + '\n（这里只是演流程，不会真执行；到 QQ 里把这行原样发给我就行）';
    }
    return res;
  });
  handle('plugins:call', (id, name, payload) => plugins.call(id, name, payload));
  handle('sections:list', (pageId) => registry.listSections(pageId || null));

  // ---- 大模型接入 ----
  handle('model:overview', () => ai.overview());
  handle('model:save', (id, patch) => ai.save(id, patch));
  handle('model:setActive', (id) => ai.setActive(id));
  handle('model:test', (id, override) => ai.test(id, override || null));
  handle('model:catalog', (id) => ai.catalog(id));

  // ---- 人格 ----
  handle('personas:all', () => personas.all());
  handle('personas:save', (item) => personas.save(item || {}));
  handle('personas:remove', (id) => personas.remove(id));
  handle('personas:setActive', (id) => personas.setActive(id));
  handle('personas:preview', (id) => personas.promptOf(id));

  // ---- 记忆 ----
  handle('pet:packs', () => require('./pet').packs());
  handle('pet:config', () => require('./pet').cfg());
  handle('pet:save', (patch) => require('./pet').apply(patch));
  handle('pet:open', () => { const c = require('./pet').apply({ enabled: true }); return c; });
  handle('pet:close', () => { const c = require('./pet').apply({ enabled: false }); return c; });
  handle('pet:say', async () => { const r = await require('./pet').say(); return r; });
  handle('pet:hide', () => { require('./pet').apply({ enabled: false }); return { ok: true }; });
  handle('archive:stats', () => require('./archive').stats());
  handle('archive:search', (q) => require('./archive').search(q, 10));
  handle('archive:recent', (n) => require('./archive').recent(n || 20));
  handle('motive:now', () => require('./motive').current());
  handle('motive:refresh', () => require('./motive').refresh());
  handle('bili:inbox', () => require('./bilimail').inbox(10));
  handle('bili:mailMsgs', (id) => require('./bilimail').messages(id, 20));
  handle('group:config', () => require('./group').cfg());
  handle('group:save', (patch) => { settings.patch({ group: patch || {} }); return require('./group').cfg(); });
  handle('group:test', (p) => require('./group').decide(p || {}));
  handle('rhythm:now', () => require('./rhythm').now());
  handle('memory:stats', () => memory.stats());
  handle('memory:list', (limit, opts) => memory.list(limit, opts || {}));
  handle('memory:add', (text, tags, extra) => memory.add(text, tags, extra || {}));
  handle('memory:search', (query, k, opts) => memory.search(query, k, opts || {}));
  handle('memory:remove', (id) => memory.remove(id));
  handle('memory:clear', () => memory.clear());
  handle('memory:probe', () => memory.probe());
  handle('memory:backfill', (limit) => memory.backfill(limit));
  handle('memory:update', (id, patch) => memory.update(id, patch || {}));
  handle('memory:profile', (limit) => memory.profile(limit));
  handle('memory:decay', () => memory.decay());
  handle('memory:decaySave', (patch) => memory.saveDecay(patch || {}));
  handle('memory:backup', () => memory.backup());
  handle('memory:restore', (source) => memory.restore(source));
  handle('memory:backups', () => memory.listBackups());
  handle('memory:restoreLatest', () => memory.restoreLatest());
  handle('memory:backupCfg', (patch) => memory.saveBackupCfg(patch || {}));
  handle('memory:recallTest', (text) => memory.recall(text, { k: 6, budget: 900 }));
  handle('distill:run', (limit) => require('./distill').runRecent(limit));

  // ---- 视觉 API（自己填地址/Key/模型，随时换） ----
  handle('vision:config', () => vision.cfg());
  handle('vision:save', (patch) => vision.save(patch || {}));
  handle('vision:test', (prompt) => vision.test(prompt));
  handle('vision:stats', () => vision.stats());
  handle('vision:describe', (input, opts) => vision.describe(input || {}, opts || {}));
handle('voice:config', () => voice.cfg());
handle('voice:save', (patch) => voice.save(patch || {}));
handle('voice:test', () => voice.test());
handle('voice:stats', () => voice.stats());
handle('voice:speak', (text, opts) => voice.speak(text || '', opts || {}));

  // ---- 通道：QQ ----
  handle('qq:status', () => qq.status());

  // ---- 一键启动 ----
  handle('boot:stop', () => boot.stop());
  handle('boot:start', () => boot.start());
  handle('boot:status', () => boot.status());

  // ---- 用量 ----
  handle('usage:stats', (days) => usage.stats(days));
  handle('qq:config', () => qq.config());
  handle('qq:save', (patch) => qq.saveConfig(patch || {}));
  handle('qq:connect', () => qq.connect());
  handle('qq:disconnect', () => qq.disconnect());
  handle('qq:sendPrivate', (userId, text) => qq.sendPrivate(userId, text));
  handle('qq:sendGroup', (groupId, text) => qq.sendGroup(groupId, text));
  handle('qqzone:publish', (text) => require('./qqzone').publish(text));
  handle('qq:call', (action, params) => qq.call(action, params || {}));
  handle('qq:friends', () => qq.friends());
  handle('qq:groups', () => qq.groups());
  handle('qq:launchNapCat', () => qq.launchNapCat());
  handle('qq:pickNapCat', async () => {
    const { dialog } = require('electron');
    const res = await dialog.showOpenDialog({
      title: '选择 NapCat 启动程序',
      properties: ['openFile'],
      filters: [
        { name: '可执行文件', extensions: ['exe', 'bat', 'cmd'] },
        { name: '全部文件', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePaths || !res.filePaths[0]) return { canceled: true };
    const file = res.filePaths[0];
    qq.saveConfig({ napcatPath: file });
    return { canceled: false, path: file };
  });

  // ---- 收件箱 ----
  handle('inbox:conversations', (limit) => inbox.conversations(limit));
  handle('inbox:messages', (convId, limit) => inbox.messages(convId, limit));
  handle('inbox:stats', () => inbox.stats());
  handle('inbox:send', async (convId, text, stickerFile) => {
    const id = String(convId || '');
    const body = String(text || '');
    const sticker = stickerFile ? String(stickerFile) : '';
    if (!id) throw new Error('缺少会话');
    if (!body && !sticker) throw new Error('缺少内容');
    if (sticker && !fs.existsSync(sticker)) throw new Error('这张表情的文件不见了：' + sticker);
    let payload = body;
    if (sticker) payload = body ? body + '\n' + stickers.cqOf(sticker) : stickers.cqOf(sticker);
    if (id.startsWith('group:')) await qq.sendGroup(id.slice(6), payload);
    else if (id.startsWith('user:')) await qq.sendPrivate(id.slice(5), payload);
    else throw new Error('不认识的会话编号：' + id);
    const segs = [];
    if (body) segs.push({ type: 'text', data: { text: body } });
    if (sticker) segs.push({ type: 'image', data: { file: sticker, summary: '[表情]' } });
    inbox.append(id, {
      senderId: qq.status().selfId,
      senderName: qq.status().selfName || '我',
      text: body,
      raw: segs.length ? JSON.stringify({ message: segs }) : '',
      role: 'assistant',
    });
    return { ok: true };
  });

  // ---- 表情包 ----
  handle('stickers:stats', () => stickers.stats());
  handle('stickers:list', (options) => stickers.list(options || {}));
  handle('stickers:rescan', () => stickers.rescan());
  handle('stickers:setSource', (dir) => stickers.setSource(dir));
  handle('stickers:pick', (emotion) => stickers.pick(emotion));
  handle('stickers:emotions', () => stickers.emotions());
  handle('stickers:auto', () => stickerRules.overview());
  handle('stickers:saveAuto', (patch) => stickerRules.save(patch || {}));
  handle('stickers:testPick', (text) => stickerRules.test(text));
  handle('stickers:setEmotion', (files, emotion) => stickers.setEmotion(files, emotion));
  handle('stickers:renameGroup', (from, to) => stickers.renameGroup(from, to));
  handle('stickers:setFavorite', (files, on) => stickers.setFavorite(files, on));
  handle('stickers:remove', (files) => stickers.remove(files));
handle('stickers:import', (file, options) => stickers.importFile(file, options || {}));
  handle('stickers:reveal', (file) => {
    shell.showItemInFolder(String(file || ''));
    return { ok: true };
  });
  handle('stickers:send', async (convId, file) => {
    const id = String(convId || '');
    const path = String(file || '');
    if (!path) throw new Error('没选表情');
    if (!fs.existsSync(path)) throw new Error('这张表情的文件不见了：' + path);
    const cq = stickers.cqOf(path);
    if (id.startsWith('group:')) await qq.sendGroup(id.slice(6), cq);
    else if (id.startsWith('user:')) await qq.sendPrivate(id.slice(5), cq);
    else throw new Error('先选一个发给谁');
    inbox.append(id, { senderId: qq.status().selfId, senderName: qq.status().selfName || '我', text: '[表情]', role: 'assistant' });
    return { ok: true };
  });

  // ---- 自动回复 ----
  handle('autoreply:config', () => autoreply.cfg());
  handle('autoreply:save', (patch) => autoreply.saveConfig(patch || {}));
  // ---- 对外规矩（护栏） ----
  handle('guard:config', () => guard.overview());
  handle('guard:save', (patch) => guard.save(patch || {}));
  handle('guard:preview', (opts) => guard.promptFor(opts || {}));

  // ---------------- 管理员页 ----------------
  /** 身份信息汇总（QQ / B 站 / 用户名） */
  handle('admin:info', () => {
    const qqCfg = settings.getIn('channels.qq') || {};
    const bili = bilibili.status ? bilibili.status() : {};
    const biliCfg = settings.getIn('channels.bilibili') || {};
    return {
      qq: String(qqCfg.ownerQq || ''),
      biliUid: String(bili.ownerUid || biliCfg.ownerUid || ''),
      biliName: String(bili.ownerName || biliCfg.ownerName || ''),
      selfName: String(bili.selfName || ''),
      remote: (() => {
        try {
          return remote.cfg();
        } catch (_) {
          return {};
        }
      })(),
    };
  });
  handle('admin:save', async (patch) => {
    const p = patch || {};
    if ('qq' in p) qq.saveConfig({ ownerQq: p.qq });
    if ('biliUid' in p || 'biliName' in p) {
      bilibili.saveConfig({
        ...('biliUid' in p ? { ownerUid: p.biliUid } : {}),
        ...('biliName' in p ? { ownerName: p.biliName } : {}),
      });
    }
    if ('remoteList' in p) {
      const r = { ...(settings.getIn('remote') || {}), allowed: String(p.remoteList || '').split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean) };
      settings.patch({ remote: r });
    }
    return true;
  });
  handle('admin:keyStatus', () => adminkey.status());
  handle('admin:keySetup', (patch) => adminkey.setup(patch || {}));
  handle('admin:keyVerify', (patch) => adminkey.verify(patch && patch.key));
  handle('admin:keyChange', (patch) => adminkey.change(patch || {}));
  // 手动试一句：拿白名单第一个人，走完整的回复管线（会被真的发出去）
  handle('autoreply:try', async (text) => {
    const list = settings.getIn('channels.qq.allowedUsers') || [];
    const uid = list[0];
    if (!uid) throw new Error('白名单是空的，先在「只和谁互动」里填一个 QQ 号');
    const st = qq.status();
    const state = typeof st === 'string' ? st : st && st.status;
    if (state !== 'online') throw new Error('QQ 还没连上');
    const say = String(text || '在吗');
    const ev = {
      post_type: 'message',
      message_type: 'private',
      user_id: uid,
      raw_message: say,
      message: [{ type: 'text', data: { text: say } }],
      sender: { nickname: '' },
      self_id: qq.status().selfId,
    };
    await autoreply.reply(ev);
    const recent = await inbox.messages('user:' + uid, 1);
    const last = (recent || [])[0];
    return { ok: true, sent: last ? last.text : '' };
  });

  // ---- 只和谁互动 ----
  handle('qq:allowed', () => settings.getIn('channels.qq.allowedUsers') || []);
  handle('qq:setAllowed', (list) => {
    const ids = (Array.isArray(list) ? list : [])
      .map((v) => String(v || '').replace(/\D/g, ''))
      .filter(Boolean);
    settings.patch({ channels: { qq: { allowedUsers: ids } } });
    return settings.getIn('channels.qq.allowedUsers');
  });

  // ---- 主动聊天 ----
  handle('proactive:config', () => proactive.cfg());
  handle('proactive:save', (patch) => {
    const out = proactive.saveConfig(patch || {});
    proactive.start();
    return out;
  });
  handle('proactive:sendNow', (userId) => proactive.sendTo(String(userId || ''), {}));

  // ---- 成长 ----
  handle('growth:get', (userId) => growth.get(String(userId || '')));
  handle('growth:list', (limit) => growth.list(limit));
  handle('growth:reset', (userId) => growth.reset(String(userId || '')));

  // ---- 关系（好感度 + 今日状态）----
  handle('bond:get', (userId) => bond.get(String(userId || '')));
  handle('bond:list', (limit) => bond.list(limit));
  handle('bond:reset', (userId) => bond.reset(String(userId || '')));
  handle('bond:roll', (userId) => bond.rollMood(String(userId || '')));
  handle('bond:save', (patch) => {
    const p = patch || {};
    const cur = { ...(settings.getIn('bond') || {}) };
    for (const k of ['enabled']) if (k in p) cur[k] = !!p[k];
    for (const k of ['perMessage', 'perReply', 'perProactive']) {
      if (k in p) cur[k] = Math.max(0, Math.min(10, Number(p[k]) || 0));
    }
    settings.patch({ bond: cur });
    return settings.getIn('bond');
  });

  // ---- 记忆自动提炼 ----
  handle('distill:config', () => distill.cfg());
  handle('distill:save', (patch) => distill.saveConfig(patch || {}));
  // 手动试一句：看看小模型会不会从这句话里挑出该记的东西
  handle('distill:try', (text) => distill.tryText(text));

  // ---- B 站 ----
  handle('bili:status', () => bilibili.status());
  handle('bili:save', (patch) => bilibili.saveConfig(patch || {}));
  handle('bili:popular', (limit) => bilibili.popular(limit));
  handle('bili:uploader', (mid, limit) => bilibili.uploaderVideos(mid, limit));
  handle('bili:recommendText', async (limit) => {
    const c = bilibili.cfg();
    let videos0;
    try {
      videos0 = await biliLife.candidates({ preferTags: c.preferTags });
    } catch (_) {
      videos0 = [];
    }
    if (!videos0.length) videos0 = await bilibili.popular(Math.max(Number(limit) || 8, 8));
    const { list: videos, matched } = bilibili.filterVideos(videos0, { preferTags: c.preferTags, blockTags: c.blockTags });
    const who = settings.getIn('channels.bilibili.name') || '';
    return { videos, text: bilibili.formatRecommend(videos, who), matched, filtered: videos.length !== videos0.length };
  });
  handle('bili:check', () => bilibili.check());
  handle('bili:quota', () => bilibili.quota());
  handle('bili:send', (text) => bilibili.sendDM(String(text || '')));
  handle('bili:life', () => biliLife.overview());
  handle('bili:lifeSave', (patch) => {
    const p = patch || {};
    const next = {};
    if ('enabled' in p) next.autoDaily = !!p.enabled;
    if ('everyMinutes' in p) next.everyMinutes = Number(p.everyMinutes);
    if ('preferTags' in p) next.preferTags = p.preferTags;
    if ('blockTags' in p) next.blockTags = p.blockTags;
    const out = bilibili.saveConfig(next);
    biliLife.start();
    return { status: out, overview: biliLife.overview() };
  });
  handle('bili:lifeRun', () => biliLife.run({ manual: true }));

  // ---- B 站扫码登录 ----
  handle('bili:loginStart', () => bililogin.generate());
  handle('bili:loginPoll', () => bililogin.poll());
  handle('bili:loginCancel', () => bililogin.cancel());
  handle('bili:loginStatus', () => bililogin.status());

  // ---- 本地对话（不经过 QQ，用来验证脑子 + 私下聊天） ----
  handle('chat:say', (text) => chat.say(text));
  handle('chat:history', (limit) => chat.history(limit));
  handle('chat:clear', () => chat.clear());
  handle('chat:proactive', (reason) => chat.proactiveOnce(reason));

  // ---- 能力清单 ----
  handle('abilities:list', () => abilities.list());
  handle('abilities:save', (item) => abilities.saveItem(item || {}));
  handle('abilities:add', (item) => abilities.addItem(item || {}));
  handle('abilities:remove', (id) => abilities.removeItem(id));

  // ---- 系统 ----
  handle('shell:openPath', (target) => shell.openPath(String(target || '')));
  handle('shell:openUrl', (url) => {
    const target = String(url || '').trim();
    if (!/^https?:\/\//i.test(target)) throw new Error('只支持 http/https 链接');
    return shell.openExternal(target);
  });

  /** 界面里的报错也写进日志文件，出问题时只看一个文件就够了 */
  handle('log:renderer', (payload) => {
    const p = payload || {};
    const text = String(p.message || '');
    (p.level === 'warn' ? log.warn : log.error)('[界面] ' + text + (p.stack ? '\n' + p.stack : ''));
    return true;
  });

  log.info('ipc: 已注册通道');
}

module.exports = { register };

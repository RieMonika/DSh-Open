'use strict';

/**
 * 预加载脚本：渲染进程与主进程之间唯一的桥。
 * 只暴露白名单方法，渲染进程拿不到 require / ipcRenderer 本体。
 *
 * 界面需要新能力时：先在 core/ipc.js 注册，再在这里补一行。
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('dsh', {
  // 应用与运行时信息
  info: () => invoke('app:info'),
  relaunch: () => invoke('app:relaunch'),

  // 设置
  settings: {
    get: () => invoke('settings:get'),
    patch: (partial) => invoke('settings:patch', partial),
    reset: () => invoke('settings:reset'),
    setStartOnBoot: (on) => invoke('settings:setStartOnBoot', on),
  },

  // 插件
  plugins: {
    list: () => invoke('plugins:list'),
    reload: () => invoke('plugins:reload'),
    setEnabled: (id, on) => invoke('plugins:setEnabled', id, on),
    remove: (id) => invoke('plugins:remove', id),
    // 界面调插件：插件用 ctx.handle(名字, 函数) 注册
    call: (id, name, payload) => invoke('plugins:call', id, name, payload),
  },

  // 大模型接入
  model: {
    overview: () => invoke('model:overview'),
    save: (id, patch) => invoke('model:save', id, patch),
    setActive: (id) => invoke('model:setActive', id),
    test: (id, override) => invoke('model:test', id, override),
    catalog: (id) => invoke('model:catalog', id),
  },

  // 人格
  personas: {
    all: () => invoke('personas:all'),
    save: (item) => invoke('personas:save', item),
    remove: (id) => invoke('personas:remove', id),
    setActive: (id) => invoke('personas:setActive', id),
    preview: (id) => invoke('personas:preview', id),
  },

  // 记忆
  pet: {
      packs: () => invoke('pet:packs'),
    config: () => invoke('pet:config'),
    save: (patch) => invoke('pet:save', patch),
    open: () => invoke('pet:open'),
    close: () => invoke('pet:close'),
    say: () => invoke('pet:say'),
  },
  archive: { stats: () => invoke('archive:stats'), search: (q) => invoke('archive:search', q), recent: (n) => invoke('archive:recent', n) },
  motive: { now: () => invoke('motive:now'), refresh: () => invoke('motive:refresh') },
  group: {
    config: () => invoke('group:config'),
    save: (patch) => invoke('group:save', patch),
    test: (payload) => invoke('group:test', payload),
  },
  rhythm: { now: () => invoke('rhythm:now') },
  memory: {
    stats: () => invoke('memory:stats'),
    list: (limit, opts) => invoke('memory:list', limit, opts),
    add: (text, tags, extra) => invoke('memory:add', text, tags, extra),
    search: (query, k, opts) => invoke('memory:search', query, k, opts),
    remove: (id) => invoke('memory:remove', id),
    clear: () => invoke('memory:clear'),
    probe: () => invoke('memory:probe'),
    backfill: (limit) => invoke('memory:backfill', limit),
    update: (id, patch) => invoke('memory:update', id, patch),
    profile: (limit) => invoke('memory:profile', limit),
    decay: () => invoke('memory:decay'),
    decaySave: (patch) => invoke('memory:decaySave', patch),
    backup: () => invoke('memory:backup'),
    restore: (source) => invoke('memory:restore', source),
    backups: () => invoke('memory:backups'),
    restoreLatest: () => invoke('memory:restoreLatest'),
    backupCfg: (patch) => invoke('memory:backupCfg', patch),
    recallTest: (text) => invoke('memory:recallTest', text),
    distillRun: (limit) => invoke('distill:run', limit),
  },

  // 通道：QQ（OneBot v11）
  qq: {
    status: () => invoke('qq:status'),
    config: () => invoke('qq:config'),
    save: (patch) => invoke('qq:save', patch),
    connect: () => invoke('qq:connect'),
    disconnect: () => invoke('qq:disconnect'),
    sendPrivate: (userId, text) => invoke('qq:sendPrivate', userId, text),
    sendGroup: (groupId, text) => invoke('qq:sendGroup', groupId, text),
    call: (action, params) => invoke('qq:call', action, params),
    zone: (text) => invoke('qqzone:publish', text),
    friends: () => invoke('qq:friends'),
    groups: () => invoke('qq:groups'),
    allowed: () => invoke('qq:allowed'),
    setAllowed: (list) => invoke('qq:setAllowed', list),
    launchNapCat: () => invoke('qq:launchNapCat'),
    pickNapCat: () => invoke('qq:pickNapCat'),
    /** 状态变化 / 收到消息时主进程会推过来 */
    onEvent: (handler) => {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on('qq:event', listener);
      return () => ipcRenderer.removeListener('qq:event', listener);
    },
  },

  // 收件箱
  inbox: {
    conversations: (limit) => invoke('inbox:conversations', limit),
    messages: (convId, limit) => invoke('inbox:messages', convId, limit),
    stats: () => invoke('inbox:stats'),
    send: (convId, text, stickerFile) => invoke('inbox:send', convId, text, stickerFile),
  },

  // 表情包
  stickers: {
    stats: () => invoke('stickers:stats'),
    list: (options) => invoke('stickers:list', options),
    rescan: () => invoke('stickers:rescan'),
    setSource: (dir) => invoke('stickers:setSource', dir),
    pick: (emotion) => invoke('stickers:pick', emotion),
    send: (convId, file) => invoke('stickers:send', convId, file),
    emotions: () => invoke('stickers:emotions'),
    auto: () => invoke('stickers:auto'),
    saveAuto: (patch) => invoke('stickers:saveAuto', patch),
    testPick: (text) => invoke('stickers:testPick', text),
    setEmotion: (files, emotion) => invoke('stickers:setEmotion', files, emotion),
    renameGroup: (from, to) => invoke('stickers:renameGroup', from, to),
    setFavorite: (files, on) => invoke('stickers:setFavorite', files, on),
    remove: (files) => invoke('stickers:remove', files),
    import: (file, options) => invoke('stickers:import', file, options),
    reveal: (file) => invoke('stickers:reveal', file),
  },

  // 自动回复
  autoreply: {
    config: () => invoke('autoreply:config'),
    save: (patch) => invoke('autoreply:save', patch),
    try: (text) => invoke('autoreply:try', text),
  },

  // 对外规矩（只对管理员松绑）
  guard: {
    config: () => invoke('guard:config'),
    save: (patch) => invoke('guard:save', patch),
    preview: (opts) => invoke('guard:preview', opts),
  },

  // 管理员页（身份信息 + 进入密钥）
  admin: {
    info: () => invoke('admin:info'),
    save: (patch) => invoke('admin:save', patch),
    keyStatus: () => invoke('admin:keyStatus'),
    keySetup: (patch) => invoke('admin:keySetup', patch),
    keyVerify: (patch) => invoke('admin:keyVerify', patch),
    keyChange: (patch) => invoke('admin:keyChange', patch),
  },

  // 主动聊天
  proactive: {
    config: () => invoke('proactive:config'),
    save: (patch) => invoke('proactive:save', patch),
    sendNow: (userId) => invoke('proactive:sendNow', userId),
  },

  // 成长
  growth: {
    get: (userId) => invoke('growth:get', userId),
    list: (limit) => invoke('growth:list', limit),
    reset: (userId) => invoke('growth:reset', userId),
  },

  // 关系（好感度 + 今日状态）
  bond: {
    get: (userId) => invoke('bond:get', userId),
    list: (limit) => invoke('bond:list', limit),
    reset: (userId) => invoke('bond:reset', userId),
    roll: (userId) => invoke('bond:roll', userId),
    save: (patch) => invoke('bond:save', patch),
  },

  // 记忆自动提炼
  distill: {
    config: () => invoke('distill:config'),
    save: (patch) => invoke('distill:save', patch),
    try: (text) => invoke('distill:try', text),
    run: (limit) => invoke('distill:run', limit),
  },

  // 视觉 API（OpenAI 兼容，用户自己填）
  vision: {
    config: () => invoke('vision:config'),
    save: (patch) => invoke('vision:save', patch),
    test: (prompt) => invoke('vision:test', prompt),
    stats: () => invoke('vision:stats'),
    describe: (input, opts) => invoke('vision:describe', input, opts),
  },
  voice: {
    config: () => invoke('voice:config'),
    save: (patch) => invoke('voice:save', patch),
    test: () => invoke('voice:test'),
    stats: () => invoke('voice:stats'),
    speak: (text, opts) => invoke('voice:speak', text, opts),
  },

  // B 站
  biliInbox: () => invoke('bili:inbox'),
  biliMailMsgs: (id) => invoke('bili:mailMsgs', id),
  bili: {
    status: () => invoke('bili:status'),
    save: (patch) => invoke('bili:save', patch),
    popular: (limit) => invoke('bili:popular', limit),
    uploader: (mid, limit) => invoke('bili:uploader', mid, limit),
    recommendText: (limit) => invoke('bili:recommendText', limit),
    check: () => invoke('bili:check'),
    quota: () => invoke('bili:quota'),
    send: (text) => invoke('bili:send', text),
    life: () => invoke('bili:life'),
    lifeSave: (patch) => invoke('bili:lifeSave', patch),
    lifeRun: () => invoke('bili:lifeRun'),
    loginStart: () => invoke('bili:loginStart'),
    loginPoll: () => invoke('bili:loginPoll'),
    loginCancel: () => invoke('bili:loginCancel'),
    loginStatus: () => invoke('bili:loginStatus'),
  },

  chat: {
    say: (text) => invoke('chat:say', text),
    history: (limit) => invoke('chat:history', limit),
    clear: () => invoke('chat:clear'),
    proactive: (reason) => invoke('chat:proactive', reason),
  },

  // 能力清单
  abilities: {
    list: () => invoke('abilities:list'),
    save: (item) => invoke('abilities:save', item),
    add: (item) => invoke('abilities:add', item),
    remove: (id) => invoke('abilities:remove', id),
  },

  // 一键启动
  boot: {
    stop: () => invoke('boot:stop'),
    start: () => invoke('boot:start'),
    status: () => invoke('boot:status'),
  },

  // 用量
  usage: {
    stats: (days) => invoke('usage:stats', days),
  },

  // 系统
  sections: {
    list: (pageId) => invoke('sections:list', pageId || null),
  },

  remote: {
    config: () => invoke('remote:config'),
    save: (patch) => invoke('remote:save', patch),
    test: (text) => invoke('remote:test', text),
  },  openPath: (target) => invoke('shell:openPath', target),
  openUrl: (url) => invoke('shell:openUrl', url),

  // 界面报错进日志
  logError: (payload) => invoke('log:renderer', payload),
});

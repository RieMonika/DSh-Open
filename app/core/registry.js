'use strict';

/**
 * 注册表
 * ------------------------------------------------------------
 * 全软件只有一个"登记处"。本体和插件都往这里登记自己的东西，
 * 界面从注册表读取 —— 所以以后加功能 = 登记一条，不用改界面代码。
 *
 * 目前支持三类：
 *   page     一个页面（侧栏入口 + 内容区）
 *   channel  一个消息通道（QQ、B 站……）
 *   tool     一个工具/能力（以后给模型调用）
 */

const log = require('./logger');

const registry = {
  _pages: new Map(),
  _channels: new Map(),
  _tools: new Map(),
  _modules: new Map(),
  _sections: new Map(),

  // ---------------- 页面 ----------------
  /**
   * @param {object} def
   * @param {string} def.id        唯一 id（英文、短横线）
   * @param {string} def.title     标题（i18n 缺省时的兜底文案）
   * @param {string} [def.titleKey] i18n key
   * @param {string} [def.icon]    图标字符
   * @param {string} [def.group]   work | system
   * @param {number} [def.order]   排序
   * @param {string} [def.source]  core 或插件 id
   * @param {string} [def.kind]    builtin | plugin
   */
  addPage(def) {
    if (!def || !def.id) throw new Error('registry.addPage: 缺少 id');
    if (this._pages.has(def.id)) {
      log.warn('registry: 页面 id 冲突，已跳过 ->', def.id);
      return;
    }
    this._pages.set(def.id, {
      id: def.id,
      title: def.title || def.id,
      titleKey: def.titleKey || '',
      icon: def.icon || '•',
      group: def.group || 'work',
      order: Number.isFinite(def.order) ? def.order : 100,
      source: def.source || 'core',
      kind: def.kind || 'builtin',
      disabled: !!def.disabled,
      // hidden: 有页面但不在侧栏显示（例如设置页，从右下角的齿轮进去）
      hidden: !!def.hidden,
      // showInNav: 插件页面默认要"有界面实现"才进侧栏，显式 true 可以强制显示
      showInNav: def.showInNav === true,
    });
  },

  listPages() {
    return [...this._pages.values()].sort((a, b) => a.order - b.order);
  },

  // ---------------- 通道 ----------------
  addChannel(def) {
    if (!def || !def.id) throw new Error('registry.addChannel: 缺少 id');
    this._channels.set(def.id, {
      id: def.id,
      name: def.name || def.id,
      icon: def.icon || '⇄',
      status: def.status || 'offline', // offline | connecting | online | error
      source: def.source || 'core',
      meta: def.meta || {},
    });
  },

  listChannels() {
    return [...this._channels.values()];
  },

  setChannelStatus(id, status) {
    const ch = this._channels.get(id);
    if (ch) ch.status = status;
  },

  // ---------------- 工具 ----------------
  addTool(def) {
    if (!def || !def.id) throw new Error('registry.addTool: 缺少 id');
    this._tools.set(def.id, { id: def.id, name: def.name || def.id, source: def.source || 'core' });
  },

  listTools() {
    return [...this._tools.values()];
  },

  // ---------------- 页面里的「附加区块」（插件用） ----------------
  /**
   * 插件可以往某个已有页面的末尾加一段自己的功能区。
   * @param {object} def
   * @param {string} def.id       区块 id（插件内唯一）
   * @param {string} def.pageId   挂到哪个页面（dashboard / channels / model / …）
   * @param {string} def.title    标题
   * @param {string} [def.desc]   副标题
   * @param {Array}  [def.fields] 表单项 [{key,type,label,hint,placeholder,options}]
   * @param {Array}  [def.actions] 按钮   [{key,label,type}]
   * @param {string} def.pluginId 哪个插件登记的
   * @param {number} [def.order]  排序
   */
  addSection(def) {
    if (!def || !def.id) throw new Error('registry.addSection: 缺少 id');
    if (!def.pageId) throw new Error('registry.addSection: 缺少 pageId');
    const key = (def.pluginId || 'core') + ':' + def.id;
    if (this._sections.has(key)) {
      log.warn('registry: 区块 id 冲突，已跳过 ->', key);
      return;
    }
    this._sections.set(key, {
      id: def.id,
      key,
      pageId: def.pageId,
      title: def.title || def.id,
      desc: def.desc || '',
      fields: Array.isArray(def.fields) ? def.fields : [],
      actions: Array.isArray(def.actions) ? def.actions : [],
      pluginId: def.pluginId || 'core',
      order: Number.isFinite(def.order) ? def.order : 100,
    });
  },

  listSections(pageId) {
    const all = [...this._sections.values()].sort((a, b) => a.order - b.order);
    return pageId ? all.filter((s) => s.pageId === pageId) : all;
  },

  // ---------------- 模块挂载 ----------------
  /**
   * 插件按权限"默认挂到"某个模块上（人格管理、记忆管理、通道……）。
   * 现在只是把东西存起来，等对应模块做出来（M4）就直接从这里取用。
   */
  expose(moduleId, entry) {
    if (!moduleId) return;
    if (!this._modules.has(moduleId)) this._modules.set(moduleId, []);
    this._modules.get(moduleId).push({
      pluginId: entry.pluginId || 'unknown',
      api: entry.api === undefined ? null : entry.api,
      at: Date.now(),
    });
  },

  getModule(moduleId) {
    return [...(this._modules.get(moduleId) || [])];
  },

  listModules() {
    return [...this._modules.keys()].map((id) => ({ id, count: this._modules.get(id).length }));
  },

  // ---------------- 插件卸载时清理 ----------------
  removeBySource(sourceId) {
    for (const map of [this._pages, this._channels, this._tools, this._sections]) {
      for (const [key, value] of [...map.entries()]) {
        if (value.source === sourceId || value.pluginId === sourceId) map.delete(key);
      }
    }
    for (const [moduleId, entries] of [...this._modules.entries()]) {
      const kept = entries.filter((e) => e.pluginId !== sourceId);
      if (kept.length) this._modules.set(moduleId, kept);
      else this._modules.delete(moduleId);
    }
  },
};

module.exports = registry;

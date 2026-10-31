'use strict';
// 通道页：把 section 按「通用 / QQ / B站」三大模块分开（只改 display，不挪 DOM）
(function () {
  const RULES = [
    [/她自己的\s*QQ|her own QQ/i, 'qq'],
    [/她自己的\s*B\s*站|her own Bilibili/i, 'bili'],
    [/收到的私信|direct messages?/i, 'bili'],
    [/^B\s*站|^Bilibili/i, 'bili'],
    [/只和谁互动|who talks to whom|who she talks to/i, 'qq'],
    [/^QQ\b/i, 'qq'],
  ];
  const TABS = [
    { key: 'general', label: '通用', labelEn: 'General' },
    { key: 'qq', label: 'QQ', labelEn: 'QQ' },
    { key: 'bili', label: 'B站', labelEn: 'Bilibili' },
  ];
  function isEn() { return !!(window.I18N && window.I18N.get && window.I18N.get() !== 'zh-CN'); }
  function tabLabel(t) { return isEn() ? (t.labelEn || t.label) : t.label; }
  let cur = 'general';
  let host = null;
  let bar = null;
  const ownerCache = new Map();

  function norm(s) { return String(s || '').replace(/\s+/g, '').trim(); }
  function ownerOf(sec) {
    const title = sec.querySelector('.section-title');
    // 规则要对着带空格的标题匹配（英文按词写），所以这里只把连续空白压成一个空格，不整体去掉。
    const t = String(title ? title.textContent : '').replace(/\s+/g, ' ').trim();
    if (ownerCache.has(t)) return ownerCache.get(t);
    let k = 'general';
    for (const [re, v] of RULES) { if (re.test(t)) { k = v; break; } }
    ownerCache.set(t, k);
    return k;
  }
  function sections() {
    if (!host) return [];
    return Array.from(host.querySelectorAll('.section'));
  }
  function apply() {
    const secs = sections();
    if (!secs.length) return;
    secs.forEach((s) => { s.style.display = ownerOf(s) === cur ? '' : 'none'; });
    if (bar) {
      const count = { general: 0, qq: 0, bili: 0 };
      secs.forEach((s) => { count[ownerOf(s)] += 1; });
      Array.from(bar.querySelectorAll('.mod-tab')).forEach((b) => {
        const k = b.dataset.tab;
        b.classList.toggle('is-active', k === cur);
        const n = b.querySelector('.mod-tab-n');
        if (n) n.textContent = isEn() ? ' (' + (count[k] || 0) + ')' : '（' + (count[k] || 0) + '）';
      });
    }
  }
  function buildBar() {
    if (!host || bar) return;
    bar = document.createElement('div');
    bar.className = 'mod-tabs';
    TABS.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'mod-tab';
      b.dataset.tab = t.key;
      b.innerHTML = '<span class="mod-tab-t">' + tabLabel(t) + '</span><span class="mod-tab-n"></span>';
      b.addEventListener('click', () => { cur = t.key; apply(); });
      bar.appendChild(b);
    });
    const first = host.querySelector('.section');
    if (first && first.parentNode) first.parentNode.insertBefore(bar, first);
    else host.insertBefore(bar, host.firstChild);
  }
  function refresh() {
    host = document.getElementById('pageBody');
    if (!host) return;
    if (location.hash.indexOf('/channels') < 0) { if (bar) { bar.remove(); bar = null; cur = 'general'; } return; }
    // 点「保存 / 刷新状态」这类按钮后整页会重画（#pageBody 清空再塞新容器），
    // 分隔条跟着被摘掉；旧引用不丢的话 buildBar() 会以为已经建过，标签就消失了。
    if (bar && (!bar.isConnected || !host.contains(bar))) bar = null;
    buildBar();
    apply();
  }
  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; refresh(); }, 60);
  }
  window.addEventListener('hashchange', () => { bar = null; cur = 'general'; setTimeout(refresh, 80); });
  window.addEventListener('i18n:change', () => { bar = null; setTimeout(refresh, 80); });
  window.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('pageBody');
    if (!root) return;
    new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
    setTimeout(refresh, 120);
  });
  window.__chTabsRefresh = refresh;
})();

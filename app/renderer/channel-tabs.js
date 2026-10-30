'use strict';
// 通道页：把 section 按「通用 / QQ / B站」三大模块分开（只改 display，不挪 DOM）
(function () {
  const RULES = [
    [/她自己的\s*QQ/i, 'qq'],
    [/她自己的\s*B\s*站/i, 'bili'],
    [/收到的私信/, 'bili'],
    [/^B\s*站/, 'bili'],
    [/只和谁互动/, 'qq'],
    [/^QQ/i, 'qq'],
  ];
  const TABS = [
    { key: 'general', label: '通用' },
    { key: 'qq', label: 'QQ' },
    { key: 'bili', label: 'B站' },
  ];
  let cur = 'general';
  let host = null;
  let bar = null;
  const owner = new WeakMap();

  function norm(s) { return String(s || '').replace(/\s+/g, '').trim(); }
  function ownerOf(sec) {
    if (owner.has(sec)) return owner.get(sec);
    const title = sec.querySelector('.section-title');
    const t = norm(title ? title.textContent : '');
    let k = 'general';
    for (const [re, v] of RULES) { if (re.test(t)) { k = v; break; } }
    owner.set(sec, k);
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
        if (n) n.textContent = '（' + (count[k] || 0) + '）';
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
      b.innerHTML = '<span class="mod-tab-t">' + t.label + '</span><span class="mod-tab-n"></span>';
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
    buildBar();
    apply();
  }
  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; refresh(); }, 60);
  }
  window.addEventListener('hashchange', () => { bar = null; cur = 'general'; setTimeout(refresh, 80); });
  window.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('pageBody');
    if (!root) return;
    new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
    setTimeout(refresh, 120);
  });
  window.__chTabsRefresh = refresh;
})();

'use strict';

/**
 * 渲染进程入口
 * ------------------------------------------------------------
 * 只干三件事：
 *   1. 从主进程拿"应用信息"（版本、路径、设置、页面清单）
 *   2. 按注册表画侧栏、按 hash 路由页面
 *   3. 给每个页面模块提供统一的 ctx（h / t / toast / state / dsh）
 *
 * 页面模块放在 pages/ 目录，每个文件往 window.DSHPages 里注册自己，
 * 想加页面就在这里加一条 <script>，别的什么都不用改。
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  const state = {
    info: null,
    settings: null,
    plugins: [],
    current: 'dashboard',
  };

  // -------------------------------------------------------------------------
  // 界面里的报错也写进主进程日志（出问题时只看一个文件就够）
  // -------------------------------------------------------------------------
  function reportError(message, stack, level) {
    try {
      if (window.dsh && window.dsh.logError) {
        window.dsh.logError({ message: String(message), stack: stack ? String(stack) : '', level });
      }
    } catch (_) {
      /* 日志失败不能影响界面 */
    }
  }

  window.addEventListener('error', (event) =>
    reportError(event.message || String(event.error), event.error && event.error.stack),
  );
  window.addEventListener('unhandledrejection', (event) =>
    reportError(
      'Promise 未处理: ' + (event.reason && event.reason.message ? event.reason.message : String(event.reason)),
      event.reason && event.reason.stack,
    ),
  );

  // -------------------------------------------------------------------------
  // DOM 助手
  // -------------------------------------------------------------------------
  function append(el, children) {
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      el.appendChild(
        typeof child === 'string' || typeof child === 'number'
          ? document.createTextNode(String(child))
          : child,
      );
    }
  }

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
        else if (key === 'value' && (tag === 'textarea' || tag === 'select')) {
          // textarea / select 的值必须走属性，setAttribute('value') 不生效
          el.value = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else el.setAttribute(key, value === true ? '' : value);
      }
    }
    append(el, children);
    return el;
  }

  const t = (key, vars) => window.I18N.t(key, vars);

  function toast(message, isError) {
    const wrap = document.getElementById('toastWrap');
    const node = h('div', { class: 'toast' + (isError ? ' is-err' : ''), text: message });
    wrap.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity .2s ease';
      node.style.opacity = '0';
      setTimeout(() => node.remove(), 220);
    }, 2400);
  }

  /**
   * 弹窗：直接盖在窗口里的浮层，不是新开一个界面。
   * 点遮罩、点右上角 ×、按 Esc 都能关。
   */
  function openModal(options) {
    const opts = options || {};
    let closed = false;

    const card = h('div', { class: 'modal' });
    const mask = h('div', { class: 'modal-mask' }, card);

    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      mask.classList.remove('is-open');
      setTimeout(() => mask.remove(), 180);
    }

    function onKey(event) {
      if (event.key === 'Escape') close();
    }

    card.appendChild(
      h(
        'div',
        { class: 'modal-head' },
        h(
          'div',
          null,
          h('div', { class: 'modal-title', text: opts.title || '' }),
          opts.desc ? h('div', { class: 'modal-desc', text: opts.desc }) : null,
        ),
        h('button', { class: 'modal-close', type: 'button', text: '×', title: '关闭', onClick: close }),
      ),
    );

    const body = h('div', { class: 'modal-body' });
    append(body, [opts.body]);
    card.appendChild(body);

    // 底部固定区（不跟着内容滚），用来放开关之类
    if (opts.footer) {
      const foot = h('div', { class: 'modal-foot' });
      append(foot, [opts.footer]);
      card.appendChild(foot);
    }

    mask.addEventListener('mousedown', (event) => {
      if (event.target === mask) close();
    });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(mask);
    requestAnimationFrame(() => mask.classList.add('is-open'));

    return { close, mask, body };
  }

  // -------------------------------------------------------------------------
  // 小菜单（插件卡片右下角三点那种）
  // -------------------------------------------------------------------------
  let menuEl = null;
  let menuOwner = null;

  function onMenuOutside(event) {
    if (menuEl && !menuEl.contains(event.target)) closeMenu();
  }

  function onMenuKey(event) {
    if (event.key === 'Escape') closeMenu();
  }

  function closeMenu() {
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
    if (menuOwner) {
      menuOwner.classList.remove('is-open');
      menuOwner = null;
    }
    document.removeEventListener('mousedown', onMenuOutside, true);
    document.removeEventListener('keydown', onMenuKey, true);
    window.removeEventListener('resize', closeMenu);
  }

  /**
   * 在某个按钮旁边弹出一个小菜单。
   * items: [{ text, danger?, onClick }]，写 { sep: true } 就是一条分隔线。
   */
  function openMenu(anchor, items) {
    closeMenu();
    if (!anchor) return;

    const menu = h('div', { class: 'popmenu' });
    for (const item of items || []) {
      if (!item) continue;
      if (item.sep) {
        menu.appendChild(h('div', { class: 'popmenu-sep' }));
        continue;
      }
      menu.appendChild(
        h('button', {
          class: 'popmenu-item' + (item.danger ? ' is-danger' : ''),
          type: 'button',
          text: item.text,
          onClick: () => {
            closeMenu();
            if (item.onClick) item.onClick();
          },
        }),
      );
    }

    document.body.appendChild(menu);
    menuEl = menu;
    menuOwner = anchor;
    anchor.classList.add('is-open');

    // 贴着按钮右下方，超出窗口就往回收
    const rect = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = rect.right - mw;
    if (left < 8) left = 8;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    let top = rect.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = rect.top - mh - 6;
    if (top < 8) top = 8;
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';

    // 延后一拍再挂外点关闭，否则这一次点击会立刻把它自己关掉
    setTimeout(() => {
      if (!menuEl) return;
      document.addEventListener('mousedown', onMenuOutside, true);
      document.addEventListener('keydown', onMenuKey, true);
      window.addEventListener('resize', closeMenu);
    }, 0);
  }

  // -------------------------------------------------------------------------
  // 页面元信息
  // -------------------------------------------------------------------------
  function findPage(id) {
    const list = (state.info && state.info.pages) || [];
    return list.find((p) => p.id === id) || null;
  }

  function pageTitle(def) {
    if (!def) return 'DSh Open';
    const key = 'page.' + def.id + '.title';
    const text = t(key);
    return text === key ? def.title : text;
  }

  function pageSub(def) {
    if (!def) return '';
    const key = 'page.' + def.id + '.sub';
    const text = t(key);
    return text === key ? '' : text;
  }

  function currentFromHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    return raw || 'dashboard';
  }

  function navigate(id) {
    if (location.hash === '#/' + id) {
      renderCurrent();
      return;
    }
    location.hash = '#/' + id;
  }

  /** 记住最后看的页面，下次启动直接回来 */
  function saveLastPage(id) {
    if (!state.settings) return;
    if (!state.settings.ui) state.settings.ui = { lastPage: id };
    if (state.settings.ui.lastPage === id) return;
    state.settings.ui.lastPage = id;
    if (window.dsh) window.dsh.settings.patch({ ui: { lastPage: id } }).catch(() => {});
  }

  // -------------------------------------------------------------------------
  // 渲染：侧栏 / 页面
  // -------------------------------------------------------------------------
  /**
   * 侧栏要不要显示这一项。
   * 插件页面只有在提供了界面实现（window.DSHPages[id]）时才进侧栏，
   * 否则会多出一个"点进去不知道是什么"的空入口 —— 现在插件还不能带界面，
   * 所以插件想加页面，等 M2 有了界面机制再显示出来。
   */
  function isNavVisible(def) {
    if (def.hidden) return false;
    if (def.kind === 'plugin') return !!PAGES[def.id] || def.showInNav === true;
    return true;
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.textContent = '';

    const pages = (state.info && state.info.pages) || [];
    const groups = [
      { id: 'work', title: t('nav.group.work') },
      { id: 'life', title: '', bottom: true },
      { id: 'system', title: t('nav.group.system') },
    ];

    for (const group of groups) {
      const items = pages.filter((p) => (p.group || 'work') === group.id && isNavVisible(p));
      if (!items.length) continue;
      // 「养成」单独贴在最下面：这是软件真正的核心，不该混在工作台里
      const host = group.bottom ? h('div', { class: 'nav-life' }) : nav;
      if (group.bottom) {
        nav.appendChild(host);
        host.appendChild(h('div', { class: 'nav-life-cap', text: '她在这里' }));
      } else {
        nav.appendChild(h('div', { class: 'nav-group-title', text: group.title }));
      }
      for (const def of items) {
        const navKey = 'nav.' + def.id;
        const label = t(navKey) === navKey ? def.title : t(navKey);
        host.appendChild(
          h(
            'div',
            {
              class:
                'nav-item' +
                (group.bottom ? ' is-life' : '') +
                (def.id === 'admin' ? ' is-admin' : '') +
                (def.id === state.current ? ' is-active' : ''),
              title: label,
              onClick: () => navigate(def.id),
            },
            h('span', { class: 'nav-ico', text: def.icon || '•' }),
            h('span', { class: 'nav-label', text: label }),
            def.kind === 'plugin' ? h('span', { class: 'nav-tag', text: 'plugin' }) : null,
          ),
        );
      }
    }
  }

  function makeContext() {
    const token = state.renderToken;
    return {
      h,
      t,
      toast,
      openModal,
      openMenu,
      state,
      dsh: window.dsh,
      navigate,
      refresh: renderAll,
      /** async 页面画到一半时，如果已经切走了就别再往 DOM 里塞 */
      alive() {
        return state.renderToken === token && state.current === currentFromHash();
      },
      /** 页面往标题右边塞小按钮（每次渲染清空重来） */
      setActions(nodes) {
        const host = document.getElementById('pageActions');
        if (!host) return;
        host.textContent = '';
        append(host, [nodes || []]);
      },
    };
  }

  function renderCurrent() {
    closeMenu();
    // 切页面时把还开着的弹窗一起收掉，免得盖在新页面上
    document.querySelectorAll('.modal-mask').forEach((m) => m.remove());
    const prevId = state.current;
    const scroller = document.querySelector('main.main');
    state.current = currentFromHash();
    if (!findPage(state.current)) state.current = 'dashboard';
    // 管理员页是「每次进来都要重新输一次密钥」的：只要不在这页上，就把解锁标记清掉
    if (state.current !== 'admin') window.__adminUnlockedAt = 0;
    // 每次渲染发一个新 token：异步页面靠它判断自己是不是"过期的那一版"
    state.renderToken = (state.renderToken || 0) + 1;

    const def = findPage(state.current);
    document.getElementById('pageTitle').textContent = pageTitle(def);
    document.getElementById('pageSub').textContent = pageSub(def);
    const actions = document.getElementById('pageActions');
    if (actions) actions.textContent = '';

    // 右下角齿轮：设置页打开时高亮
    const corner = document.getElementById('cornerSettings');
    if (corner) corner.classList.toggle('is-active', state.current === 'settings');

    const body = document.getElementById('pageBody');
    // 同一个页面重画（点了「删除」「置顶」「保存」这类按钮）时留住滚动位置。
    // 直接 body.textContent = '' 会让 scrollHeight 瞬间变矮，浏览器顺手把 scrollTop 顶回 0，
    // 于是「删掉列表里的一条」看着像整页跳回顶部。这里先拿旧高度垫着，画完再撤。
    const samePage = !!prevId && prevId === state.current;
    const keepTop = samePage && scroller ? scroller.scrollTop : 0;
    const keepH = samePage && scroller ? scroller.scrollHeight : 0;
    if (keepTop > 0 && keepH > 0) body.style.minHeight = keepH + 'px';
    const renderToken = state.renderToken;
    const settleScroll = () => {
      if (state.renderToken !== renderToken) return;
      if (body.style.minHeight) body.style.minHeight = '';
      if (keepTop > 0 && scroller) {
        const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        scroller.scrollTop = Math.min(keepTop, max);
      }
    };
    body.textContent = '';
    // 每次渲染都换一个新的容器：哪怕上一页的 async 渲染晚了半拍，
    // 它拿到的也是已经被摘掉的旧节点，不会把内容塞进新页面里。
    const pageHost = document.createElement('div');
    body.appendChild(pageHost);

    const page = PAGES[state.current];
    if (!page || typeof page.render !== 'function') {
      // 插件注册了页面但没提供界面实现：给出可读的说明，而不是白屏
      if (def && def.kind === 'plugin') {
        const plugin = (state.plugins || []).find((p) => p.id === def.source) || null;
        body.appendChild(
          h(
            'section',
            { class: 'section' },
            h(
              'div',
              { class: 'section-head' },
              h(
                'div',
                null,
                h('div', { class: 'section-title', text: def.title }),
                h('div', { class: 'section-desc', text: plugin ? plugin.description : '' }),
              ),
            ),
            h(
              'div',
              { class: 'empty' },
              h('div', { class: 'empty-title', text: '插件已经注册了这个页面' }),
              h('div', {
                class: 'empty-desc',
                text: '插件 id：' + def.source + '　页面 id：' + def.id + '　界面实现还没接上',
              }),
            ),
          ),
        );
        settleScroll();
        return;
      }
      body.appendChild(
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty-title', text: '这个页面还没有内容：' + state.current }),
        ),
      );
      settleScroll();
      return;
    }

    try {
      // 页面可以是同步渲染，也可以 async（先 await 拿数据再画）
      const renderId = state.current;
      const pageCtx = makeContext();
      const result = page.render(pageHost, pageCtx);
      // 插件往这个页面加的区块（声明式，最后画）
      const appendPluginSections = () => {
        if (typeof window.renderPluginSections !== 'function') return;
        if (state.current !== renderId) return;
        window.renderPluginSections(pageHost, renderId, pageCtx);
      };
      if (result && typeof result.then === 'function') {
        result.then(appendPluginSections).catch(() => {});
        // async 页面：等它把内容画完再撤掉高度垫片、还原滚动位置
        Promise.resolve(result).then(settleScroll, settleScroll);
      } else {
        appendPluginSections();
        settleScroll();
      }
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          window.console.error(err);
          if (state.current !== renderId) return;
          pageHost.textContent = '';
          pageHost.appendChild(
            h(
              'div',
              { class: 'empty' },
              h('div', { class: 'empty-title', text: '页面渲染出错' }),
              h('div', { class: 'empty-desc', text: String(err && err.message ? err.message : err) }),
            ),
          );
        });
      }
    } catch (err) {
      window.console.error(err);
      settleScroll();
      pageHost.appendChild(
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty-title', text: '页面渲染出错' }),
          h('div', { class: 'empty-desc', text: String(err && err.message ? err.message : err) }),
        ),
      );
    }
  }

  function renderAll() {
    renderNav();
    renderCurrent();
  }

  // -------------------------------------------------------------------------
  // 外壳文案（标题栏 / 侧栏底部 / 齿轮按钮）
  // 这些字写在 index.html 里，不走页面渲染；英文层（en.js）是就地替换文本节点的，
  // 切回中文时页面正文会整页重绘，外壳却没人管，于是会一直停在英文。
  // -------------------------------------------------------------------------
  function applyShellTexts() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    const info = state.info;
    if (!info) return;
    const ver = document.getElementById('brandVersion');
    if (ver) ver.textContent = 'v' + info.app.version + SP.g2 + t('brand.version');
    const status = document.getElementById('sideStatus');
    if (status && !status.dataset.fixed) status.textContent = t('side.ready');
    const corner = document.getElementById('cornerSettings');
    if (corner) {
      const label = t('nav.settings');
      corner.title = label;
      corner.setAttribute('aria-label', label);
    }
  }

  // -------------------------------------------------------------------------
  // 启动
  // -------------------------------------------------------------------------
  async function boot() {
    try {
      if (!window.dsh) throw new Error('preload 未加载（window.dsh 不存在）');

      state.info = await window.dsh.info();
      state.settings = state.info.settings;
      window.I18N.set(state.settings.general.language);

      state.plugins = await window.dsh.plugins.list();

      applyShellTexts();
      // 切语言时补一遍外壳字（页面正文由 renderAll 重画）
      // 侧栏也要重画：en.js 是就地改 DOM 的，切回中文时原样留着旧英文
      document.addEventListener('i18n:change', () => {
        applyShellTexts();
        if (state.info) renderNav();
      });

      // 右下角齿轮 → 设置页
      const corner = document.getElementById('cornerSettings');
      if (corner) corner.addEventListener('click', () => navigate('settings'));

      state.current = currentFromHash();

      // 没带 hash 启动时，回到上次看的页面（插件页面没界面实现就不回去，免得一开机就是空白页）
      const rawHash = (location.hash || '').replace(/^#\/?/, '');
      const last = state.settings.ui && state.settings.ui.lastPage;
      const lastDef = last ? findPage(last) : null;
      const restoreOk = lastDef && (lastDef.kind !== 'plugin' || !!PAGES[lastDef.id]);
      if (!rawHash && restoreOk) location.hash = '#/' + lastDef.id;

      state.current = currentFromHash();
      renderAll();
      saveLastPage(state.current);

      window.addEventListener('hashchange', () => {
        state.current = currentFromHash();
        renderAll();
        saveLastPage(state.current);
      });
    } catch (err) {
      window.console.error(err);
      document.getElementById('pageTitle').textContent = '启动失败';
      document.getElementById('pageSub').textContent = String(err && err.message ? err.message : err);
      document.getElementById('pageBody').appendChild(
        h(
          'div',
          { class: 'empty' },
          h('div', { class: 'empty-title', text: '界面没能加载应用信息' }),
          h('div', { class: 'empty-desc', text: '可以看日志：' + ((state.info && state.info.paths && state.info.paths.data) || '软件目录\\data') + '\\boot.log' }),
        ),
      );
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();

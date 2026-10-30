'use strict';

/** 插件中心：目录 + 列表 + 启停 */
(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  /**
   * 权限清单的显示顺序：
   * 「默认（Def）」永远排最下面，其余按徽标首字母排，首字母一样就比第二位。
   * 例：Chn → Cli → Data → Def → ... 实际输出 Chn, Cli, Data, Mem, PC, Stk, Tool, Def
   */
  function sortPerms(list) {
    const key = (p) => String(p.badge || '').toLowerCase();
    const isDef = (p) => p.id === 'default';
    return [...list].sort((a, b) => {
      if (isDef(a) !== isDef(b)) return isDef(a) ? 1 : -1;
      const ka = key(a);
      const kb = key(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }

  /** 权限名称：中文界面里补上英文原名，例如「人格修正（Personality correction）」 */
  function permName(t, id) {
    const zh = t('perm.' + id + '.name');
    if (window.I18N.get() !== 'zh-CN') return zh;
    const en = t('perm.' + id + '.en');
    return en && en !== 'perm.' + id + '.en' ? zh + '（' + en + '）' : zh;
  }

  /** 「权限说明」弹窗的内容：把权限清单渲染成一行一条 */
  function buildPermBody(ctx) {
    const { h, t, state } = ctx;
    const list = sortPerms((state.info && state.info.permissions) || []);
    const box = h('div', { class: 'perm-list' });

    for (const perm of list) {
      const target = perm.target
        ? t('perm.target.' + perm.target)
        : t('perm.target.none');
      box.appendChild(
        h(
          'div',
          { class: 'perm-row' },
          h('span', { class: 'perm-badge perm-' + perm.id, text: perm.badge }),
          h(
            'div',
            { class: 'perm-info' },
            h(
              'div',
              { class: 'perm-name' },
              permName(t, perm.id),
              h('span', { class: 'perm-arrow', text: '→' }),
              h('span', { class: 'perm-target', text: target }),
            ),
            h('div', { class: 'perm-desc', text: t('perm.' + perm.id + '.desc') }),
            h('div', { class: 'perm-example', text: t('perm.col.example') + '：' + t('perm.' + perm.id + '.example') }),
          ),
        ),
      );
    }
    return box;
  }

  /** 弹窗底部那个开关：控制插件卡片显示「权限：PC」还是「归属：人格管理 → …」 */
  function buildVerboseSwitch(ctx) {
    const { h, t, state, dsh, toast, refresh } = ctx;
    const on = !!(state.settings.ui && state.settings.ui.verbosePermission);

    return h(
      'div',
      { class: 'switch-row' },
      h(
        'div',
        null,
        h('div', { class: 'switch-row-text', text: t('perm.verbose') }),
        h('div', { class: 'switch-row-hint', text: t('perm.verboseHint') }),
      ),
      h(
        'label',
        { class: 'switch' },
        h('input', {
          type: 'checkbox',
          checked: on,
          onChange: async (event) => {
            const next = event.target.checked;
            try {
              const updated = await dsh.settings.patch({ ui: { verbosePermission: next } });
              state.settings = updated || state.settings;
              refresh();
            } catch (err) {
              toast(String(err && err.message ? err.message : err), true);
              event.target.checked = !next;
            }
          },
        }),
        h('span', { class: 'track' }),
      ),
    );
  }

  PAGES.plugins = {
    render(root, ctx) {
      const { h, t, state, dsh, toast, refresh } = ctx;
      const dir = state.info.paths.plugins;

      // 标题右边的「权限说明」小按钮 → 弹出浮层（跟着窗口走，不开新界面）
      ctx.setActions([
        h(
          'button',
          {
            class: 'chip-btn',
            type: 'button',
            title: t('perm.title'),
            onClick: () =>
              ctx.openModal({
                title: t('perm.title'),
                desc: t('perm.desc'),
                body: buildPermBody(ctx),
                footer: buildVerboseSwitch(ctx),
              }),
          },
          h('span', { class: 'q-mark', text: '?' }),
          h('span', { text: t('perm.open') }),
        ),
      ]);

      // ---------------- 插件目录 ----------------
      root.appendChild(
        h(
          'section',
          { class: 'section' },
          h(
            'div',
            { class: 'section-head' },
            h(
              'div',
              null,
              h('div', { class: 'section-title', text: t('plugins.dir.title') }),
              h('div', { class: 'section-desc', text: t('plugins.dir.desc') }),
              h('div', { class: 'section-note', text: t('plugins.dir.note') }),
            ),
            h(
              'div',
              { class: 'section-tools' },
              h('button', {
                class: 'btn btn-ghost',
                text: t('plugins.open'),
                onClick: () => dsh.openPath(dir),
              }),
              h('button', {
                class: 'btn',
                text: t('plugins.rescan'),
                onClick: async () => {
                  try {
                    state.plugins = await dsh.plugins.reload();
                    state.info = await dsh.info();
                    toast(t('plugins.rescanned'));
                    refresh();
                  } catch (err) {
                    toast(String(err && err.message ? err.message : err), true);
                  }
                },
              }),
            ),
          ),
          h('div', { class: 'path-box' }, h('span', { text: dir })),
        ),
      );

      // ---------------- 已安装插件 ----------------
      const list = h('div', { class: 'list' });
      const items = state.plugins || [];

      /** 确认删除：删插件文件夹 + 它自己的数据目录，删完不可恢复 */
      function confirmDelete(plugin) {
        const dataDir = state.info.paths.data + '\\plugin-data\\' + plugin.id;
        let api = null;
        const ask = () => {
          api = ctx.openModal({
            title: t('plugins.delete.title', { name: plugin.name }),
            desc: t('plugins.delete.desc'),
            body: h(
              'div',
              null,
              h(
                'div',
                { class: 'del-path' },
                h('span', { class: 'del-label', text: t('plugins.delete.folder') }),
                h('code', { text: plugin.dir }),
              ),
              h(
                'div',
                { class: 'del-path' },
                h('span', { class: 'del-label', text: t('plugins.delete.data') }),
                h('code', { text: dataDir }),
              ),
            ),
            footer: h(
              'div',
              { class: 'modal-actions' },
              h('button', {
                class: 'btn',
                type: 'button',
                text: t('common.cancel'),
                onClick: () => api && api.close(),
              }),
              h('button', {
                class: 'btn btn-danger',
                type: 'button',
                text: t('plugins.delete.confirm'),
                onClick: async () => {
                  try {
                    await dsh.plugins.remove(plugin.id);
                    if (api) api.close();
                    state.plugins = await dsh.plugins.list();
                    state.info = await dsh.info();
                    toast(t('plugins.deleted'));
                    refresh();
                  } catch (err) {
                    toast(String(err && err.message ? err.message : err), true);
                  }
                },
              }),
            ),
          });
        };
        ask();
      }

      /** 卡片右下角三个点 → 管理菜单 */
      function openManageMenu(plugin, anchor) {
        ctx.openMenu(anchor, [
          {
            text: t('plugins.menu.openDir'),
            onClick: () => dsh.openPath(plugin.dir),
          },
          {
            text: t('plugins.menu.reload'),
            onClick: async () => {
              try {
                await dsh.plugins.reload();
                state.plugins = await dsh.plugins.list();
                state.info = await dsh.info();
                toast(t('plugins.rescanned'));
                refresh();
              } catch (err) {
                toast(String(err && err.message ? err.message : err), true);
              }
            },
          },
          { sep: true },
          {
            text: t('plugins.menu.delete'),
            danger: true,
            onClick: () => confirmDelete(plugin),
          },
        ]);
      }

      if (!items.length) {
        list.appendChild(
          h(
            'div',
            { class: 'empty' },
            h('div', { class: 'empty-title', text: t('plugins.empty.title') }),
            h('div', { class: 'empty-desc', text: t('plugins.empty.desc') }),
            h(
              'div',
              { class: 'empty-actions' },
              h('button', {
                class: 'btn',
                text: t('plugins.open'),
                onClick: () => dsh.openPath(dir),
              }),
            ),
          ),
        );
      }

      for (const plugin of items) {
        const statusKind =
          plugin.status === 'active' ? 'ok' : plugin.status === 'error' ? 'err' : 'muted';
        const statusText = t('plugins.status.' + plugin.status);

        const toggle = h(
          'label',
          { class: 'switch' },
          h('input', {
            type: 'checkbox',
            checked: plugin.enabled,
            onChange: async (event) => {
              const on = event.target.checked;
              try {
                await dsh.plugins.setEnabled(plugin.id, on);
                state.plugins = await dsh.plugins.list();
                state.info = await dsh.info();
                toast(t('plugins.toggled'));
                refresh();
              } catch (err) {
                toast(String(err && err.message ? err.message : err), true);
                event.target.checked = !on;
              }
            },
          }),
          h('span', { class: 'track' }),
        );

        const permLabel = t('perm.' + plugin.permission + '.name');
        const targetLabel = plugin.permissionTarget
          ? t('perm.target.' + plugin.permissionTarget)
          : t('perm.target.none');

        // 归属行：默认只写「权限：PC」；权限说明里打开「显示更清晰的归属」后
        // 才换成「归属：客户端 → 客户端本身」
        const verbose = !!(state.settings.ui && state.settings.ui.verbosePermission);
        const metaRow = h('div', { class: 'list-sub' });
        const sep = () => metaRow.appendChild(h('span', { class: 'meta-gap' }));
        if (plugin.author) {
          metaRow.appendChild(h('span', { text: t('plugins.author') + ': ' + plugin.author }));
          sep();
        }
        if (verbose) {
          metaRow.appendChild(
            h('span', { text: t('plugins.attribution') + ': ' + permLabel + ' → ' + targetLabel }),
          );
        } else {
          metaRow.appendChild(document.createTextNode(t('plugins.permission') + ': '));
          metaRow.appendChild(
            h('span', {
              class: 'perm-badge perm-' + plugin.permission,
              text: plugin.permissionBadge,
              title: permLabel + ' → ' + targetLabel,
            }),
          );
        }

        list.appendChild(
          h(
            'div',
            { class: 'list-row' },
            h(
              'div',
              { class: 'list-main' },
              h(
                'div',
                { class: 'list-title' },
                plugin.name,
                h('span', { class: 'badge', text: 'v' + plugin.version }),
                h('span', { class: 'badge badge-' + statusKind, text: statusText }),
              ),
              h('div', { class: 'list-sub', text: plugin.description || plugin.id }),
              plugin.error ? h('div', { class: 'list-err', text: plugin.error }) : null,
              metaRow,
            ),
            h(
              'div',
              { class: 'list-ctrl' },
              toggle,
              h(
                'button',
                {
                  class: 'dots-btn',
                  type: 'button',
                  title: t('plugins.manage'),
                  'aria-label': t('plugins.manage'),
                  onClick: (event) => openManageMenu(plugin, event.currentTarget),
                },
                h('i'),
                h('i'),
                h('i'),
              ),
            ),
          ),
        );
      }

      root.appendChild(
        h(
          'section',
          { class: 'section' },
          h(
            'div',
            { class: 'section-head' },
            h('div', { class: 'section-title', text: '已装插件' }),
            h('div', { class: 'section-tools' }, h('span', { class: 'badge', text: t('plugins.count', { n: items.length }) })),
          ),
          list,
        ),
      );
    },
  };
})();

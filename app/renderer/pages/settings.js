'use strict';

/** 设置：通用（语言 / 自启）+ 数据位置 + 关于 */
(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  PAGES.settings = {
    render(root, ctx) {
      const { h, t, state, dsh, toast, refresh } = ctx;
      const settings = state.settings;
      const info = state.info;

      // 通用的一行
      const row = (label, hint, control) =>
        h(
          'div',
          { class: 'row' },
          h(
            'div',
            { class: 'row-main' },
            h('div', { class: 'row-label', text: label }),
            hint ? h('div', { class: 'row-hint', text: hint }) : null,
          ),
          h('div', { class: 'row-ctrl' }, control),
        );

      const section = (title, children) =>
        h(
          'section',
          { class: 'section' },
          h('div', { class: 'section-head' }, h('div', { class: 'section-title', text: title })),
          ...children,
        );

      // ---------------- 通用 ----------------
      const langSelect = h(
        'select',
        {
          class: 'select',
          onChange: async (event) => {
            const value = event.target.value;
            try {
              state.settings = await dsh.settings.patch({ general: { language: value } });
              window.I18N.set(value);
              refresh();
            } catch (err) {
              toast(t('settings.saveFailed') + ': ' + (err.message || err), true);
            }
          },
        },
        ...window.I18N.LIST.map((locale) =>
          h(
            'option',
            { value: locale.id, selected: locale.id === settings.general.language },
            locale.name,
          ),
        ),
      );

      const bootSwitch = h(
        'label',
        { class: 'switch' },
        h('input', {
          type: 'checkbox',
          checked: !!info.startOnBootActual,
          onChange: async (event) => {
            const on = event.target.checked;
            try {
              const result = await dsh.settings.setStartOnBoot(on);
              state.settings = result.settings;
              state.info.startOnBootActual = result.actual;
              if (result.actual !== on) {
                toast(t('settings.saveFailed'), true);
              } else {
                toast(t('settings.saved'));
              }
              refresh();
            } catch (err) {
              toast(t('settings.saveFailed') + ': ' + (err.message || err), true);
              event.target.checked = !on;
            }
          },
        }),
        h('span', { class: 'track' }),
      );

      root.appendChild(
        section(t('settings.general'), [
          row(t('settings.language'), t('settings.languageHint'), langSelect),
          row(t('settings.startOnBoot'), t('settings.startOnBootHint'), bootSwitch),
        ]),
      );

      // ---------------- 数据位置 ----------------
      const pathRow = (label, value) =>
        row(
          label,
          value,
          h('button', { class: 'btn btn-sm', text: t('settings.open'), onClick: () => dsh.openPath(value) }),
        );

      root.appendChild(
        section(t('settings.storage'), [
          h('div', { class: 'section-desc', text: t('settings.storageHint') }),
          pathRow(t('settings.dataDir'), info.paths.data),
          pathRow(t('settings.cacheDir'), info.paths.cache),
          pathRow(t('settings.logsDir'), info.paths.logs),
          pathRow(t('settings.pluginsDir'), info.paths.plugins),
        ]),
      );

      // ---------------- 关于 ----------------
      const aboutRow = (label, value) =>
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: label })),
          h('div', { class: 'row-ctrl' }, h('span', { class: 'list-sub', text: value })),
        );

      // 恢复默认：两次点击确认（不用弹窗）
      let armed = false;
      let armTimer = null;
      const resetBtn = h('button', {
        class: 'btn btn-danger',
        text: t('settings.reset'),
        onClick: async () => {
          if (!armed) {
            armed = true;
            resetBtn.textContent = t('settings.resetConfirm');
            resetBtn.classList.add('btn-danger');
            clearTimeout(armTimer);
            armTimer = setTimeout(() => {
              armed = false;
              resetBtn.textContent = t('settings.reset');
            }, 3200);
            return;
          }
          armed = false;
          clearTimeout(armTimer);
          try {
            state.settings = await dsh.settings.reset();
            await dsh.settings.setStartOnBoot(false);
            window.I18N.set(state.settings.general.language);
            toast(t('settings.resetDone'));
            refresh();
          } catch (err) {
            toast(t('settings.saveFailed') + ': ' + (err.message || err), true);
          }
        },
      });

      root.appendChild(
        section(t('settings.about'), [
          aboutRow(t('settings.version'), 'v' + info.app.version),
          aboutRow(
            t('settings.runtime'),
            `Electron ${info.runtime.electron}` +
              SP.g2 +
              `Chrome ${String(info.runtime.chrome).split('.')[0]}` +
              SP.g2 +
              `Node ${info.runtime.node}`,
          ),
          aboutRow(
            t('settings.db'),
            info.dbBackend === 'sqlite' ? t('settings.dbSqlite') : t('settings.dbJson'),
          ),
          h(
            'div',
            { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-hint', text: t('settings.resetScope') })),
            h('div', { class: 'row-ctrl' }, resetBtn),
          ),
        ]),
      );
    },
  };
})();

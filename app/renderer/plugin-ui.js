'use strict';

/**
 * 插件往页面里加的功能区块
 * ------------------------------------------------------------------
 * 插件在 main 进程里调 ctx.registerSection({ pageId, title, fields, actions })，
 * 本体在这里按"声明"把界面画出来，不需要插件自己写前端。
 *
 * 约定（插件实现三个入口）：
 *   ctx.handle('state',  () => ({ values: { 字段名: 值 }, note: '小字说明' }))
 *   ctx.handle('set',    ({ key, value }) => ({ ok: true }))
 *   ctx.handle('action', ({ key }) => ({ ok: true, message: '做完了' }))
 */

(function () {
  function fieldControl(ctx, sec, f, values, onChange) {
    const h = ctx.h;
    const val = values && values[f.key] !== undefined ? values[f.key] : '';
    let el;

    if (f.type === 'switch') {
      const input = h('input', { type: 'checkbox' });
      input.checked = !!val;
      input.addEventListener('change', () => onChange(f.key, !!input.checked));
      return h('label', { class: 'switch' }, input, h('span', { class: 'track' }));
    }

    if (f.type === 'textarea' || f.type === 'list') {
      el = h('textarea', {
        class: 'input input-area',
        rows: f.type === 'list' ? 3 : 4,
        placeholder: f.placeholder || '',
      });
      el.value = f.type === 'list' ? (Array.isArray(val) ? val.join('，') : String(val || '')) : String(val || '');
    } else if (f.type === 'select') {
      el = h('select', { class: 'select' });
      (f.options || []).forEach((o) => {
        const opt = h('option', { value: o.value, text: o.label || o.value });
        if (String(o.value) === String(val)) opt.selected = true;
        el.appendChild(opt);
      });
    } else {
      el = h('input', {
        class: 'input' + (f.type === 'number' ? ' input-num' : ''),
        type: f.type === 'number' ? 'number' : 'text',
        placeholder: f.placeholder || '',
      });
      el.value = val === undefined || val === null ? '' : String(val);
    }

    const commit = () => {
      let out = el.value;
      if (f.type === 'list') {
        out = String(out)
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (f.type === 'number') out = Number(out) || 0;
      onChange(f.key, out);
    };
    el.addEventListener('change', commit);
    if (f.type === 'list' || f.type === 'textarea') el.addEventListener('blur', commit);

    return el;
  }

  function renderSection(ctx, sec) {
    const h = ctx.h;
    const body = h('div', { class: 'plugin-body' }, h('div', { class: 'empty', text: '正在读取…' }));
    const section = h(
      'section',
      { class: 'section plugin-section' },
      h(
        'div',
        { class: 'section-head' },
        h(
          'div',
          null,
          h('div', { class: 'section-title', text: sec.title }),
          sec.desc ? h('div', { class: 'section-note', text: sec.desc }) : null,
        ),
        h('span', { class: 'badge', text: '插件' }),
      ),
      body,
    );

    const paint = async () => {
      let values = {};
      let note = '';
      try {
        const res = (await ctx.dsh.plugins.call(sec.pluginId, 'state', {})) || {};
        values = res.values || {};
        note = res.note || '';
      } catch (err) {
        body.textContent = '';
        body.appendChild(h('div', { class: 'empty', text: '插件没响应：' + String(err.message || err) }));
        return;
      }
      if (!ctx.alive()) return;

      body.textContent = '';
      const push = async (key, value) => {
        try {
          await ctx.dsh.plugins.call(sec.pluginId, 'set', { key, value });
        } catch (err) {
          ctx.toast(String(err.message || err));
        }
      };

      (sec.fields || []).forEach((f) => {
        const hint = f.hint ? h('div', { class: 'row-hint', text: f.hint }) : null;
        if (f.type === 'switch') {
          body.appendChild(
            h(
              'div',
              { class: 'row' },
              h('div', { class: 'row-main' }, h('div', { class: 'row-title', text: f.label }), hint),
              h('div', { class: 'row-ctrl' }, fieldControl(ctx, sec, f, values, push)),
            ),
          );
        } else {
          body.appendChild(
            h(
              'div',
              { class: 'row row-stack' },
              h('div', { class: 'row-title', text: f.label }),
              hint,
              h('div', { class: 'row-field' }, fieldControl(ctx, sec, f, values, push)),
            ),
          );
        }
      });

      if (note) body.appendChild(h('div', { class: 'section-note', text: note }));

      if ((sec.actions || []).length) {
        const bar = h('div', { class: 'row-actions' });
        (sec.actions || []).forEach((a) => {
          const btn = h('button', {
            class: 'btn' + (a.type === 'primary' ? ' btn-primary' : ''),
            type: 'button',
            text: a.label,
          });
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
              const res = (await ctx.dsh.plugins.call(sec.pluginId, 'action', { key: a.key })) || {};
              ctx.toast(res.message || (res.ok ? '好了' : '没成功'));
            } catch (err) {
              ctx.toast(String(err.message || err));
            } finally {
              btn.disabled = false;
              paint();
            }
          });
          bar.appendChild(btn);
        });
        body.appendChild(bar);
      }
    };

    paint();
    return section;
  }

  window.renderPluginSections = function (host, pageId, ctx) {
    if (!window.dsh || !window.dsh.sections) return;
    window.dsh.sections
      .list(pageId)
      .then((list) => {
        if (!ctx.alive || !ctx.alive()) return;
        (list || []).forEach((sec) => host.appendChild(renderSection(ctx, sec)));
      })
      .catch(() => {
        /* 插件区块出错不影响页面本身 */
      });
  };
})();

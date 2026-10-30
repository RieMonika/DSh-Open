'use strict';

/**
 * 能力说明
 * ------------------------------------------------------------
 * 一张「现在能干什么、不能干什么」的清单。
 * 每条都能改说明文字，也能自己加一条（比如"以后要做的"）。
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  const AREA_NAME = {
    qq: 'QQ',
    bilibili: 'B 站',
    model: '模型 / 人格',
    memory: '记忆',
    other: '其它',
  };

  const STATUS = {
    done: { text: '能做', cls: 'badge badge-ok' },
    todo: { text: '还没做', cls: 'badge badge-warn' },
    no: { text: '不能做', cls: 'badge badge-err' },
  };

  PAGES.abilities = {
    async render(root, ctx) {
      const { h, toast, refresh, dsh } = ctx;
      const items = await dsh.abilities.list();
      if (!ctx.alive()) return;

      const counts = { done: 0, todo: 0, no: 0 };
      for (const it of items) if (counts[it.status] !== undefined) counts[it.status] += 1;

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
              h('div', { class: 'section-title', text: '这个软件现在能做什么' }),
              h('div', {
                class: 'section-desc',
                text: '老实写清楚，免得你以为它能做到其实做不到。每条说明都能自己改。',
              }),
            ),
            h(
              'div',
              { class: 'section-tools' },
              h('span', { class: 'badge badge-ok', text: '能做 ' + counts.done }),
              h('span', { class: 'badge badge-warn', text: '还没做 ' + counts.todo }),
              h('span', { class: 'badge badge-err', text: '不能做 ' + counts.no }),
            ),
          ),
        ),
      );

      const areas = ['qq', 'bilibili', 'model', 'memory', 'other'];
      for (const area of areas) {
        const rows = items.filter((it) => it.area === area);
        if (!rows.length) continue;
        const sec = h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('div', null, h('div', { class: 'section-title', text: AREA_NAME[area] || area }))));
        const list = h('div', { class: 'list' });
        for (const it of rows) {
          const st = STATUS[it.status] || STATUS.todo;
          const row = h(
            'div',
            { class: 'list-row' },
            h(
              'div',
              { class: 'list-main' },
              h('div', { class: 'list-title' }, h('strong', { text: it.title }), h('span', { class: st.cls, text: st.text }), it.builtin ? h('span', { class: 'badge', text: '内置' }) : h('span', { class: 'badge', text: '自建' })),
              h('div', { class: 'list-sub', text: it.note || '（还没写说明）' }),
            ),
            h(
              'div',
              { class: 'list-ctrl' },
              h('button', {
                class: 'btn btn-sm',
                type: 'button',
                text: '改说明',
                onClick: () => openEdit(it),
              }),
            ),
          );
          list.appendChild(row);
        }
        sec.appendChild(list);
        root.appendChild(sec);
      }

      root.appendChild(
        h(
          'div',
          { class: 'row-actions', style: 'margin-top:4px' },
          h('button', {
            class: 'btn btn-primary',
            type: 'button',
            text: '加一条',
            onClick: () => openEdit(null),
          }),
        ),
      );

      function openEdit(item) {
        const isNew = !item;
        const locked = !!(item && item.builtin);
        const title = h('input', { class: 'input', type: 'text', value: item ? item.title : '', placeholder: '比如：能把消息同步到手机', disabled: locked });
        const areaSel = h(
          'select',
          { class: 'select', disabled: locked },
          ...['qq', 'bilibili', 'model', 'memory', 'other'].map(function (a) {
            const o = h('option', { value: a, text: AREA_NAME[a] || a });
            if (item && item.area === a) o.selected = true;
            return o;
          }),
        );
        const statusSel = h(
          'select',
          { class: 'select', disabled: locked },
          ...['done', 'todo', 'no'].map(function (s) {
            const o = h('option', { value: s, text: STATUS[s].text });
            if (item && item.status === s) o.selected = true;
            return o;
          }),
        );
        const note = h('textarea', { class: 'input textarea', rows: '4', value: item ? item.note : '', placeholder: '说清楚：能做什么、怎么做、有什么限制' });

        const body = h(
          'div',
          null,
          h('div', { class: 'form-row' }, h('div', { class: 'form-label', text: '标题' }), title),
          h('div', { class: 'form-row' }, h('div', { class: 'form-label', text: '属于' }), areaSel, h('div', { class: 'form-label', text: '状态' }), statusSel),
          h('div', { class: 'form-row' }, h('div', { class: 'form-label', text: '说明' }), note),
          h(
            'div',
            { class: 'modal-actions' },
            h('button', { class: 'btn', type: 'button', text: '取消', onClick: () => close() }),
            !isNew && !item.builtin
              ? h('button', {
                  class: 'btn btn-danger',
                  type: 'button',
                  text: '删掉这条',
                  onClick: () => {
                    dsh.abilities.remove(item.id).then(() => {
                      close();
                      refresh();
                    });
                  },
                })
              : null,
            h('button', {
              class: 'btn btn-primary',
              type: 'button',
              text: '保存',
              onClick: () => {
                const payload = { title: title.value.trim(), area: areaSel.value, status: statusSel.value, note: note.value };
                const job = isNew ? dsh.abilities.add(payload) : dsh.abilities.save({ ...item, ...payload });
                job
                  .then(() => {
                    close();
                    toast('已保存');
                    refresh();
                  })
                  .catch((err) => toast(String(err.message || err), true));
              },
            }),
          ),
        );

        const m = ctx.openModal({
          title: isNew ? '加一条能力' : locked ? '改这一条的说明' : '改说明',
          desc: isNew ? '自己加一条，比如以后想做的功能。' : locked ? '内置条目的标题和状态是写死的，这里只能改说明。' : '自建条目可以改标题、状态，也可以删。',
          body,
        });
        function close() {
          if (m && typeof m.close === 'function') m.close();
          else if (m && m.remove) m.remove();
        }
      }
    },
  };
})();

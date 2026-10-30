'use strict';
/**
 * 记忆页（可视化）
 * 把「她记得什么、还记不记得、要不要忘」摊开给人看。
 * 数据全部来自 window.dsh.memory.*，不自己算业务。
 */
(function () {
  let h;
  let t;

  function pct(x) {
    return Math.max(0, Math.min(100, Math.round((Number(x) || 0) * 100)));
  }

  function bar(value, cls) {
    const p = pct(value);
    return h(
      'div',
      { class: 'membar ' + (cls || '') },
      h('i', { style: 'width:' + p + '%' }),
    );
  }

  function fmtTime(ms) {
    if (!ms) return '没用过';
    const d = new Date(Number(ms));
    const dd = Math.floor((Date.now() - Number(ms)) / 86400000);
    if (dd <= 0) return '今天用过';
    if (dd === 1) return '昨天用过';
    return dd + ' 天前用过';
  }

  function kindZh(k) {
    return (
      {
        fact: '事实',
        pref: '喜好',
        event: '事件',
        bond: '关系',
        plan: '约定',
        other: '其它',
      }[k] || '事实'
    );
  }

  window.DSHPages.memory = {
    async render(el, ctx) {
      h = ctx.h;
      t = ctx.t;
      const M = ctx.dsh.memory;
      el.appendChild(
        h(
          'div',
          { class: 'section' },
          h('div', { class: 'section-title' }, '记忆是怎么回事'),
          h('div', {
            class: 'section-note',
            text: '她记得的东西都存在本机数据库里。用得越多记得越牢，久不想起会慢慢变淡、最后收进归档区（不是删掉，随时能翻）。',
          }),
        ),
      );

      const extraBox = h('div', { class: 'section' });
      ctx.dsh.archive.stats().then((a) => {
        const rows = [
          h('div', { class: 'row-title', text: '全量存档' }),
          h('div', { class: 'row-hint', text: '只追加、永不删、也不塞进提示词。记忆被遗忘后，原材料还在这里。' }),
          h('div', { class: 'row-hint', text: '月份：' + (a.months.join(' / ') || '还没有') + ' · 约 ' + a.approx + ' 条 · ' + a.mb + ' MB' }),
        ];
        extraBox.appendChild(h('div', { class: 'row' }, h('div', {}, ...rows), h('div', { class: 'row-ctrl' }, h('button', { class: 'btn', text: '打开存档目录', onClick: () => ctx.dsh.openPath(ctx.state.info.paths.data + '\\archive') }))));
      }).catch(() => {});
      ctx.dsh.motive.now().then(async (m) => {
        const text = m && m.text ? m.text : '还没有，点右边让她想一想';
        const line = h('div', { class: 'row-hint', text: '她现在琢磨的是：' + text });
        const btn = h('button', { class: 'btn', text: '再想一次', onClick: async () => { const r = await ctx.dsh.motive.refresh(); line.textContent = '她现在琢磨的是：' + (r.text || '（没想出来）'); } });
        extraBox.appendChild(h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title', text: '主动动机' }), line), h('div', { class: 'row-ctrl' }, btn)));
      }).catch(() => {});
      el.appendChild(extraBox);
      const rhythmBox = h('div', { class: 'section' });
      el.appendChild(rhythmBox);
      ctx.dsh.rhythm.now().then((r) => {
        rhythmBox.appendChild(
          h(
            'div',
            { class: 'row' },
            h(
              'div',
              {},
              h('div', { class: 'row-title', text: '她现在的状态 · ' + r.label + '（' + r.hour + ' 点）' }),
              h('div', { class: 'row-hint', text: r.mood + ' —— 说话方式：' + r.style }),
            ),
            h('div', { class: 'rhythm-gauge' }, h('i', { style: 'width:' + Math.round(r.energy * 100) + '%' }), h('span', { text: '精力 ' + Math.round(r.energy * 100) + '%' })),
          ),
        );
      }).catch(() => {});

      const statsBox = h('div', { class: 'section' }, h('div', { class: 'muted', text: '加载中…' }));
      el.appendChild(statsBox);
      const listBox = h('div', { class: 'section' }, h('div', { class: 'muted', text: '加载中…' }));
      el.appendChild(listBox);
      const archBox = h('div', { class: 'section' });
      el.appendChild(archBox);

      let showArchived = false;

      async function renderStats() {
        const s = (await M.stats()) || {};
        const d = s.decay || {};
        statsBox.textContent = '';
        statsBox.appendChild(h('div', { class: 'section-title' }, '总览'));
        statsBox.appendChild(
          h(
            'div',
            { class: 'stat-grid' },
            h('div', { class: 'stat' }, h('b', { text: String(s.active ?? s.count ?? 0) }), h('span', { text: '还在记着' })),
            h('div', { class: 'stat' }, h('b', { text: String(s.archived || 0) }), h('span', { text: '已归档' })),
            h('div', { class: 'stat' }, h('b', { text: String(s.vectorized || 0) }), h('span', { text: '有向量' })),
            h('div', { class: 'stat' }, h('b', { text: String(s.dim || 0) }), h('span', { text: '向量维度' })),
          ),
        );
        statsBox.appendChild(
          h(
            'div',
            { class: 'row' },
            h(
              'div',
              {},
              h('div', { class: 'row-title', text: '遗忘曲线' }),
              h('div', {
                class: 'row-hint',
                text:
                  '半衰期 ' +
                  (d.halfLifeDays || 30) +
                  ' 天，强度低于 ' +
                  (Math.round((d.forgetBelow || 0.25) * 100) / 100) +
                  ' 就归档。' +
                  (d.enabled === false ? '（现在是关着的）' : ''),
              }),
            ),
            h(
              'button',
              {
                class: 'btn',
                onclick: async () => {
                  const r = await M.decay();
                  ctx.toast(
                    r && r.ok ? '整理完了，归档了 ' + (r.archived || 0) + ' 条' : '遗忘曲线是关着的',
                  );
                  renderAll();
                },
              },
              '现在整理一次',
            ),
          ),
        );
        const prof = (await M.profile(8)) || [];
        if (prof.length) {
          statsBox.appendChild(h('div', { class: 'sub-title', text: '长期画像（永远带着）' }));
          const box = h('div', { class: 'profile-list' });
          prof.forEach((p) => {
            box.appendChild(
              h('div', { class: 'profile-item' }, h('span', { class: 'dot', text: '●' }), h('span', { text: p.text })),
            );
          });
          statsBox.appendChild(box);
        }
      }

      async function renderList() {
        const items = (await M.list(200, { includeArchived: false })) || [];
        listBox.textContent = '';
        listBox.appendChild(
          h(
            'div',
            { class: 'section-head' },
            h('div', { class: 'section-title' }, '正在记着（' + items.length + '）'),
            h(
              'button',
              { class: 'btn btn-mini', onclick: () => renderAll() },
              '刷新',
            ),
          ),
        );
        if (!items.length) {
          listBox.appendChild(h('div', { class: 'empty', text: '还没有记忆。跟她聊几句，或者在上面的输入框里手动记一条。' }));
          return;
        }
        const ul = h('div', { class: 'mem-list' });
        items.forEach((m) => {
          const strength = Number(m.strength) || 1;
          ul.appendChild(
            h(
              'div',
              { class: 'mem-row' + (m.pinned ? ' is-pinned' : '') },
              h(
                'div',
                { class: 'mem-main' },
                h(
                  'div',
                  { class: 'mem-text' },
                  (m.pinned ? '📌 ' : '') + m.text,
                ),
                h(
                  'div',
                  { class: 'mem-meta' },
                  h('span', { class: 'tag', text: kindZh(m.kind) }),
                  h('span', { class: 'tag', text: '重要 ' + (m.importance || 5) + '/10' }),
                  h('span', { class: 'tag', text: fmtTime(m.lastUsedAt) }),
                  h('span', { class: 'tag', text: '用过 ' + (m.usedCount || 0) + ' 次' }),
                ),
              ),
              h(
                'div',
                { class: 'mem-side' },
                h('div', { class: 'mem-strength' }, bar(Math.min(1, strength / 2.5)), h('span', { text: '记得 ' + pct(Math.min(1, strength / 2.5)) + '%' })),
                h(
                  'button',
                  {
                    class: 'btn btn-mini',
                    onclick: async () => {
                      await M.update(m.id, { pinned: !m.pinned });
                      renderList();
                    },
                  },
                  m.pinned ? '取消置顶' : '置顶',
                ),
              ),
            ),
          );
        });
        listBox.appendChild(ul);
      }

      async function renderArchived() {
        archBox.textContent = '';
        archBox.appendChild(
          h(
            'div',
            { class: 'section-head' },
            h('div', { class: 'section-title' }, '归档区'),
            h(
              'button',
              {
                class: 'btn btn-mini',
                onclick: () => {
                  showArchived = !showArchived;
                  renderArchived();
                },
              },
              showArchived ? '收起' : '展开看看',
            ),
          ),
        );
        if (!showArchived) {
          archBox.appendChild(
            h('div', { class: 'muted', text: '已经淡忘的条目会收到这里。不影响使用，只是不再进提示词。' }),
          );
          return;
        }
        const items = (await M.list(500, { includeArchived: true })) || [];
        const arch = items.filter((x) => x.archived);
        if (!arch.length) {
          archBox.appendChild(h('div', { class: 'muted', text: '归档区是空的。' }));
          return;
        }
        const ul = h('div', { class: 'mem-list' });
        arch.forEach((m) => {
          ul.appendChild(
            h(
              'div',
              { class: 'mem-row is-archived' },
              h('div', { class: 'mem-main' }, h('div', { class: 'mem-text', text: m.text })),
              h(
                'div',
                { class: 'mem-side' },
                h(
                  'button',
                  {
                    class: 'btn btn-mini',
                    onclick: async () => {
                      await M.update(m.id, { archived: false, strength: 1.2 });
                      ctx.toast('捞回来了');
                      renderAll();
                    },
                  },
                  '重新记住',
                ),
              ),
            ),
          );
        });
        archBox.appendChild(ul);
      }

      async function renderAll() {
        try {
          await renderStats();
          await renderList();
          await renderArchived();
        } catch (e) {
          ctx.toast('读记忆失败：' + (e && e.message));
        }
      }

      renderAll();
    },
  };
})();

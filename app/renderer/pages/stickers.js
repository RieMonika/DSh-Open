'use strict';

/**
 * 表情包页（浏览 + 管理）
 * ------------------------------------------------------------
 * 图还在你自己的目录里，这里只是浏览、改分组、收藏、删除、发出去。
 * 手动改的标签存在 <data>\stickers-overrides.json，重扫也不会丢；
 * 删除是把文件**移到** <data>\stickers-trash\<时间戳>\，不会真的删掉。
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});
  const PAGE_SIZE = 60;

  function fileUrl(url) {
    try {
      return encodeURI(url);
    } catch (_) {
      return url;
    }
  }

  PAGES.stickers = {
    async render(root, ctx) {
      const { h, toast, refresh, dsh, openModal } = ctx;

      // 重新进页面时把「管理态」归零，避免上一次残留的全局 class 让勾选框还在
      document.body.classList.remove('is-managing');

      let stats = await dsh.stickers.stats();
      if (!ctx.alive()) return;
      const cfgStickers = ((await dsh.settings.get()) || {}).stickers || {};

      let emotion = '全部';
      let keyword = '';
      let offset = 0;
      let buffer = [];
      let managing = false;
      const picked = new Set();

      // ---------- 顶部：来源 + 统计 ----------
      const statLine = h('div', { class: 'section-desc' });
      const pathLine = h('div', { class: 'path-box', text: stats.source });

      const paintStats = () => {
        const bits = [`共 ${stats.total} 张`, `${stats.groups.length} 个分组`];
        if (stats.favorites) bits.push(`★ 收藏 ${stats.favorites}`);
        if (stats.uncategorized) bits.push(`未分类 ${stats.uncategorized}`);
        statLine.textContent = SP.join(bits, SP.g2);
        // 还没选目录时别摆一个空框，直接给一句引导
        pathLine.textContent = stats.source || '还没选目录：在下面填一个文件夹，再点「使用这个目录」（也可以点「重新扫描」选文件夹）';
        pathLine.classList.toggle('is-empty', !stats.source);
      };
      paintStats();

      const section = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h('div', null, h('div', { class: 'section-title', text: '目录与自动收藏' }), statLine),
          h(
            'div',
            { class: 'section-tools' },
            h('button', {
              class: 'btn btn-sm',
              type: 'button',
              text: '打开目录',
              onClick: () => {
                if (!stats.source) {
                  toast('还没选目录', true);
                  return;
                }
                dsh.openPath(stats.source);
              },
            }),
            h('button', {
              class: 'btn btn-sm',
              type: 'button',
              text: '重新扫描',
              onClick: async () => {
                stats = await dsh.stickers.rescan();
                if (!ctx.alive()) return;
                paintStats();
                toast('已重新扫描：' + stats.total + ' 张');
                refresh();
              },
            }),
          ),
        ),
        pathLine,
        h(
          'div',
          { class: 'inline-row' },
          h('input', {
            class: 'input',
            id: 'stickerSource',
            type: 'text',
            placeholder: '换一个目录（留空 = 先不用表情包）',
          }),
          h('button', {
            class: 'btn',
            type: 'button',
            text: '使用这个目录',
            onClick: async () => {
              const input = document.getElementById('stickerSource');
              const dir = input ? input.value.trim() : '';
              try {
                const next = await dsh.stickers.setSource(dir);
                if (!ctx.alive()) return;
                toast(next.total ? '已切换：' + next.total + ' 张' : '这个目录里没找到图片');
                refresh();
              } catch (err) {
                toast(String(err.message || err), true);
              }
            },
          }),
        ),
        h('div', {
          class: 'section-note',
          text: '文件名能看出情绪（比如“笑”“哭”“摸头”），就自动分到对应分组；看不出来的先归到「其它」，可以用下面的「管理」自己改。',
        }),
        (() => {
          const sw = h('label', { class: 'switch' }, h('input', { type: 'checkbox' }), h('span', { class: 'track' }));
          const box = sw.querySelector('input');
          box.checked = cfgStickers.saveFromOwner !== false;
          box.addEventListener('change', async () => {
            const on = !!box.checked;
            try {
              await dsh.settings.patch({ stickers: { saveFromOwner: on } });
              toast(on ? '以后收到表情包会自动存进来' : '关掉了，只从消息里手动存');
            } catch (err) {
              box.checked = !on;
              toast(String(err.message || err), true);
            }
          });
          return h(
            'div',
            { class: 'row' },
            h(
              'div',
              { class: 'row-main' },
              h('div', { class: 'row-title', text: '收到表情就存进来' }),
              h('div', {
                class: 'row-desc',
                text: '管理员 QQ 发来的表情包，收到后自动收进这个目录（同一张只存一次）；关掉就只在消息里双击手动存。',
              }),
            ),
            sw,
          );
        })(),
      );
      root.appendChild(section);

      // ---------- 列表 ----------
      const chips = h('div', { class: 'chips' });
      const grid = h('div', { class: 'sticker-grid' });
      const moreWrap = h('div', { class: 'row' });
      const searchInput = h('input', {
        class: 'input',
        type: 'search',
        placeholder: '按文件名找（回车）',
        onKeydown: (e) => {
          if (e.key !== 'Enter') return;
          keyword = String(e.currentTarget.value || '').trim();
          load(true);
        },
      });

      const manageBtn = h('button', {
        class: 'btn btn-sm',
        type: 'button',
        text: '管理',
        onClick: () => {
          managing = !managing;
          picked.clear();
          manageBtn.textContent = managing ? '退出管理' : '管理';
          manageBtn.classList.toggle('is-active', managing);
          document.body.classList.toggle('is-managing', managing);
          paintBulkBar();
          load(true);
        },
      });

      const listSection = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h('div', { class: 'section-title', text: '挑一张' }),
          h('div', { class: 'section-tools' }, searchInput, manageBtn),
        ),
        chips,
        grid,
        moreWrap,
      );
      root.appendChild(listSection);

      // ---------- 批量操作条 ----------
      const bulkText = h('div', { class: 'bulk-text' });
      const bulkGroup = h('select', { class: 'select bulk-select' });
      const bulkBar = h(
        'div',
        { class: 'bulk-bar' },
        bulkText,
        bulkGroup,
        h('button', {
          class: 'btn btn-sm',
          type: 'button',
          text: '收藏',
          onClick: () => bulkFavorite(true),
        }),
        h('button', {
          class: 'btn btn-sm',
          type: 'button',
          text: '取消收藏',
          onClick: () => bulkFavorite(false),
        }),
        h('button', {
          class: 'btn btn-sm btn-danger',
          type: 'button',
          text: '移到回收站',
          onClick: () => bulkRemove(),
        }),
        h('button', {
          class: 'btn btn-sm',
          type: 'button',
          text: '清空选择',
          onClick: () => {
            picked.clear();
            paintBulkBar();
            load(true);
          },
        }),
      );
      root.appendChild(bulkBar);

      const allGroups = [{ name: '全部', count: stats.total }];
      if (stats.favorites) allGroups.push({ name: '@fav', count: stats.favorites });
      for (const g of stats.groups) allGroups.push(g);

      function chipLabel(name, count) {
        return name === '@fav' ? `★ 收藏 ${count}` : `${name} ${count}`;
      }

      function renderChips() {
        chips.textContent = '';
        for (const group of allGroups) {
          chips.appendChild(
            h('button', {
              class: 'chip' + (group.name === emotion ? ' is-active' : ''),
              type: 'button',
              text: chipLabel(group.name, group.count),
              onClick: () => {
                if (emotion === group.name) return;
                emotion = group.name;
                offset = 0;
                buffer = [];
                renderChips();
                load(true);
              },
            }),
          );
        }
      }

      function paintBulkBar() {
        bulkBar.classList.toggle('is-on', managing);
        bulkText.textContent = picked.size ? `已选 ${picked.size} 张` : '选几张，然后批量改分组';
        // 分组下拉
        const groups = stats.emotions || [];
        const cur = bulkGroup.value;
        bulkGroup.textContent = '';
        bulkGroup.appendChild(h('option', { value: '', text: '改成哪个分组…' }));
        for (const name of groups) bulkGroup.appendChild(h('option', { value: name, text: name }));
        if (groups.includes(cur)) bulkGroup.value = cur;
      }

      function syncCard(node, item) {
        node.classList.toggle('is-selected', picked.has(item.file));
        node.classList.toggle('is-fav', !!item.favorite);
      }

      function card(item) {
        const img = h('img', { class: 'sticker-thumb', src: fileUrl(item.url), alt: item.name, loading: 'lazy' });
        const star = h('button', {
          class: 'sticker-star' + (item.favorite ? ' is-on' : ''),
          type: 'button',
          title: item.favorite ? '取消收藏' : '收藏',
          text: item.favorite ? '★' : '☆',
          onClick: async (e) => {
            e.stopPropagation();
            const on = !item.favorite;
            try {
              await dsh.stickers.setFavorite([item.file], on);
              if (!ctx.alive()) return;
              item.favorite = on;
              star.textContent = on ? '★' : '☆';
              star.classList.toggle('is-on', on);
              node.classList.toggle('is-fav', on);
              toast(on ? '已收藏' : '已取消收藏');
            } catch (err) {
              toast(String(err.message || err), true);
            }
          },
        });
        const check = h('div', { class: 'sticker-check', text: '' });
        const node = h(
          'div',
          {
            class: 'sticker-card',
            title: item.name,
            onClick: () => {
              if (!managing) return showDetail(item);
              if (picked.has(item.file)) picked.delete(item.file);
              else picked.add(item.file);
              syncCard(node, item);
              paintBulkBar();
            },
          },
          img,
          star,
          check,
          h('div', { class: 'sticker-name', text: item.emotion }),
        );
        if (picked.has(item.file)) node.classList.add('is-selected');
        if (item.favorite) node.classList.add('is-fav');
        return node;
      }

      // ---------- 详情 ----------
      async function showDetail(item) {
        const conversations = await dsh.inbox.conversations(20).catch(() => []);
        if (!ctx.alive()) return;

        const select = h('select', { class: 'select' });
        for (const name of stats.emotions || []) select.appendChild(h('option', { value: name, text: name }));
        select.value = item.emotion;

        const body = h(
          'div',
          { class: 'sticker-detail' },
          h('img', { class: 'sticker-big', src: fileUrl(item.url), alt: item.name }),
          h('div', { class: 'del-label', text: '文件名' }),
          h('div', { class: 'path-box', text: item.name }),

          h('div', { class: 'del-label', text: '分组' }),
          h(
            'div',
            { class: 'inline-row' },
            select,
            h('button', {
              class: 'btn btn-sm',
              type: 'button',
              text: '保存分组',
              onClick: async () => {
                try {
                  await dsh.stickers.setEmotion([item.file], select.value);
                  if (!ctx.alive()) return;
                  toast('已改成「' + select.value + '」');
                  close();
                  refresh();
                } catch (err) {
                  toast(String(err.message || err), true);
                }
              },
            }),
            h('button', {
              class: 'btn btn-sm',
              type: 'button',
              text: '打开文件位置',
              onClick: () => dsh.stickers.reveal(item.file),
            }),
          ),

          h('div', { class: 'del-label', text: '发给谁' }),
        );

        if (!conversations.length) {
          body.appendChild(
            h('div', { class: 'section-note', text: '还没有会话。先连上 QQ、收到一条消息，这里才会列出可发送的对象。' }),
          );
        } else {
          const row = h('div', { class: 'chips' });
          for (const conv of conversations) {
            row.appendChild(
              h('button', {
                class: 'chip',
                type: 'button',
                text: conv.title || conv.id,
                onClick: async (e) => {
                  const btn = e.currentTarget;
                  btn.disabled = true;
                  try {
                    await dsh.stickers.send(conv.id, item.file);
                    if (!ctx.alive()) return;
                    toast('已发给 ' + (conv.title || conv.id));
                    close();
                  } catch (err) {
                    btn.disabled = false;
                    toast(String(err.message || err), true);
                  }
                },
              }),
            );
          }
          body.appendChild(row);
        }

        body.appendChild(
          h(
            'div',
            { class: 'row' },
            h('button', {
              class: 'btn btn-sm btn-danger',
              type: 'button',
              text: '移到回收站',
              onClick: () => {
                close();
                confirmRemove([item.file]);
              },
            }),
          ),
        );

        const close = openModal({ title: '这张表情', body });
        return close;
      }

      function confirmRemove(files) {
        const body = h(
          'div',
          null,
          h('div', { class: 'section-desc', text: `要把这 ${files.length} 张移出去吗？` }),
          h('div', {
            class: 'section-note',
            text: '不是真删除 —— 会挪到回收站目录，后悔了还能拿出来放回去。',
          }),
          h('div', { class: 'path-box', text: stats.trashDir }),
        );
        openModal({
          title: '移到回收站',
          body,
          footer: h(
            'div',
            { class: 'modal-actions' },
            h('button', { class: 'btn btn-sm', type: 'button', text: '取消', onClick: () => close2() }),
            h('button', {
              class: 'btn btn-sm btn-danger',
              type: 'button',
              text: '确定移走',
              onClick: async () => {
                try {
                  const res = await dsh.stickers.remove(files);
                  close2();
                  if (!ctx.alive()) return;
                  toast(`已移走 ${res.moved} 张`);
                  refresh();
                } catch (err) {
                  toast(String(err.message || err), true);
                }
              },
            }),
          ),
        });
        const close2 = () => document.querySelectorAll('.modal-mask').forEach((m) => m.remove());
      }

      async function bulkFavorite(on) {
        if (!picked.size) return toast('先选几张', true);
        try {
          const res = await dsh.stickers.setFavorite(Array.from(picked), on);
          if (!ctx.alive()) return;
          toast((on ? '已收藏 ' : '已取消收藏 ') + res.changed + ' 张');
          refresh();
        } catch (err) {
          toast(String(err.message || err), true);
        }
      }

      async function bulkGroupApply() {
        if (!picked.size) return toast('先选几张', true);
        const target = bulkGroup.value;
        if (!target) return toast('先选一个分组', true);
        try {
          const res = await dsh.stickers.setEmotion(Array.from(picked), target);
          if (!ctx.alive()) return;
          toast(`已把这 ${res.changed} 张改成「${target}」`);
          bulkGroup.value = '';
          refresh();
        } catch (err) {
          toast(String(err.message || err), true);
        }
      }

      bulkGroup.addEventListener('change', bulkGroupApply);

      function bulkRemove() {
        if (!picked.size) return toast('先选几张', true);
        confirmRemove(Array.from(picked));
      }

      async function load(reset) {
        if (reset) {
          offset = 0;
          buffer = [];
          grid.textContent = '';
          moreWrap.textContent = '';
        }
        const page = await dsh.stickers.list({ emotion, keyword, offset, limit: PAGE_SIZE });
        if (!ctx.alive()) return;
        offset += page.items.length;
        buffer = buffer.concat(page.items);
        for (const item of page.items) grid.appendChild(card(item));
        if (!buffer.length) {
          grid.appendChild(h('div', { class: 'empty', text: '这个分组里没有图' }));
        }
        moreWrap.textContent = '';
        if (page.total > buffer.length) {
          moreWrap.appendChild(
            h('button', {
              class: 'btn btn-sm',
              type: 'button',
              text: `再看 ${Math.min(PAGE_SIZE, page.total - buffer.length)} 张（还有 ${page.total - buffer.length}）`,
              onClick: () => load(false),
            }),
          );
        }
      }

      renderChips();
      paintBulkBar();
      await load(true);
    },
  };
})();

'use strict';

/**
 * 消息页（统一收件箱）
 * ------------------------------------------------------------
 * 左边会话、右边聊天记录、底下输入框。
 * 现在只有 QQ 一个通道往里写数据，以后 B 站接进来也是同一套。
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  let pollTimer = null;

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /** file:/// 地址还原成本地磁盘路径（双击放大后「存到表情包」要用） */
  function localPathOf(src) {
    const s = String(src || '');
    if (!s.startsWith('file:///')) return '';
    try {
      return decodeURIComponent(s.slice('file:///'.length)).replace(/\//g, '\\');
    } catch (_) {
      return '';
    }
  }

  /** 放大看：点背景、按 Esc、点关闭都能退出；收到的那张还能顺手存进表情包 */
  function openLightbox(ctx, opts) {
    const { h, toast, dsh } = ctx;
    const overlay = h('div', { class: 'lightbox' });
    const close = () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onRoute);
      overlay.remove();
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') close();
    };
    // 切到别的页面时顺手关掉，别把放大图留在新页面上
    const onRoute = () => close();
    const bar = h('div', { class: 'lightbox-bar' });
    if (opts.canSave) {
      const saveBtn = h('button', {
        class: 'btn btn-primary btn-sm',
        type: 'button',
        text: '存到表情包',
        onClick: async () => {
          saveBtn.disabled = true;
          try {
            const r = await dsh.stickers.import(opts.file);
            toast(r.existed ? '这张已经在表情包里了' : '存好了，分组：' + (r.emotion || '其它'));
            saveBtn.textContent = '已存好';
          } catch (err) {
            saveBtn.disabled = false;
            toast(String(err.message || err), true);
          }
        },
      });
      bar.appendChild(saveBtn);
    }
    bar.appendChild(h('button', { class: 'btn btn-sm', type: 'button', text: '关闭', onClick: close }));
    overlay.appendChild(h('div', { class: 'lightbox-inner' }, h('img', { class: 'lightbox-img', src: opts.src }), bar));
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onRoute);
    document.body.appendChild(overlay);
  }

  PAGES.inbox = {
    async render(root, ctx) {
      const { h, toast, refresh, dsh } = ctx;
      stopPoll();

      // 消息里的网址切成可点的链接：点了交给系统浏览器，客户端里不开新窗口
      const trimTail = (raw) => {
        let s = raw;
        while (s && '.,;:!?。，；：！？、）)】]」』>"\''.includes(s[s.length - 1])) s = s.slice(0, -1);
        return s;
      };
      const linkify = (text) => {
        const frag = document.createDocumentFragment();
        const src = String(text || '');
        const re = /https?:\/\/[^\s<>"'`{}|\\^\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]+/gi;
        let last = 0;
        let m;
        while ((m = re.exec(src))) {
          const url = trimTail(m[0]);
          if (!url || url === 'http://' || url === 'https://') continue;
          if (m.index > last) frag.appendChild(document.createTextNode(src.slice(last, m.index)));
          const a = h('a', { class: 'msg-link', href: url, text: url, title: '在浏览器里打开：' + url });
          a.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            dsh.openUrl(url).catch((err) => toast(String(err.message || err), true));
          });
          frag.appendChild(a);
          last = m.index + url.length;
        }
        if (last < src.length) frag.appendChild(document.createTextNode(src.slice(last)));
        return frag;
      };

      const [conversations, status, stats] = await Promise.all([
        dsh.inbox.conversations(80),
        dsh.qq.status(),
        dsh.inbox.stats(),
      ]);
      if (!ctx.alive()) return;

      let current = (conversations[0] || {}).id || '';

      // ---------- 顶部 ----------
      const head = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h(
            'div',
            null,
            h('div', { class: 'section-title', text: '所有会话' }),
            h('div', {
              class: 'section-desc',
              text:
                `QQ ${status.status === 'online' ? '在线' : '未连接'}` +
                SP.g3 +
                `${stats.conversations} 个会话 / ${stats.messages} 条消息`,
            }),
          ),
          h(
            'div',
            { class: 'section-tools' },
            h('button', { class: 'btn btn-sm', type: 'button', text: '刷新', onClick: () => refresh() }),
          ),
        ),
      );
      root.appendChild(head);

      if (!conversations.length) {
        head.appendChild(
          h('div', {
            class: 'empty',
            text: status.status === 'online' ? '还没有消息。等有人发来就会出现在这里。' : 'QQ 还没连上。先去「通道」页点连接。',
          }),
        );
        return;
      }

      // ---------- 左右分栏 ----------
      const left = h('div', { class: 'split-left' });
      const thread = h('div', { class: 'thread' });
      const input = h('input', { class: 'input', type: 'text', placeholder: '说点什么…（回车发送）' });
      const sendBtn = h('button', { class: 'btn btn-primary', type: 'button', text: '发送' });
      const emojiBtn = h('button', { class: 'btn', type: 'button', text: '😀', title: '挑一张表情包' });
      const pendingBar = h('div', { class: 'pending-bar' });
      let pendingSticker = null;

      function clearPending() {
        pendingSticker = null;
        pendingBar.textContent = '';
        pendingBar.classList.remove('is-open');
      }

      function setPending(item) {
        pendingSticker = item;
        pendingBar.textContent = '';
        pendingBar.appendChild(h('img', { class: 'pending-img', src: encodeURI(item.url), alt: '' }));
        pendingBar.appendChild(h('span', { class: 'pending-name', text: item.name }));
        pendingBar.appendChild(
          h('button', { class: 'btn btn-mini', type: 'button', text: '×', title: '去掉这张', onClick: clearPending }),
        );
        pendingBar.classList.add('is-open');
      }

      async function openPicker() {
        const chips = h('div', { class: 'chips' });
        const navL = h('button', { class: 'picker-nav left', type: 'button', title: '往左翻', text: '‹' });
        const navR = h('button', { class: 'picker-nav right', type: 'button', title: '往右翻', text: '›' });
        // 滚动时分组栏固定住，但必须自己带底色和分割线，不然图会从缝隙里穿过去
        const head = h('div', { class: 'picker-head' }, chips, navL, navR);

        // 分组太宽一屏放不下：滚轮能横着滚、按住能拖动、两头还有箭头按钮
        function syncNav() {
          const max = chips.scrollWidth - chips.clientWidth;
          head.classList.toggle('can-left', chips.scrollLeft > 4);
          head.classList.toggle('can-right', max > 4 && chips.scrollLeft < max - 4);
        }
        chips.addEventListener('scroll', syncNav);
        chips.addEventListener(
          'wheel',
          (e) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            const max = chips.scrollWidth - chips.clientWidth;
            if (max <= 0) return;
            chips.scrollLeft += e.deltaY;
            e.preventDefault();
          },
          { passive: false },
        );
        // 按住拖
        let dragging = false;
        let dragStart = 0;
        let dragLeft = 0;
        let dragged = false;
        chips.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          dragging = true;
          dragged = false;
          dragStart = e.clientX;
          dragLeft = chips.scrollLeft;
        });
        chips.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          const dx = e.clientX - dragStart;
          if (Math.abs(dx) > 4) {
            dragged = true;
            chips.classList.add('is-dragging');
            chips.scrollLeft = dragLeft - dx;
          }
        });
        window.addEventListener('pointerup', () => {
          dragging = false;
          chips.classList.remove('is-dragging');
        });
        // 拖动结束时别把点击当成"选中分组"
        chips.addEventListener(
          'click',
          (e) => {
            if (dragged) {
              e.stopPropagation();
              e.preventDefault();
              dragged = false;
            }
          },
          true,
        );
        navL.addEventListener('click', () => chips.scrollBy({ left: -260, behavior: 'smooth' }));
        navR.addEventListener('click', () => chips.scrollBy({ left: 260, behavior: 'smooth' }));
        requestAnimationFrame(syncNav);

        const grid = h('div', { class: 'sticker-grid' });
        const wrap = h('div', { class: 'picker-body' }, head, grid);
        const modal = ctx.openModal({ title: '挑一张表情包', desc: '点一下就用。会跟你要发的话一起发出去。', body: wrap });

        const stats = await dsh.stickers.stats();
        const groups = [{ name: '全部', count: stats.total }];
        if (stats.favorites) groups.push({ name: '@fav', count: stats.favorites });
        for (const g of stats.groups || []) groups.push(g);

        let picked = '全部';
        const PAGE = 60;
        let offset = 0;
        let total = 0;
        let loading = false;
        const more = h('div', { class: 'list-more', text: '' });

        function card(item) {
          return h(
            'div',
            {
              class: 'sticker-card',
              title: item.name,
              onClick: () => {
                setPending(item);
                modal.close();
              },
            },
            h('img', { class: 'sticker-thumb', src: encodeURI(item.url), alt: item.name }),
            h('div', { class: 'sticker-name', text: item.emotion || '其它' }),
          );
        }

        async function loadPage(reset) {
          if (loading) return;
          loading = true;
          if (reset) {
            grid.textContent = '';
            offset = 0;
          }
          more.textContent = '正在加载…';
          try {
            const page = await dsh.stickers.list({ emotion: picked, offset, limit: PAGE });
            const items = (page && page.items) || [];
            total = (page && page.total) || 0;
            offset += items.length;
            if (!items.length && offset === 0) {
              grid.appendChild(h('div', { class: 'empty', text: '这个分组里还没有图' }));
            }
            for (const item of items) grid.appendChild(card(item));
            more.textContent = offset < total ? '往下滑还有 ' + (total - offset) + ' 张' : total ? '就这些了（共 ' + total + ' 张）' : '';
          } catch (err) {
            more.textContent = '加载失败：' + String(err.message || err);
          } finally {
            loading = false;
          }
        }

        // 滚到底自动续，同时留一个「加载更多」兜底
        const scroller = modal.body || wrap;
        let modalClosed = false;
        const origClose = modal.close;
        if (origClose) {
          modal.close = function () {
            modalClosed = true;
            return origClose.apply(this, arguments);
          };
        }
        function nearBottom() {
          if (modalClosed) return;
          const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
          if (gap < 220 && offset < total) loadPage(false);
        }
        scroller.addEventListener('scroll', nearBottom, { passive: true });
        more.addEventListener('click', () => {
          if (offset < total) loadPage(false);
        });
        wrap.appendChild(more);

        for (const g of groups) {
          const chip = h('button', {
            class: 'chip' + (g.name === picked ? ' is-active' : ''),
            type: 'button',
            text: g.name === '@fav' ? '★ 收藏 ' + g.count : g.name + ' ' + g.count,
            onClick: () => {
              picked = g.name;
              for (const c of chips.children) c.classList.remove('is-active');
              chip.classList.add('is-active');
              loadPage(true);
            },
          });
          chips.appendChild(chip);
        }
        await loadPage(true);
      }

      const right = h(
        'div',
        { class: 'split-right' },
        h('div', { class: 'split-title', id: 'convTitle', text: '' }),
        thread,
        pendingBar,
        h('div', { class: 'composer' }, emojiBtn, input, sendBtn),
      );

      const split = h('div', { class: 'split' }, left, right);
      root.appendChild(split);

      function renderConversations() {
        left.textContent = '';
        for (const conv of conversations) {
          const isCurrent = conv.id === current;
          left.appendChild(
            h(
              'div',
              {
                class: 'conv' + (isCurrent ? ' is-active' : ''),
                onClick: () => {
                  current = conv.id;
                  renderConversations();
                  loadThread();
                },
              },
              h('div', { class: 'conv-avatar', text: conv.kind === 'group' ? '👥' : '👤' }),
              h(
                'div',
                { class: 'conv-main' },
                h('div', { class: 'conv-title', text: conv.title || conv.id }),
                h('div', { class: 'conv-sub', text: new Date(conv.updatedAt).toLocaleString() }),
              ),
            ),
          );
        }
      }

      async function loadThread() {
        const list = await dsh.inbox.messages(current, 200);
        if (!ctx.alive()) return;
        const conv = conversations.find((c) => c.id === current);
        const titleEl = document.getElementById('convTitle');
        if (titleEl) titleEl.textContent = conv ? conv.title : current;
        thread.textContent = '';
        if (!list.length) {
          thread.appendChild(h('div', { class: 'empty', text: '这个会话还没有消息' }));
          return;
        }
        for (const msg of list) {
          const mine = msg.role !== 'user';
          const bubble = h(
            'div',
            { class: 'bubble' + (mine ? ' is-mine' : '') },
            !mine ? h('div', { class: 'bubble-name', text: msg.senderName || msg.senderId }) : null,
            msg.text ? h('div', { class: 'bubble-text' }, linkify(msg.text)) : null,
          );
          for (const img of msg.images || []) {
            const node = h('img', {
              class: 'bubble-img' + (img.kind === 'sticker' ? ' is-sticker' : ''),
              src: img.src,
              alt: img.summary || '图片',
              title: img.summary || '图片',
              loading: 'lazy',
            });
            // 图片是后加载的：如果刚才已经贴在底部，加载完继续贴着底部
            node.addEventListener('load', () => {
              if (thread.scrollTop + thread.clientHeight >= thread.scrollHeight - 260) {
                thread.scrollTop = thread.scrollHeight;
              }
            });
            // 双击放大；收到的那张（role 为 user）可以存进表情包
            const localFile = localPathOf(img.src);
            node.addEventListener('dblclick', (ev) => {
              ev.preventDefault();
              openLightbox(ctx, {
                src: img.src,
                file: localFile,
                canSave: msg.role === 'user' && !!localFile,
              });
            });
            bubble.appendChild(node);
          }
          bubble.appendChild(h('div', { class: 'bubble-time', text: new Date(msg.createdAt).toLocaleTimeString() }));
          thread.appendChild(h('div', { class: 'bubble-row' + (mine ? ' is-mine' : '') }, bubble));
        }
        thread.scrollTop = thread.scrollHeight;
      }

      async function send() {
        const text = input.value.trim();
        if (!text && !pendingSticker) return;
        sendBtn.disabled = true;
        try {
          await dsh.inbox.send(current, text, pendingSticker ? pendingSticker.file : '');
          input.value = '';
          clearPending();
          await loadThread();
        } catch (err) {
          toast(String(err.message || err), true);
        } finally {
          sendBtn.disabled = false;
        }
      }

      emojiBtn.addEventListener('click', () => openPicker().catch((err) => toast(String(err.message || err), true)));
      sendBtn.addEventListener('click', send);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') send();
      });

      renderConversations();
      await loadThread();
      if (!ctx.alive()) return;

      // 有新消息就自动刷新（光标在输入框里时不抢焦点，只重画面板和列表）
      pollTimer = setInterval(async () => {
        if (!ctx.alive()) {
          stopPoll();
          return;
        }
        try {
          const fresh = await dsh.inbox.conversations(80);
          if (!ctx.alive()) return;
          if (fresh.length !== conversations.length || (fresh[0] && conversations[0] && fresh[0].updatedAt !== conversations[0].updatedAt)) {
            conversations.length = 0;
            conversations.push(...fresh);
            renderConversations();
            await loadThread();
          }
        } catch (_) {
          /* 刷新失败不打扰用户 */
        }
      }, 4000);
    },
  };
})();

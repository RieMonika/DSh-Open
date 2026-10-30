'use strict';

/**
 * 对话：不经过 QQ，直接在客户端里跟她说话
 * ------------------------------------------------------------
 * 用的是同一套脑子（人设 / 记忆 / 关系 / 成长 / 自动记事），
 * 所以没装 NapCat 的时候，也能确认「养鱼」这一整套是活的。
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  function bubble(h, msg) {
    const mine = msg.role === 'user';
    return h(
      'div',
      { class: 'bubble-row' + (mine ? ' is-mine' : '') },
      h(
        'div',
        { class: 'bubble' + (mine ? ' is-mine' : '') },
        !mine ? h('div', { class: 'bubble-name', text: '她' }) : null,
        h('div', { class: 'bubble-text', text: msg.text }),
        h('div', { class: 'bubble-time', text: new Date(msg.createdAt || Date.now()).toLocaleTimeString() }),
      ),
    );
  }

  PAGES.chat = {
    async render(root, ctx) {
      const { h, toast, dsh, refresh } = ctx;
      const list = await dsh.chat.history(80);
      if (!ctx.alive()) return;

      const thread = h('div', { class: 'thread' });
      const scrollBottom = () => {
        thread.scrollTop = thread.scrollHeight;
      };

      const statusLine = h('div', { class: 'row-hint', text: '' });

      const paint = (items) => {
        thread.innerHTML = '';
        if (!items || !items.length) {
          thread.appendChild(
            h('div', { class: 'empty' }, h('div', { class: 'empty-title', text: '还没说过话' }), h('div', { class: 'empty-desc', text: '在下面随便说一句，她会用「模型」页里选的那个人格回你。' })),
          );
          return;
        }
        items.forEach((m) => thread.appendChild(bubble(h, m)));
        scrollBottom();
      };

      const input = h('input', { class: 'input', type: 'text', placeholder: '说点什么…（回车发送）' });
      const sendBtn = h('button', { class: 'btn btn-primary', type: 'button', text: '发送' });

      async function send() {
        const text = (input.value || '').trim();
        if (!text) return;
        input.value = '';
        sendBtn.disabled = true;
        statusLine.textContent = '她在打字…';
        // 先把自己那句顶上屏
        const items = await dsh.chat.history(80);
        paint(items.concat([{ role: 'user', text, createdAt: Date.now() }]));
        try {
          const r = await dsh.chat.say(text);
          if (!ctx.alive()) return;
          statusLine.textContent = r.sticker ? '（她顺手配了张表情：' + (r.sticker.emotion || r.sticker.name || '') + '）' : '';
          paint(await dsh.chat.history(80));
        } catch (err) {
          statusLine.textContent = '出错了：' + (err.message || err);
          toast('没发出去', true);
        } finally {
          sendBtn.disabled = false;
          input.focus();
        }
      }

      sendBtn.addEventListener('click', send);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      });

      const proactiveBtn = h('button', {
        class: 'btn',
        type: 'button',
        text: '让她主动说一句',
        onClick: async () => {
          proactiveBtn.disabled = true;
          statusLine.textContent = '她正在想说什么…';
          try {
            await dsh.chat.proactive('你在客户端里，想跟主人说句话');
            if (!ctx.alive()) return;
            statusLine.textContent = '';
            paint(await dsh.chat.history(80));
          } catch (err) {
            statusLine.textContent = '没说出来：' + (err.message || err);
          } finally {
            proactiveBtn.disabled = false;
          }
        },
      });

      const clearBtn = h('button', {
        class: 'btn',
        type: 'button',
        text: '清空记录',
        onClick: async () => {
          await dsh.chat.clear();
          toast('对话已清空');
          refresh();
        },
      });

      root.appendChild(
        h(
          'section',
          { class: 'section', style: 'display:flex;flex-direction:column;min-height:0;flex:1' },
          h(
            'div',
            { class: 'section-head' },
            h(
              'div',
              null,
              h('div', { class: 'section-title', text: '跟她说话' }),
              h('div', { class: 'section-desc', text: '不经过 QQ。人设、记忆、关系、表情都走同一套 —— 没装 NapCat 也能先聊。' }),
            ),
            h('div', { class: 'section-tools' }, proactiveBtn, clearBtn),
          ),
          thread,
          h('div', { class: 'composer' }, input, sendBtn),
          statusLine,
        ),
      );

      paint(list);
      input.focus();
    },
  };
})();

'use strict';

/**
 * 养成页
 * ------------------------------------------------------------
 * 从「通道」里拆出来的成长与关系：聊得越多，等级和好感越高。
 * 以后这两块还会细化，先把入口单独放一页，通道只管消息往哪儿走。
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  PAGES.growth = {
    async render(root, ctx) {
      const { h, toast, refresh, dsh } = ctx;
      const SP = window.SP || { g2: '  ', g3: '   ' };

      // ================= 成长 =================
      const growthList = await dsh.growth.list(20);
      if (!ctx.alive()) return;

      const growthSection = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h(
            'div',
            null,
            h('div', { class: 'section-title', text: '成长' }),
            h('div', { class: 'section-desc', text: '和名单里的人每聊一句都会涨经验，聊得越多等级越高。' }),
          ),
          h('div', { class: 'section-tools' }, h('span', { class: 'badge', text: growthList.length + ' 人' })),
        ),
      );

      if (!growthList.length) {
        growthSection.appendChild(h('div', { class: 'empty', text: '还没有成长记录。等有人和你聊过，这里会出现等级。' }));
      } else {
        const wrap = h('div', { class: 'list' });
        for (const g of growthList) {
          wrap.appendChild(
            h(
              'div',
              { class: 'list-row' },
              h(
                'div',
                { class: 'list-main' },
                h(
                  'div',
                  { class: 'list-title' },
                  h('strong', { text: g.name || g.userId }),
                  h('span', { class: 'badge badge-ok', text: 'Lv.' + g.level }),
                ),
                h('div', { class: 'list-sub', text: '经验 ' + g.points + SP.g2 + (g.name ? 'QQ ' + g.userId : '还没聊过') }),
              ),
            ),
          );
        }
        growthSection.appendChild(wrap);
      }
      root.appendChild(growthSection);

      // ================= 关系（好感度 + 今天的状态） =================
      const bondList = await dsh.bond.list(20);
      if (!ctx.alive()) return;

      const bondSection = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h(
            'div',
            null,
            h('div', { class: 'section-title', text: '关系' }),
            h('div', { class: 'section-desc', text: '好感度不是等级：它会改变她说话的温度。每天还会换一个心情，她不会每天醒来都是一张白纸。' }),
          ),
          h('div', { class: 'section-tools' }, h('span', { class: 'badge', text: bondList.length + ' 人' })),
        ),
      );

      if (!bondList.length) {
        bondSection.appendChild(h('div', { class: 'empty', text: '还没有关系记录。等你和她聊过几句，这里会出现好感度和当天的心情。' }));
      } else {
        const bw = h('div', { class: 'list' });
        for (const b of bondList) {
          bw.appendChild(
            h(
              'div',
              { class: 'list-row' },
              h(
                'div',
                { class: 'list-main' },
                h(
                  'div',
                  { class: 'list-title' },
                  h('strong', { text: b.name || b.userId }),
                  h('span', { class: 'badge', text: b.channel === 'bili' ? 'B站' : b.channel === 'local' ? '本地' : 'QQ' }),
                  h('span', { class: 'badge badge-ok', text: b.level ? b.level.zh : '陌生' }),
                  h('span', { class: 'badge', text: '好感 ' + b.score + '/100' }),
                ),
                h(
                  'div',
                  {
                    class: 'list-sub',
                    text: (b.mood ? '今天：' + b.mood + (b.wish ? '，' + b.wish : '') : '今天还没状态') + SP.g3 + 'QQ ' + b.userId,
                  },
                ),
              ),
              h(
                'div',
                { class: 'list-ctrl' },
                h('button', {
                  class: 'btn btn-mini',
                  type: 'button',
                  text: '换个心情',
                  onClick: () =>
                    dsh.bond
                      .roll(b.userId)
                      .then((next) => {
                        toast('今天：' + (next.mood || ''));
                        refresh();
                      })
                      .catch((err) => toast(String(err.message || err), true)),
                }),
              ),
            ),
          );
        }
        bondSection.appendChild(bw);
      }
      root.appendChild(bondSection);
    },
  };
})();

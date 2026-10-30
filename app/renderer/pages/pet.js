'use strict';
/** 桌宠页：开关 / 大小 / 透明度 / 置顶 / 贴哪角 / 换形象 */
(function () {
  window.DSHPages = window.DSHPages || {};
  const CORNERS = [
    ['bottom-right', '右下'], ['bottom-left', '左下'],
    ['top-right', '右上'], ['top-left', '左上'],
  ];
  window.DSHPages.pet = {
    async render(el, ctx) {
      const { h, t, toast, dsh } = ctx;
      const [cfg, packs] = await Promise.all([dsh.pet.config(), dsh.pet.packs()]);

      const wrap = h('div', {}, '');
      const sec = h('div', { class: 'section' },
        h('div', { class: 'section-title', text: '窗口设置' }),
        h('div', { class: 'section-note', text: '她用的是原版素材（100 个动作），在自己的透明窗口里跑，和主窗口分开。' })
      );

      const sw = h('label', { class: 'switch' },
        h('input', { type: 'checkbox', checked: !!cfg.enabled }),
        h('span', { class: 'track' })
      );
      sw.querySelector('input').addEventListener('change', async (e) => {
        await dsh.pet.save({ enabled: e.target.checked });
        toast(e.target.checked ? '桌宠已打开' : '桌宠已关闭');
      });
      sec.appendChild(h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'row-title', text: '显示桌宠' }),
          h('div', { class: 'row-sub', text: '关掉后窗口消失，设置会记住。' })),
        h('div', { class: 'row-ctrl' }, sw)
      ));

      const sizeIn = h('input', { class: 'input input-num', type: 'number', min: '160', max: '600', value: String(cfg.size) });
      sizeIn.addEventListener('change', async () => {
        const v = Math.max(160, Math.min(600, Number(sizeIn.value) || 340));
        sizeIn.value = String(v);
        await dsh.pet.save({ enabled: true, size: v });
        toast('大小已保存：' + v);
      });
      sec.appendChild(h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'row-title', text: '大小' }),
          h('div', { class: 'row-sub', text: '160 ~ 600 像素' })),
        h('div', { class: 'row-ctrl' }, sizeIn)
      ));

      const opIn = h('input', { class: 'input input-num', type: 'number', min: '0.2', max: '1', step: '0.05', value: String(cfg.opacity) });
      opIn.addEventListener('change', async () => {
        const v = Math.max(0.2, Math.min(1, Number(opIn.value) || 1));
        opIn.value = String(v);
        await dsh.pet.save({ enabled: true, opacity: v });
        toast('透明度已保存');
      });
      sec.appendChild(h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'row-title', text: '透明度' }),
          h('div', { class: 'row-sub', text: '0.2 ~ 1' })),
        h('div', { class: 'row-ctrl' }, opIn)
      ));

      const top = h('label', { class: 'switch' },
        h('input', { type: 'checkbox', checked: cfg.alwaysOnTop !== false }),
        h('span', { class: 'track' })
      );
      top.querySelector('input').addEventListener('change', async (e) => {
        await dsh.pet.save({ enabled: true, alwaysOnTop: e.target.checked });
        toast(e.target.checked ? '已置顶' : '取消置顶');
      });
      sec.appendChild(h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'row-title', text: '总在最前' }),
          h('div', { class: 'row-sub', text: '关掉后会被别的窗口盖住。' })),
        h('div', { class: 'row-ctrl' }, top)
      ));

      const sel = h('select', { class: 'select' },
        CORNERS.map(([v, n]) => h('option', { value: v, text: n, selected: cfg.corner === v }))
      );
      sel.addEventListener('change', async () => {
        await dsh.pet.save({ enabled: true, corner: sel.value });
        toast('位置已保存');
      });
      sec.appendChild(h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'row-title', text: '贴哪个角' }),
          h('div', { class: 'row-sub', text: '换完立刻挪过去。' })),
        h('div', { class: 'row-ctrl' }, sel)
      ));

      const packSel = h('select', { class: 'select' },
        (packs || []).map((p) => h('option', { value: p.id, text: p.name, selected: (cfg.pack || 'maid') === p.id }))
      );
      packSel.addEventListener('change', async () => {
        await dsh.pet.save({ enabled: true, pack: packSel.value });
        toast('已换形象：' + packSel.value);
      });
      sec.appendChild(h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'row-title', text: '形象' }),
          h('div', { class: 'row-sub', text: '以后换形象只丢一个文件夹到 pet-native\\packs' })),
        h('div', { class: 'row-ctrl' }, packSel)
      ));

      const acts = await dsh.pet.packs().then((l) => (l && l[0] && l[0].count) || 0).catch(() => 0);
      sec.appendChild(h('div', { class: 'section-note', text: '当前形象共有 ' + acts + ' 个动作。拖动窗口可以搬走她。' }));
      wrap.appendChild(sec);
      el.appendChild(wrap);
    },
  };
})();
'use strict';

/** 总览：一个图标 + 一键启动 + 当前状态 + 路线图 */
(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  PAGES.dashboard = {
    render(root, ctx) {
      const { h, t, state, toast } = ctx;
      const info = state.info;
      const badge = (text, kind) => h('span', { class: 'badge badge-' + kind, text });

      // ---------------- hero：图标 + 一键启动 ----------------
      const statusLine = h('div', { class: 'hero-status', text: '正在读取状态…' });
      const stepList = h('div', { class: 'boot-steps' });
      const bootBtn = h('button', {
        class: 'btn btn-primary btn-lg boot-btn',
        type: 'button',
        text: t('dash.boot'),
      });

      let pollTimer = null;
      let qrImg = null;

      let lastState = null;
      // 正在执行「全部关闭」：这段时间按钮显示「正在关闭…」，关完再落回「一键启动」
      let closing = false;

      const renderSteps = (steps, st) => {
        const keep = stepList.scrollTop;
        stepList.textContent = '';
        qrImg = null;
        for (const s of steps || []) {
          stepList.appendChild(
            h(
              'div',
              { class: 'boot-step' + (s.ok ? ' is-ok' : ' is-bad') },
              h('span', { class: 'boot-dot', text: '●' }),
              h('span', { class: 'boot-label', text: s.label }),
              h('span', { class: 'boot-msg', text: s.msg }),
            ),
          );
        }
        const qrSrc = (st && st.qr) || ((steps || []).find((s) => s.qr) || {}).qr || '';
        if (qrSrc) {
          const base = String(qrSrc).split('?')[0];
          qrImg = h('img', { class: 'boot-qr-img', src: qrSrc, alt: 'QQ 登录二维码' });
          stepList.appendChild(
            h(
              'div',
              { class: 'boot-qr' },
              qrImg,
              h('div', { class: 'boot-qr-tip', text: '用手机 QQ 扫这个码登录小号，扫完会自动接着连' }),
            ),
          );
        }
        stepList.scrollTop = keep;
      };

      // 二维码会过期，每 6 秒刷一次图（换个时间戳骗缓存）
      const qrTick = setInterval(() => {
        if (!qrImg) return;
        if (!document.body.contains(qrImg)) {
          clearInterval(qrTick);
          return;
        }
        const base = String(qrImg.src || '').split('?')[0];
        if (base) qrImg.src = base + '?t=' + Date.now();
      }, 6000);

      const applyState = (st) => {
        const bits = [];
        bits.push(st.qq.status === 'online' ? 'QQ ' + (st.qq.selfName || '已连接') : 'QQ 没连');
        bits.push(st.bili.logged ? 'B 站 已登录' : 'B 站 没登录');
        bits.push(st.chat.autoreply ? '自动回复 开' : '自动回复 关');
        bits.push(st.chat.proactive ? '主动聊天 开' : '主动聊天 关');
        statusLine.textContent = SP.join(bits, SP.g3);
        renderSteps(st.steps || [], st);

        bootBtn.classList.remove('is-running', 'is-done', 'is-off', 'is-paused');
        lastState = st;
        if (closing) {
          // 关闭动作进行中：只显示进度，不显示成「已关闭」的死状态
          bootBtn.disabled = true;
          bootBtn.textContent = '正在关闭…';
          bootBtn.classList.add('is-running');
        } else if (st.running) {
          bootBtn.disabled = true;
          bootBtn.textContent = t('dash.booting');
          bootBtn.classList.add('is-running');
        } else if (st.paused) {
          // 已经全关：按钮回到「一键启动」，点一下就重新打开（不要再是黑色的「全部关闭」）
          bootBtn.disabled = false;
          bootBtn.textContent = t('dash.boot');
          bootBtn.classList.add('is-paused');
          statusLine.textContent = '已全部关闭' + SP.g3 + '点一下就能重新打开';
        } else if (st.ok) {
          bootBtn.disabled = false;
          bootBtn.textContent = '全部在线';
          bootBtn.classList.add('is-done');
        } else if ((st.steps || []).length) {
          bootBtn.disabled = false;
          bootBtn.textContent = '重新启动';
        } else {
          bootBtn.disabled = false;
          bootBtn.textContent = t('dash.boot');
        }
        const chanCard = document.querySelector('[data-stat="channels"] .stat-value');
        if (chanCard) {
          const n = (st.qq.status === 'online' ? 1 : 0) + (st.bili.logged ? 1 : 0);
          chanCard.textContent = String(n);
          const sub = document.querySelector('[data-stat="channels"] .stat-note');
          if (sub) sub.textContent = n === 2 ? '已连上：QQ / B 站' : n === 1 ? (st.qq.status === 'online' ? '已连上：QQ' : '已连上：B 站') : '都还没连上';
        }
      };

      const poll = () => {
        if (pollTimer) return;
        pollTimer = setInterval(async () => {
          try {
            const st = await ctx.dsh.boot.status();
            if (!ctx.alive()) {
              clearInterval(pollTimer);
              pollTimer = null;
              return;
            }
            applyState(st);
            if (!st.running) {
              clearInterval(pollTimer);
              pollTimer = null;
              toast(st.ok ? t('dash.bootToastOk') : t('dash.bootToastPartial'));
            }
          } catch (_) {
            /* 忽略一次失败，下次再读 */
          }
        }, 1200);
      };

      bootBtn.addEventListener('click', async () => {
        if (bootBtn.disabled) return;
        // 已经全在线：单击不重启，只提示“双击可以全部关闭”
        if (lastState && lastState.ok && !lastState.running && !lastState.paused) {
          toast('已经是全部在线了；想全关就双击这个按钮');
          return;
        }
        try {
          // 先立刻切到「启动中…」，别让按钮在轮询空档里还显示旧文案
          bootBtn.disabled = true;
          bootBtn.classList.remove('is-done', 'is-off', 'is-paused');
          bootBtn.classList.add('is-running');
          bootBtn.textContent = t('dash.booting');
          statusLine.textContent = '正在启动…';
          await ctx.dsh.boot.start();
          poll();
        } catch (err) {
          toast(t('dash.bootFail') + String(err.message || err));
          try {
            if (ctx.alive()) applyState(await ctx.dsh.boot.status());
          } catch (_) {
            bootBtn.disabled = false;
            bootBtn.classList.remove('is-running');
            bootBtn.textContent = t('dash.boot');
          }
        }
      });

      // 双击「全部在线」→ 问一句要不要全关
      bootBtn.addEventListener('dblclick', async () => {
        if (!lastState || !lastState.ok || lastState.running || closing) return;
        const modal = ctx.openModal({
          title: '全部关闭？',
          desc: '会断开 QQ、停掉主动聊天和 B 站自动私信。软件本身不退出，随时可以再点一次打开。',
          body: h('div', { class: 'section-note', text: '关掉以后，她在 QQ 里就不在线了，也不会主动找你。' }),
          footer: h('div', { class: 'modal-actions' },
            h('button', { class: 'btn btn-ghost', text: '算了', onClick: () => modal.close() }),
            h('button', {
              class: 'btn btn-primary',
              text: '全部关闭',
              onClick: async () => {
                modal.close();
                closing = true;
                bootBtn.disabled = true;
                bootBtn.classList.remove('is-done', 'is-off');
                bootBtn.classList.add('is-running');
                bootBtn.textContent = '正在关闭…';
                statusLine.textContent = '正在关闭…';
                const startedAt = Date.now();
                try {
                  await ctx.dsh.boot.stop();
                  // 断开往往几十毫秒就完了，让「正在关闭…」至少亮一下，别一闪而过
                  const wait = Math.max(0, 700 - (Date.now() - startedAt));
                  if (wait) await new Promise((r) => setTimeout(r, wait));
                  closing = false;
                  const st = await ctx.dsh.boot.status();
                  if (ctx.alive()) applyState(st);
                  toast('已全部关闭；点一下按钮就能重新打开');
                } catch (err) {
                  closing = false;
                  toast(String(err.message || err), true);
                  try {
                    const st = await ctx.dsh.boot.status();
                    if (ctx.alive()) applyState(st);
                  } catch (_) {
                    /* 读不到就保持现状 */
                  }
                }
              },
            }),
          ),
        });
      });

      // ---------------- 首次设置提示（还没认主人的时候） ----------------
      // 只在 channels.qq.ownerQq 为空时出现；填过就不会再来打扰。
      // 这里现读一次设置（state.info 里的是启动快照，别人在「管理员」页填完后它不会变）。
      const firstRunHost = h('div');
      root.appendChild(firstRunHost);
      const paintFirstRun = (setNow) => {
        const ownerQqNow = String((((setNow.channels || {}).qq) || {}).ownerQq || '').trim();
        if (ownerQqNow) return;
        const brainId = String((setNow.model || {}).active || 'ollama');
        const brainName =
          brainId === 'deepseek'
            ? 'DeepSeek 官方'
            : brainId === 'siliconflow'
              ? '硅基流动'
              : brainId === 'custom'
                ? '自定义接口'
                : 'Ollama（本机）';
        const goBtn = (text, page) =>
          h('button', {
            class: 'btn btn-sm btn-primary',
            type: 'button',
            text,
            onClick: () => ctx.navigate(page),
          });
        firstRunHost.appendChild(
          h(
            'section',
            { class: 'section first-run' },
            h(
              'div',
              { class: 'section-head' },
              h('div', null, h('div', { class: 'section-title', text: '先把主人认一下' })),
              h('span', { class: 'badge', text: '还没设置' }),
            ),
            h('div', {
              class: 'section-desc',
              text: '刚从压缩包里解出来的软件不认任何人：没填管理员之前，QQ 里谁说话都当外人处理——有护栏、不能遥控电脑、也不会主动来找你。填一次就好，以后不会再问。',
            }),
            h(
              'div',
              { class: 'first-run-row' },
              h('div', { class: 'row-main' },
                h('div', { class: 'row-label', text: '管理员是谁' }),
                h('div', { class: 'row-hint', text: '管理员 QQ（只对这个人放行）、B 站收信人、进入「管理员」页的密钥，都在这页填。' })),
              h('div', { class: 'row-ctrl' }, goBtn('去填', 'admin')),
            ),
            h(
              'div',
              { class: 'first-run-row' },
              h('div', { class: 'row-main' },
                h('div', { class: 'row-label', text: '用什么脑子说话' }),
                h('div', { class: 'row-hint', text: '现在选的是 ' + brainName + '。本机 Ollama 不要钱，云端准但按量收费，Key 只存这台电脑。' })),
              h('div', { class: 'row-ctrl' }, goBtn('去模型页', 'model')),
            ),
            h('div', {
              class: 'section-note',
              text: '所有信息都只写在这台电脑的 data\\settings.json 和 data\\dsh-open.db 里，不会上传；把整个文件夹发给别人时，记得别带 data 和 cache。',
            }),
          ),
        );
      };
      ctx.dsh.settings
        .get()
        .then((s) => {
          // 用 isConnected 判断「这一版页面还在不在」，比 ctx.alive() 稳：
          // 换页/重画时旧的那份 DOM 会被摘掉，这里自然就跳过
          if (!firstRunHost.isConnected) return;
          paintFirstRun(s || {});
        })
        .catch(() => {});

      root.appendChild(
        h(
          'section',
          { class: 'hero hero-boot' },
          h('img', { class: 'hero-icon', src: '../assets/app-icon.png', alt: '' }),
          h(
            'div',
            { class: 'hero-side' },
            h('div', { class: 'hero-boot-row' }, statusLine, bootBtn),
            stepList,
          ),
        ),
      );

      // 先把当前状态读出来（不发任何启动动作）
      // 注意：这里不能用 ctx.alive() ——导航时本页可能被连着重绘两次，
      // 回来时 alive 已 false，但这块 DOM 还挂着，状态行会永远停在「正在读取状态…」
      const kick = async () => {
        try {
          const st = await ctx.dsh.boot.status();
          if (!statusLine.isConnected) return;
          applyState(st);
          if (st.running) poll();
        } catch (err) {
          if (statusLine.isConnected) statusLine.textContent = '状态读取失败：' + String(err.message || err);
        }
      };
      kick();
      setTimeout(kick, 700);

      // ---------------- 统计 ----------------
      const channels = (info.channels || []).length;
      const plugins = (state.plugins || []).length;

      const stat = (label, value, note, isPath) =>
        h(
          'div',
          { class: 'stat' },
          h('div', { class: 'stat-label', text: label }),
          h('div', { class: 'stat-value' + (isPath ? ' is-path' : ''), text: value, title: isPath ? value : null }),
          h('div', { class: 'stat-note', text: note }),
        );

      // 通道数先用注册表里的，拿到真实连接状态后再改（不然会出现「QQ 在线」却写「还没接」）
      const chanValue = h('div', { class: 'stat-value', text: String(channels) });
      const chanNote = h('div', { class: 'stat-note', text: t('dash.stat.channelsNote') });
      const chanStat = h(
        'div',
        { class: 'stat', 'data-stat': 'channels' },
        h('div', { class: 'stat-label', text: t('dash.stat.channels') }),
        chanValue,
        chanNote,
      );

      root.appendChild(
        h(
          'section',
          { class: 'stats' },
          chanStat,
          stat(t('dash.stat.plugins'), String(plugins), t('dash.stat.pluginsNote')),
          stat(t('dash.stat.data'), info.paths.data, t('dash.stat.dataNote'), true),
          stat(t('dash.stat.db'), info.dbBackend === 'sqlite' ? 'SQLite' : 'JSON', t('dash.stat.dbNote')),
        ),
      );

      ctx.dsh.boot
        .status()
        .then((st) => {
          const live = [];
          if (st.qq.status === 'online') live.push('QQ');
          if (st.bili.logged) live.push('B 站');
          chanValue.textContent = String(Math.max(channels, live.length));
          chanNote.textContent = live.length ? '已连上：' + live.join(' / ') : t('dash.stat.channelsNote');
        })
        .catch(() => {});

      // ---------------- 用量 ----------------
      const mcfg = (info.settings && info.settings.model) || {};
      const mprovider = mcfg.providers && mcfg.providers[mcfg.active];
      const providerName =
        { ollama: 'Ollama 本地', siliconflow: '硅基流动', deepseek: 'DeepSeek 官方', custom: '自定义' }[mcfg.active] ||
        mcfg.active ||
        '未配置';
      const modelName = (mprovider && mprovider.model) || '没选模型';

      const usageHead = h(
        'div',
        { class: 'section-head' },
        h(
          'div',
          null,
          h('div', { class: 'section-title', text: t('usage.title') }),
          h('div', { class: 'section-note', text: modelName + SP.g2 + providerName }),
        ),
      );

      const usageBody = h('div', { class: 'usage-body' }, h('div', { class: 'empty', text: t('usage.loading') }));
      root.appendChild(h('section', { class: 'section usage' }, usageHead, usageBody));

      const drawChart = (days) => {
        const w = 640;
        const hgt = 120;
        const pad = 8;
        const max = Math.max(1, ...days.map((d) => d.total));
        const step = days.length > 1 ? (w - pad * 2) / (days.length - 1) : 0;
        const pts = days.map((d, i) => {
          const x = pad + i * step;
          const y = hgt - pad - (d.total / max) * (hgt - pad * 2);
          return [x, y];
        });
        const line = pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        const area =
          'M ' + pad + ',' + (hgt - pad) + ' L ' + line.split(' ').join(' L ') +
          ' L ' + (pad + (days.length - 1) * step).toFixed(1) + ',' + (hgt - pad) + ' Z';
        const dots = pts
          .map(
            (p, i) =>
              '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) +
              '" r="2.6" class="uc-dot' + (days[i].total ? ' has' : '') + '"/>',
          )
          .join('');
        return (
          '<svg class="usage-svg" viewBox="0 0 ' + w + ' ' + hgt + '" preserveAspectRatio="none">' +
          '<defs><linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="rgba(96,135,255,.55)"/>' +
          '<stop offset="100%" stop-color="rgba(96,135,255,0)"/>' +
          '</linearGradient></defs>' +
          '<path d="' + area + '" fill="url(#ug)"/>' +
          '<polyline points="' + line + '" fill="none" stroke="rgba(120,160,255,.95)" stroke-width="2" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
          dots +
          '</svg>'
        );
      };

      ctx.dsh.usage
        .stats(7)
        .then((u) => {
          usageBody.textContent = '';
          if (!u.hasData) {
            usageBody.appendChild(h('div', { class: 'empty', text: t('usage.empty') }));
            return;
          }
          const tile = (label, value, note) =>
            h(
              'div',
              { class: 'usage-tile' },
              h('div', { class: 'usage-tile-label', text: label }),
              h('div', { class: 'usage-tile-value', text: value }),
              h('div', { class: 'usage-tile-note', text: note || '' }),
            );

          const ctxInfo = u.lastCtx || {};
          usageBody.appendChild(
            h(
              'div',
              { class: 'usage-tiles' },
              tile(t('usage.tokens'), String(u.today.total), t('usage.tokensNote')),
              tile(t('usage.req'), String(u.today.req), u.today.fail ? u.today.fail + ' 次失败' : t('usage.reqNote')),
              tile(t('usage.latency'), u.today.avgMs ? u.today.avgMs + ' ms' : '—', t('usage.latencyNote')),
              tile(
                t('usage.ctx'),
                ctxInfo.msgs ? ctxInfo.msgs + ' 条' : '—',
                ctxInfo.sysChars ? '系统提示 ' + ctxInfo.sysChars + ' 字' : t('usage.ctxNote'),
              ),
            ),
          );

          const chart = h('div', { class: 'usage-chart' });
          chart.innerHTML = drawChart(u.days);
          const axis = h(
            'div',
            { class: 'usage-axis' },
            ...u.days.map((d, i) => h('span', { class: i === u.days.length - 1 ? 'is-last' : '', text: d.label })),
          );
          usageBody.appendChild(h('div', { class: 'usage-graph' }, chart, axis));

          if (u.sample && u.sample.length) {
            usageBody.appendChild(
              h(
                'div',
                { class: 'usage-list' },
                ...u.sample.map((s) =>
                  h(
                    'div',
                    { class: 'usage-row' },
                    h('span', { class: 'usage-time', text: new Date(s.at).toLocaleTimeString('zh-CN', { hour12: false }) }),
                    h('span', { class: 'usage-model', text: (s.provider || '?') + ' / ' + (s.model || '?') }),
                    h('span', { class: 'usage-tok', text: s.prompt + ' → ' + s.completion }),
                    h('span', { class: 'usage-ms' + (s.ok ? '' : ' is-bad'), text: s.ok ? s.ms + ' ms' : '失败' }),
                  ),
                ),
              ),
            );
          }
        })
        .catch((err) => {
          usageBody.textContent = '';
          usageBody.appendChild(h('div', { class: 'empty', text: t('usage.fail') + String(err.message || err) }));
        });

      // ---------------- 视觉 API 用量 ----------------
      const visBody = h('div', { class: 'usage-body' }, h('div', { class: 'empty', text: '读取中…' }));
      root.appendChild(
        h(
          'section',
          { class: 'section usage' },
          h(
            'div',
            { class: 'section-head' },
            h(
              'div',
              null,
              h('div', { class: 'section-title', text: '视觉 API' }),
              h('div', { class: 'section-note', text: '看图那套接口的用量（和聊天分开算）' }),
            ),
          ),
          visBody,
        ),
      );

      const visTile = (label, value, note) => {
        const raw = String(value);
        const long = raw.length > 14;
        // 长 id 在「_」后面给一个零宽断点，换行就不会把词从中间劈开
        const shown = long ? raw.replace(/_/g, '_\u200b') : raw;
        return h(
          'div',
          { class: 'usage-tile' },
          h('div', { class: 'usage-tile-label', text: label }),
          h('div', { class: 'usage-tile-value' + (long ? ' is-long' : ''), text: shown, title: raw }),
          h('div', { class: 'usage-tile-note', text: note || '' }),
        );
      };

      ctx.dsh.vision
        .stats()
        .then((v) => {
          visBody.textContent = '';
          const t = (v && v.today) || { total: 0, req: 0, prompt: 0, completion: 0, fail: 0 };
          visBody.appendChild(
            h(
              'div',
              { class: 'usage-tiles' },
              visTile('今日 Tokens', String(t.total), t.prompt + ' 入 / ' + t.completion + ' 出'),
              visTile('今日请求', String(t.req), t.fail ? t.fail + ' 次失败' : '没有失败'),
              visTile('累计 Tokens', String((v.all && v.all.total) || 0), ((v.all && v.all.req) || 0) + ' 次请求'),
              visTile('当前模型', v.model || '没配', v.configured ? (v.enabled ? '已开启' : '配置了，但关着') : '还没配置'),
            ),
          );
          if (v.last) {
            visBody.appendChild(
              h(
                'div',
                { class: 'usage-list' },
                h(
                  'div',
                  { class: 'usage-row' },
                  h('span', { class: 'usage-time', text: new Date(v.last.at).toLocaleString('zh-CN', { hour12: false }) }),
                  h('span', { class: 'usage-model', text: v.last.model || '?' }),
                  h('span', { class: 'usage-tok', text: (v.last.prompt || 0) + ' → ' + (v.last.completion || 0) }),
                  h('span', { class: 'usage-ms' + (v.last.ok ? '' : ' is-bad'), text: v.last.ok ? (v.last.ms || 0) + ' ms' : '失败' }),
                ),
              ),
            );
          } else {
            visBody.appendChild(h('div', { class: 'empty', text: '还没有调用过。到「通道 → 看图（视觉 API）」配好，点「测一发」就会记在这里。' }));
          }
        })
        .catch((err) => {
          visBody.textContent = '';
          visBody.appendChild(h('div', { class: 'empty', text: '读不到视觉用量：' + String(err.message || err) }));
        });

      // ---------------- 语音 API 用量 ----------------
      const vocBody = h('div', { class: 'usage-body' }, h('div', { class: 'empty', text: '读取中…' }));
      root.appendChild(
        h(
          'section',
          { class: 'section usage' },
          h(
            'div',
            { class: 'section-head' },
            h(
              'div',
              null,
              h('div', { class: 'section-title', text: '语音 API' }),
              h('div', { class: 'section-note', text: '把回复念出来那套接口的用量（按字数算）' }),
            ),
          ),
          vocBody,
        ),
      );

      ctx.dsh.voice
        .stats()
        .then((v) => {
          vocBody.textContent = '';
          const t = (v && v.today) || { req: 0, chars: 0, bytes: 0, fail: 0 };
          vocBody.appendChild(
            h(
              'div',
              { class: 'usage-tiles' },
              visTile('今日字数', String(t.chars), (t.bytes ? Math.round(t.bytes / 1024) + ' KB 音频' : '还没合成')),
              visTile('今日请求', String(t.req), t.fail ? t.fail + ' 次失败' : '没有失败'),
              visTile('累计字数', String((v.all && v.all.chars) || 0), ((v.all && v.all.req) || 0) + ' 次合成'),
              visTile(
                '当前音色',
                v.provider === 'doubao' ? v.voiceType || '豆包（没填音色）' : v.voice || v.model || '没配',
                (v.provider === 'doubao' ? '豆包 · ' : '') +
                  (v.configured ? (v.enabled ? '已开启' : '配置了，但关着') : '还没配置'),
              ),
            ),
          );
          if (v.last) {
            vocBody.appendChild(
              h(
                'div',
                { class: 'usage-list' },
                h(
                  'div',
                  { class: 'usage-row' },
                  h('span', { class: 'usage-time', text: new Date(v.last.at).toLocaleString('zh-CN', { hour12: false }) }),
                  h('span', { class: 'usage-model', text: v.last.model || '?' }),
                  h('span', { class: 'usage-tok', text: (v.last.chars || 0) + ' 字 → ' + Math.round((v.last.bytes || 0) / 1024) + ' KB' }),
                  h('span', { class: 'usage-ms' + (v.last.ok ? '' : ' is-bad'), text: v.last.ok ? (v.last.ms || 0) + ' ms' : '失败' }),
                ),
              ),
            );
          } else {
            vocBody.appendChild(h('div', { class: 'empty', text: '还没有合成过。到「通道 → 说话（语音 API）」配好，点「试听一句」就会记在这儿。' }));
          }
        })
        .catch((err) => {
          vocBody.textContent = '';
          vocBody.appendChild(h('div', { class: 'empty', text: '读不到语音用量：' + String(err.message || err) }));
        });
    },
  };
})();

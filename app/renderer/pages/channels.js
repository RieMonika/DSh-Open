'use strict';

/**
 * 通道：消息从哪来、到哪去
 * ------------------------------------------------------------
 * 现在真正做得动的只有 QQ（OneBot v11）。B 站先占位。
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  const STATUS_TEXT = {
    idle: '未连接',
    connecting: '连接中…',
    online: '在线',
    offline: '已断开',
    error: '连接出错',
  };

  const STATUS_CLASS = {
    idle: '',
    connecting: 'badge-warn',
    online: 'badge-ok',
    offline: 'badge-warn',
    error: 'badge-err',
  };

  PAGES.channels = {
    async render(root, ctx) {
      const { h, t, toast, refresh, dsh } = ctx;

      const [qqStatus, qqConfig] = await Promise.all([dsh.qq.status(), dsh.qq.config()]);
      if (!ctx.alive()) return;

      // ================= 说明 =================
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
              h('div', { class: 'section-title', text: '通道是什么' }),
              h('div', {
                class: 'section-desc',
                text: '一个通道 = 一个平台。QQ 用 OneBot 协议接进来：NapCat 负责跟腾讯服务器讲话，DSh Open 负责跟 NapCat 讲话。',
              }),
            ),
          ),
        ),
      );

      // ================= QQ =================
      const qqSection = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h(
            'div',
            null,
            h('div', { class: 'section-title', text: 'QQ' }),
            h('div', { class: 'section-desc', text: '走 OneBot v11 正向 WebSocket。NapCat 登录好 QQ 之后，这里填地址点连接。' }),
          ),
          h(
            'div',
            { class: 'section-tools' },
            h('span', { class: 'badge ' + (STATUS_CLASS[qqStatus.status] || ''), text: STATUS_TEXT[qqStatus.status] || qqStatus.status }),
          ),
        ),
      );

      // ---- 状态行 ----
      const statusText = qqStatus.status === 'online'
        ? `已连上 ${qqStatus.selfName || ''}${qqStatus.selfId ? '（' + qqStatus.selfId + '）' : ''}`
        : qqStatus.error || '还没连上';

      qqSection.appendChild(
        h(
          'div',
          { class: 'row' },
          h(
            'div',
            { class: 'row-main' },
            h('div', { class: 'row-label', text: statusText }),
            h('div', { class: 'row-hint', text: qqStatus.wsUrl }),
          ),
          h(
            'div',
            { class: 'row-ctrl' },
            qqStatus.status === 'online'
              ? h('button', {
                  class: 'btn btn-danger',
                  type: 'button',
                  text: '断开',
                  onClick: async () => {
                    await dsh.qq.disconnect();
                    toast('已断开');
                    refresh();
                  },
                })
              : h('button', {
                  class: 'btn btn-primary',
                  type: 'button',
                  text: qqStatus.status === 'connecting' ? '连接中…' : '连接',
                  onClick: async () => {
                    try {
                      await dsh.qq.connect();
                      setTimeout(refresh, 600);
                    } catch (err) {
                      toast(String(err.message || err), true);
                    }
                  },
                }),
          ),
        ),
      );

      // ---- 地址 / Token / 自动连接 ----
      const urlInput = h('input', { class: 'input', type: 'text', value: qqConfig.wsUrl, placeholder: 'ws://127.0.0.1:3001' });
      const tokenInput = h('input', {
        class: 'input',
        type: 'password',
        value: '',
        placeholder: qqConfig.hasToken ? '已保存 ' + qqConfig.tokenMasked + '（留空不改）' : '没设就留空',
      });
      const autoSwitch = h(
        'label',
        { class: 'switch' },
        h('input', { type: 'checkbox' }),
        h('span', { class: 'track' }),
      );
      autoSwitch.querySelector('input').checked = qqConfig.autoConnect;

      qqSection.appendChild(
        h(
          'div',
          { class: 'field' },
          h('div', { class: 'field-label', text: 'WebSocket 地址' }),
          urlInput,
          h('div', { class: 'field-hint', text: 'NapCat 里开「正向 WebSocket」，端口保持 3001 就用这个默认值。' }),
        ),
      );
      qqSection.appendChild(
        h('div', { class: 'field' }, h('div', { class: 'field-label', text: 'Access Token' }), tokenInput, h('div', { class: 'field-hint', text: 'NapCat 里设了 Token 才填。' })),
      );
      qqSection.appendChild(
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '启动软件时自动连' }), h('div', { class: 'row-hint', text: '开着的话，开机后就自己去连 NapCat，不用手点。' })),
          h('div', { class: 'row-ctrl' }, autoSwitch),
        ),
      );
      qqSection.appendChild(
        h('div', {
          class: 'section-note',
          text: '管理员的 QQ、B 站 UID 已经搬到侧栏底部的「管理员」页（那页要输密钥才进得去）。这里只留白名单和连接设置。',
        }),
      );
      qqSection.appendChild(
        h(
          'div',
          { class: 'inline-row' },
          h('button', {
            class: 'btn btn-primary',
            type: 'button',
            text: '保存设置',
            onClick: async () => {
              try {
                await dsh.qq.save({ wsUrl: urlInput.value, accessToken: tokenInput.value, autoConnect: autoSwitch.querySelector('input').checked });
                toast('已保存');
                refresh();
              } catch (err) {
                toast(String(err.message || err), true);
              }
            },
          }),
          h('button', {
            class: 'btn',
            type: 'button',
            text: '刷新状态',
            onClick: () => refresh(),
          }),
        ),
      );

      // ---- NapCat：从客户端里直接拉起来 ----
      const napcatLine = h('div', {
        class: 'field-hint',
        text: qqConfig.napcatPath || '还没选。选一次以后就能在这里一键启动。',
      });
      qqSection.appendChild(
        h(
          'div',
          { class: 'field' },
          h('div', { class: 'field-label', text: 'NapCat 启动程序' }),
          napcatLine,
          h(
            'div',
            { class: 'inline-row' },
            h('button', {
              class: 'btn',
              type: 'button',
              text: '选择文件',
              onClick: async () => {
                try {
                  const res = await dsh.qq.pickNapCat();
                  if (!res.canceled) {
                    toast('已记住 NapCat 路径');
                    refresh();
                  }
                } catch (err) {
                  toast(String(err.message || err), true);
                }
              },
            }),
            h('button', {
              class: 'btn',
              type: 'button',
              text: '启动 NapCat',
              onClick: async () => {
                try {
                  await dsh.qq.launchNapCat();
                  toast('已发送启动命令，稍等它自己起来');
                } catch (err) {
                  toast(String(err.message || err), true);
                }
              },
            }),
          ),
          h('div', { class: 'field-hint', text: '一般是 NapCat 目录下的 NapCatWinBootMain.exe（新版）或 napcat.bat。' }),
        ),
      );

      root.appendChild(qqSection);

      // ================= 自动回复 =================
      const ar = await dsh.autoreply.config();
      if (!ctx.alive()) return;

      const arSwitch = h('label', { class: 'switch' }, h('input', { type: 'checkbox' }), h('span', { class: 'track' }));
      arSwitch.querySelector('input').checked = !!ar.enabled;
      const arSticker = h('label', { class: 'switch' }, h('input', { type: 'checkbox' }), h('span', { class: 'track' }));
      arSticker.querySelector('input').checked = !!ar.useSticker;
      const arScope = h(
        'select',
        { class: 'select' },
        h('option', { value: 'private', text: '只回私聊', selected: ar.scope === 'private' }),
        h('option', { value: 'group', text: '只回群聊', selected: ar.scope === 'group' }),
        h('option', { value: 'all', text: '私聊 + 群聊都回', selected: ar.scope === 'all' }),
      );
      const arAtOnly = h('label', { class: 'switch' }, h('input', { type: 'checkbox' }), h('span', { class: 'track' }));
      arAtOnly.querySelector('input').checked = ar.groupAtOnly !== false;
      const arTyping = h('label', { class: 'switch' }, h('input', { type: 'checkbox' }), h('span', { class: 'track' }));
      arTyping.querySelector('input').checked = ar.typingDelay !== false;
      const arChance = h('input', { class: 'input input-emoji', type: 'number', min: '0', max: '1', step: '0.05', value: String(ar.stickerChance) });
      const arLines = h('input', { class: 'input input-emoji', type: 'number', min: '2', max: '30', step: '1', value: String(ar.contextLines) });
      const arGap = h('input', { class: 'input input-emoji', type: 'number', min: '0', max: '600', step: '5', value: String(ar.minGapSec) });
      const arRate = h('input', { class: 'input input-emoji', type: 'number', min: '1', max: '30', step: '1', value: String(ar.maxPerMinute) });
      const arMode = h(
        'select',
        { class: 'select' },
        h('option', { value: 'both', text: '文字 + 表情一起发', selected: ar.stickerMode === 'both' }),
        h('option', { value: 'sticker', text: '只发表情（不说话）', selected: ar.stickerMode === 'sticker' }),
        h('option', { value: 'random', text: '随机：有时只发图', selected: ar.stickerMode === 'random' }),
      );

      function arSave() {
        return dsh.autoreply
          .save({
            enabled: arSwitch.querySelector('input').checked,
            scope: arScope.value,
            groupAtOnly: arAtOnly.querySelector('input').checked,
            typingDelay: arTyping.querySelector('input').checked,
            useSticker: arSticker.querySelector('input').checked,
            stickerMode: arMode.value,
            stickerChance: Number(arChance.value) || 0,
            contextLines: Number(arLines.value) || 8,
            minGapSec: Number(arGap.value) || 0,
            maxPerMinute: Number(arRate.value) || 4,
          })
          .then((next) => {
            toast(next.enabled ? '自动回复已打开' : '自动回复已关闭');
          })
          .catch((err) => toast(String(err.message || err), true));
      }

      // ================= 只和谁互动 =================
      const allowed = (await dsh.qq.allowed()) || [];
      if (!ctx.alive()) return;
      const allowBox = h('textarea', {
        class: 'input textarea',
        rows: '3',
        placeholder: '填 QQ 号，多个用逗号或换行隔开。例：123456, 789012',
        value: allowed.join(', '),
      });
      const allowSection = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h(
            'div',
            null,
            h('div', { class: 'section-title', text: '只和谁互动' }),
            h('div', { class: 'section-desc', text: '名单外的人发消息只记下来，不回复、不主动搭话。名单是空的就谁都不理。' }),
          ),
          h('div', { class: 'section-tools' }, h('span', { class: 'badge' + (allowed.length ? ' badge-ok' : ''), text: allowed.length ? allowed.length + ' 个' : '空的' })),
        ),
        allowBox,
        h(
          'div',
          { class: 'row-actions', style: 'margin-top:12px' },
          h('button', {
            class: 'btn btn-primary',
            type: 'button',
            text: '保存名单',
            onClick: () => {
              const ids = allowBox.value.split(/[,，\s]+/).map((v) => v.trim()).filter(Boolean);
              dsh.qq
                .setAllowed(ids)
                .then((next) => {
                  allowBox.value = (next || []).join(', ');
                  toast((next || []).length ? '名单已保存：' + next.join('、') : '名单清空了，现在谁都不理');
                })
                .catch((err) => toast(String(err.message || err), true));
            },
          }),
        ),
      );
      root.appendChild(allowSection);

      const auto = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h(
            'div',
            null,
            h('div', { class: 'section-title', text: '自动回复' }),
            h('div', { class: 'section-desc', text: '有人发消息，就用「模型」页当前选的人格和接入去回。默认关着。' }),
          ),
          h('div', { class: 'section-tools' }, h('span', { class: 'badge' + (ar.enabled ? ' badge-ok' : ''), text: ar.enabled ? '已开启' : '已关闭' })),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '开关' }), h('div', { class: 'row-hint', text: '打开后，QQ 收到私聊就自动回。模型没配好会回复失败，日志里能看到原因。' })),
          h('div', { class: 'row-ctrl' }, arSwitch),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '回哪些' }), h('div', { class: 'row-hint', text: '群里也回容易刷屏，建议先只回私聊。' })),
          h('div', { class: 'row-ctrl' }, arScope),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '群里只认 @' }), h('div', { class: 'row-hint', text: '打开后，群里只有 @ 她才会接话，别人聊天不理。省得变成刷屏机器。' })),
          h('div', { class: 'row-ctrl' }, arAtOnly),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '回复间隔（秒）' }), h('div', { class: 'row-hint', text: '同一会话最快多久回一条。间隔里的几条消息会攒成一条一起回。' })),
          h('div', { class: 'row-ctrl' }, arGap),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '每分钟上限' }), h('div', { class: 'row-hint', text: '超过就直接不说，不排队、不补发 —— 攒着话回头复读比不说话更吓人。' })),
          h('div', { class: 'row-ctrl' }, arRate),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '打字停顿' }), h('div', { class: 'row-hint', text: '回之前先"打一会儿字"，1~7 秒不等。秒回一看就是机器人。' })),
          h('div', { class: 'row-ctrl' }, arTyping),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '带一张表情' }), h('div', { class: 'row-hint', text: '打开后，按下面的概率随机从表情包里挑一张发出去。' })),
          h('div', { class: 'row-ctrl' }, arSticker, arChance),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '表情怎么发' }), h('div', { class: 'row-hint', text: '只发图 = 她回你一张图，不说话；一起发 = 先说话再配图。' })),
          h('div', { class: 'row-ctrl' }, arMode),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '带几轮上下文' }), h('div', { class: 'row-hint', text: '给模型看最近多少条记录，越大越连贯、越费 token。' })),
          h('div', { class: 'row-ctrl' }, arLines),
        ),
        h(
          'div',
          { class: 'row-actions', style: 'margin-top:12px' },
          h('button', { class: 'btn btn-primary', type: 'button', text: '保存', onClick: arSave }),
        ),
      );
      root.appendChild(auto);

      // ================= 看图（视觉 API） =================
      const vis = (await dsh.vision.config()) || {};
      const vSwitch = h('label', { class: 'switch' }, h('input', { type: 'checkbox' }), h('span', { class: 'track' }));
  vSwitch.querySelector('input').checked = !!vis.enabled;
      const vBase = h('input', {
        class: 'input input-wide',
        placeholder: 'https://api.xxx.com/v1',
        value: vis.baseUrl || '',
        autocomplete: 'off',
      });
      const vModel = h('input', {
        class: 'input input-wide',
        placeholder: '例如 gpt-4o-mini / Qwen/Qwen2.5-VL-72B-Instruct / glm-4v-flash',
        value: vis.model || '',
        autocomplete: 'off',
      });
      const vKey = h('input', {
        class: 'input input-wide',
        type: 'password',
        placeholder: 'sk-…（只存本机）',
        value: vis.apiKey || '',
        autocomplete: 'off',
      });
      const vOut = h('div', { class: 'path-box path-box-multi', text: vis.baseUrl && vis.model ? '已配置：' + vis.model : '还没配置。填好地址、模型、Key，点「测一发」看看通不通。' });

      const visSave = async () => {
        try {
          const next = await dsh.vision.save({
            enabled: vSwitch.querySelector('input').checked,
            baseUrl: vBase.value,
            model: vModel.value,
            apiKey: vKey.value,
          });
          vOut.textContent = next.baseUrl && next.model ? '已保存：' + next.model : '已保存，但地址或模型还空着';
          toast('视觉 API 设置已保存');
        } catch (err) {
          toast(String(err.message || err), true);
        }
      };

      const visTest = async () => {
        if (vOut.dataset.busy) return;
        vOut.dataset.busy = '1';
        vOut.textContent = '正在试……';
        try {
          await dsh.vision.save({
            enabled: vSwitch.querySelector('input').checked,
            baseUrl: vBase.value,
            model: vModel.value,
            apiKey: vKey.value,
          });
          const r = await dsh.vision.test();
          vOut.textContent = r.ok
            ? '通了：模型回答「' + (r.text || '（空）').slice(0, 60) + '」' + SP.g3 + 'tokens ' + (r.prompt + r.completion)
            : '失败：' + (r.error || '未知错误');
        } catch (err) {
          vOut.textContent = '失败：' + String(err.message || err);
        } finally {
          delete vOut.dataset.busy;
        }
      };

      const visSection = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h(
            'div',
            null,
            h('div', { class: 'section-title', text: '看图（视觉 API）' }),
            h('div', { class: 'section-desc', text: '她收到图片时用它「看」图。任何 OpenAI 兼容的看图接口都行，随时换，不锁死一家。' }),
          ),
          h('div', { class: 'section-tools' }, h('span', { class: 'badge' + (vis.enabled && vis.baseUrl && vis.model ? ' badge-ok' : ''), text: vis.enabled && vis.baseUrl && vis.model ? '已配置' : '未配置' })),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-title', text: '允许发图给她看' }), h('div', { class: 'row-desc', text: '关掉就完全不调视觉接口，图片只当"[发来一张图片]"处理。' })),
          h('div', { class: 'row-ctrl' }, vSwitch),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-title', text: '接口地址' }), h('div', { class: 'row-desc', text: '填到 /v1 就行，脚本自己补 /chat/completions。也可以直接填完整的 /chat/completions 地址。' })),
          h('div', { class: 'row-ctrl' }, vBase),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-title', text: '模型名' }), h('div', { class: 'row-desc', text: '必须支持图片输入；文字模型塞图进去会报 400。' })),
          h('div', { class: 'row-ctrl' }, vModel),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-title', text: 'API Key' }), h('div', { class: 'row-desc', text: '只存在本机设置里；换一家就把这三样一起换掉。' })),
          h('div', { class: 'row-ctrl' }, vKey),
        ),
        h(
          'div',
          { class: 'row-actions' },
          h('button', { class: 'btn btn-primary', type: 'button', text: '保存', onClick: visSave }),
          h('button', { class: 'btn', type: 'button', text: '测一发', onClick: visTest }),
        ),
        vOut,
        h('div', { class: 'row-hint', text: '兼容示例：OpenAI、硅基流动、智谱 GLM-4V、通义千问 VL、Moonshot 视觉、本地 LM Studio / Ollama 的 OpenAI 兼容端点。' }),
      );
      root.appendChild(visSection);

      // ================= 说话（语音 API） =================
      // 两家引擎：openai = 任何 OpenAI 兼容的 /audio/speech；doubao = 火山引擎语音合成。
      // 上面先选引擎，下面只显示这家要填的东西；两边的值各存各的，切换回来不用重填。
      const voc = (await dsh.voice.config()) || {};
      const vrow = (title, desc, ctrl, stack) =>
        h(
          'div',
          { class: 'row' + (stack ? ' row-stack' : '') },
          h(
            'div',
            { class: 'row-main' },
            h('div', { class: 'row-title', text: title }),
            h('div', { class: 'row-desc', text: desc }),
          ),
          h('div', { class: 'row-ctrl' }, ctrl),
        );

      const oSwitch = h('label', { class: 'switch' }, h('input', { type: 'checkbox' }), h('span', { class: 'track' }));
      oSwitch.querySelector('input').checked = !!voc.enabled;

      const oProv = h(
        'select',
        { class: 'input', style: 'width: 260px;' },
        ...[
          { v: 'openai', t: 'OpenAI 兼容' },
          { v: 'doubao', t: '豆包（火山引擎）' },
        ].map((x) => h('option', { value: x.v, selected: (voc.provider || 'openai') === x.v, text: x.t })),
      );

      // OpenAI 兼容那套
      const oBase = h('input', {
        class: 'input input-wide',
        placeholder: 'https://api.xxx.com/v1',
        value: voc.rawBaseUrl || voc.baseUrl || '',
        autocomplete: 'off',
      });
      const oModel = h('input', {
        class: 'input input-wide',
        placeholder: '例如 gpt-4o-mini-tts / FunAudioLLM/CosyVoice2-0.5B / fishaudio',
        value: voc.model || '',
        autocomplete: 'off',
      });
      const oVoice = h('input', {
        class: 'input input-wide',
        placeholder: '音色，例如 alloy / nova / alex（看服务方文档）',
        value: voc.voice || '',
        autocomplete: 'off',
      });
      const oKey = h('input', {
        class: 'input input-wide',
        type: 'password',
        placeholder: 'sk-…（只存本机）',
        value: voc.apiKey || '',
        autocomplete: 'off',
      });

      // 豆包（火山引擎）那套
      const oAppid = h('input', {
        class: 'input input-wide',
        placeholder: '豆包 APPID（火山引擎控制台）',
        value: voc.appid || '',
        autocomplete: 'off',
      });
      const oTok = h('input', {
        class: 'input input-wide',
        type: 'password',
        placeholder: '豆包 Access Token',
        value: voc.accessToken || '',
        autocomplete: 'off',
      });
      const oClus = h('input', {
        class: 'input input-wide',
        placeholder: 'Cluster，一般 volcano_tts',
        value: voc.cluster || 'volcano_tts',
        autocomplete: 'off',
      });
      const oVType = h('input', {
        class: 'input input-wide',
        placeholder: 'voice_type，例如 BV700_streaming',
        value: voc.voiceType || '',
        autocomplete: 'off',
      });

      // 两家共用的调参
      const oFormat = h('select', { class: 'input', style: 'width: 140px;' });
      const oChance = h('input', {
        class: 'input input-emoji',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.05,
        value: String(voc.chance ?? 0.15),
      });
      const oMax = h('input', {
        class: 'input input-emoji',
        type: 'number',
        min: 20,
        max: 600,
        step: 10,
        value: String(voc.maxChars ?? 120),
      });

      const vBadge = h('span', { class: 'badge' });
      const oOut = h('div', { class: 'path-box path-box-multi' });
      const vState = h('div', { class: 'row-hint' });
      const engineHint = h('div', { class: 'row-hint' });
      const vocHint = h('div', { class: 'row-hint' });
      const OUT_IDLE = '还没试过。填好后点「试听一句」，通了会直接播放。';

      const isReady = (c) => {
        if (!c || !c.enabled) return false;
        if (c.provider === 'doubao') return !!(c.appid && c.accessToken && c.voiceType);
        return !!(c.baseUrl && c.model);
      };

      function paint(c) {
        const v = c || {};
        const ok = isReady(v);
        vBadge.className = 'badge' + (ok ? ' badge-ok' : '');
        vBadge.textContent = ok ? '已配置' : '未配置';
        if (ok) {
          vState.textContent =
            '已配置：' + (v.provider === 'doubao' ? '豆包 · ' + v.voiceType : v.model) + '（' + (v.enabled ? '发语音开着' : '但「允许发语音」关着') + '）';
        } else {
          vState.textContent =
            v.provider === 'doubao'
              ? '还没配置：缺 APPID / Access Token / voice_type 里的东西。'
              : '还没配置：缺接口地址或模型名。';
        }
      }

      const FORMATS = {
        openai: ['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'],
        doubao: ['mp3', 'wav', 'ogg', 'pcm'],
      };
      function paintFormats(keep) {
        const doubao = oProv.value === 'doubao';
        const list = FORMATS[doubao ? 'doubao' : 'openai'];
        const want = list.includes(keep) ? keep : list[0];
        oFormat.textContent = '';
        list.forEach((f) => oFormat.appendChild(h('option', { value: f, text: f })));
        oFormat.value = want;
      }

      const openaiRows = h(
        'div',
        null,
        vrow('接口地址', '填到 /v1 就行，脚本自己补 /audio/speech。', oBase, true),
        vrow('模型名', 'Text-to-Speech 模型，不是聊天模型。', oModel, true),
        vrow('音色', '服务方定义的音色名；留空就用服务方默认的。', oVoice, true),
        vrow('API Key', '只存在本机设置里，不外发。', oKey, true),
      );
      const doubaoRows = h(
        'div',
        null,
        vrow('豆包 APPID', '火山引擎控制台 → 语音合成 → 应用管理。', oAppid, true),
        vrow('Access Token', '和 APPID 在同一页；只存在本机设置里。', oTok, true),
        vrow('Cluster', '一般就是 volcano_tts，不用改。', oClus, true),
        vrow('音色 voice_type', '例如 BV700_streaming，豆包音色列表里的编号。', oVType, true),
      );

      function sync() {
        const doubao = oProv.value === 'doubao';
        openaiRows.style.display = doubao ? 'none' : '';
        doubaoRows.style.display = doubao ? '' : 'none';
        engineHint.textContent = doubao
          ? '豆包走火山引擎的语音合成接口，要 APPID + Access Token + voice_type 三样。'
          : 'OpenAI 兼容：任何能发 /audio/speech 的服务都能接，地址填到 /v1 即可。';
        vocHint.textContent = doubao
          ? '豆包只认 mp3 / wav / ogg / pcm，别的格式会自动换成 mp3；voice_type 去控制台「音色列表」抄编号。'
          : '常见接法：OpenAI（音色 alloy / nova / shimmer…）、硅基流动 CosyVoice、Fish Audio、本地 GPT-SoVITS 之类。';
        paintFormats(oFormat.value);
      }

      const oSave = async () => {
        const r = await dsh.voice.save({
          enabled: oSwitch.querySelector('input').checked,
          provider: oProv.value,
          baseUrl: oBase.value,
          model: oModel.value,
          voice: oVoice.value,
          apiKey: oKey.value,
          appid: oAppid.value,
          accessToken: oTok.value,
          cluster: oClus.value,
          voiceType: oVType.value,
          format: oFormat.value,
          chance: Number(oChance.value) || 0,
          maxChars: Number(oMax.value) || 120,
        });
        paint(r || {});
        return r;
      };

      const oTry = async () => {
        try {
          await oSave();
          oOut.textContent = '正在合成……';
          const r = await dsh.voice.test();
          if (r && r.ok) {
            const kb = Math.max(1, Math.round((Number(r.bytes) || 0) / 1024));
            oOut.textContent =
              '通了：' + String(r.format || '音频').toUpperCase() + ' · ' + kb + ' KB · ' + (Number(r.ms) || 0) + ' ms' +
              (r.file ? ' · ' + r.file : '');
            if (r.file && dsh && dsh.openPath) dsh.openPath(r.file);
          } else {
            oOut.textContent = '没通：' + ((r && r.error) || '未知原因');
          }
        } catch (err) {
          oOut.textContent = '出错：' + String(err.message || err);
        }
      };

      const vocSection = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h(
            'div',
            null,
            h('div', { class: 'section-title', text: '说话（语音 API）' }),
            h(
              'div',
              { class: 'section-desc', text: '偶尔把回复念出来、以语音发到 QQ。两种引擎二选一：OpenAI 兼容的 /audio/speech，或豆包（火山引擎）语音合成。' },
            ),
          ),
          h('div', { class: 'section-tools' }, vBadge),
        ),
        h(
          'div',
          { class: 'row' },
          h(
            'div',
            { class: 'row-main' },
            h('div', { class: 'row-title', text: '说话引擎' }),
            h('div', { class: 'row-desc', text: '先选引擎，下面只显示这家要填的东西；两边的配置各存各的，换回来不用重填。' }),
            engineHint,
          ),
          h('div', { class: 'row-ctrl' }, oProv),
        ),
        vrow('允许发语音', '关掉就只发文字，语音接口完全不会被调用。', oSwitch),
        openaiRows,
        doubaoRows,
        vrow('音频格式', 'QQ 语音用 mp3 最稳；合成失败会自动退回发文字。', oFormat),
        vrow('回语音的概率', '0 到 1。0.15 大约每六七句里有一次是语音；太长的句子自动改回文字。', oChance),
        vrow('最多念几个字', '超过这个长度就不转语音了（省钱，也免得太长）。', oMax),
        h(
          'div',
          { class: 'row-actions' },
          h('button', {
            class: 'btn btn-primary',
            type: 'button',
            text: '保存',
            onClick: async () => {
              try {
                await oSave();
                toast('语音设置已保存');
              } catch (err) {
                toast(String(err.message || err), true);
              }
            },
          }),
          h('button', { class: 'btn', type: 'button', text: '试听一句', onClick: oTry }),
        ),
        oOut,
        vState,
        vocHint,
      );
      oOut.textContent = OUT_IDLE;
      oProv.addEventListener('change', () => {
        oOut.textContent = OUT_IDLE;
        sync();
      });
      paint(voc);
      sync();
      root.appendChild(vocSection);

      // ================= 主动聊天 =================
      const pro = await dsh.proactive.config();
      if (!ctx.alive()) return;
      const proSwitch = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: pro.enabled }), h('span', { class: 'track' }));
      const proFrom = h('input', { class: 'input input-emoji', type: 'text', value: pro.quietFrom, placeholder: '23:00' });
      const proTo = h('input', { class: 'input input-emoji', type: 'text', value: pro.quietTo, placeholder: '08:00' });

      // ===== 节奏：固定间隔 / 概率曲线 =====
      // 曲线：x = 距上次开口多久（分钟），y = 这一次（每 10 分钟）开口的概率（%）
      const CURVE_MAX_LIMIT = 1439; // 23:59
      const CURVE_DEFAULT = [
        [0, 0], [15, 1], [30, 3], [45, 6], [60, 9], [90, 16], [120, 24],
        [180, 40], [240, 54], [300, 64], [360, 72], [480, 83], [600, 89], [720, 93],
      ];
      let curveMax = Math.max(15, Math.min(CURVE_MAX_LIMIT, Number(pro.curveMaxMinutes) || 720));
      let curvePoints = ((pro.curvePoints && pro.curvePoints.length ? pro.curvePoints : CURVE_DEFAULT))
        .map((p) => [Number(p[0]) || 0, Number(p[1]) || 0])
        .sort((a, b) => a[0] - b[0]);

      const proMode = h(
        'select',
        { class: 'input input-emoji' },
        h('option', { value: 'fixed', selected: pro.mode !== 'curve', text: '固定间隔' }),
        h('option', { value: 'curve', selected: pro.mode === 'curve', text: '概率曲线' }),
      );
      const proEvery = h('input', { class: 'input input-emoji', type: 'number', min: '15', max: '720', step: '15', value: String(pro.everyMinutes) });
      const everyRow = h(
        'div',
        { class: 'row' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '隔多久' }), h('div', { class: 'row-hint', text: '单位是分钟。太短会烦人，建议 60 以上。' })),
        h('div', { class: 'row-ctrl' }, proEvery),
      );

      const curveMaxInput = h('input', { class: 'input input-emoji', type: 'number', min: '15', max: String(CURVE_MAX_LIMIT), step: '15', value: String(curveMax) });
      const curveMaxHint = h('span', { class: 'text-dim' });
      const curveCanvas = h('canvas', { class: 'curve-canvas' });
      const curveNote = h('div', { class: 'curve-tip' });

      const W = 680;
      const H = 250;
      const PAD = { l: 46, r: 16, t: 16, b: 30 };

      const fmtDuration = (m) => {
        const v = Math.max(0, Math.round(Number(m) || 0));
        const hh = Math.floor(v / 60);
        const mm = v % 60;
        if (!hh) return mm + ' 分钟';
        return mm ? hh + ' 小时 ' + mm + ' 分' : hh + ' 小时';
      };
      const fmtAxis = (m) => {
        const v = Math.round(Number(m) || 0);
        const hh = Math.floor(v / 60);
        const mm = v % 60;
        if (!hh) return mm + 'm';
        return mm ? hh + ':' + String(mm).padStart(2, '0') : hh + 'h';
      };

      const plotX = (t) => PAD.l + (Math.max(0, Math.min(curveMax, t)) / curveMax) * (W - PAD.l - PAD.r);
      const plotY = (p) => H - PAD.b - (Math.max(0, Math.min(100, p)) / 100) * (H - PAD.t - PAD.b);
      const unplotX = (x) => Math.max(0, Math.min(curveMax, ((x - PAD.l) / (W - PAD.l - PAD.r)) * curveMax));
      const unplotY = (y) => Math.max(0, Math.min(100, ((H - PAD.b - y) / (H - PAD.t - PAD.b)) * 100));

      const curveAt = (t) => {
        if (t <= curvePoints[0][0]) return curvePoints[0][1];
        for (let i = 1; i < curvePoints.length; i += 1) {
          const [x1, y1] = curvePoints[i];
          if (t <= x1) {
            const [x0, y0] = curvePoints[i - 1];
            return x1 === x0 ? y1 : y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
          }
        }
        return curvePoints[curvePoints.length - 1][1];
      };

      // 粗略估一下她大概多久会开口：每 10 分钟掷一次，算生存曲线掉到 50% 的时间
      const curveEta = () => {
        let surv = 1;
        for (let t = 10; t <= curveMax; t += 10) {
          surv *= 1 - Math.min(1, curveAt(t) / 100);
          if (surv <= 0.5) return t;
        }
        return curveMax;
      };

      function drawCurve(highlight) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        curveCanvas.width = Math.round(W * dpr);
        curveCanvas.height = Math.round(H * dpr);
        curveCanvas.style.width = '100%';
        curveCanvas.style.maxWidth = W + 'px';
        const g = curveCanvas.getContext('2d');
        if (!g) return;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        const ink = 'rgba(255,255,255,.42)';
        const inkSoft = 'rgba(255,255,255,.1)';
        g.font = '11px system-ui, sans-serif';
        g.strokeStyle = inkSoft;
        g.lineWidth = 1;
        for (const p of [0, 25, 50, 75, 100]) {
          const y = plotY(p);
          g.beginPath();
          g.moveTo(PAD.l, y);
          g.lineTo(W - PAD.r, y);
          g.stroke();
          g.fillStyle = ink;
          g.textAlign = 'right';
          g.textBaseline = 'middle';
          g.fillText(p + '%', PAD.l - 8, y);
        }
        for (let i = 0; i <= 4; i += 1) {
          const t = (curveMax * i) / 4;
          const x = plotX(t);
          g.beginPath();
          g.moveTo(x, PAD.t);
          g.lineTo(x, H - PAD.b);
          g.stroke();
          g.fillStyle = ink;
          g.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
          g.textBaseline = 'top';
          g.fillText(fmtAxis(t), x, H - PAD.b + 6);
        }
        const grad = g.createLinearGradient(0, PAD.t, 0, H - PAD.b);
        grad.addColorStop(0, 'rgba(120,170,255,.5)');
        grad.addColorStop(1, 'rgba(120,170,255,.03)');
        g.beginPath();
        g.moveTo(plotX(curvePoints[0][0]), H - PAD.b);
        for (const [t, p] of curvePoints) g.lineTo(plotX(t), plotY(p));
        g.lineTo(plotX(curvePoints[curvePoints.length - 1][0]), H - PAD.b);
        g.closePath();
        g.fillStyle = grad;
        g.fill();

        g.beginPath();
        curvePoints.forEach(([t, p], i) => {
          const x = plotX(t);
          const y = plotY(p);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.strokeStyle = 'rgba(140,180,255,.95)';
        g.lineWidth = 2;
        g.stroke();

        curvePoints.forEach(([t, p], i) => {
          g.beginPath();
          g.arc(plotX(t), plotY(p), highlight === i ? 6.5 : 4.5, 0, Math.PI * 2);
          g.fillStyle = highlight === i ? '#9fc0ff' : '#17233a';
          g.fill();
          g.strokeStyle = 'rgba(150,190,255,.95)';
          g.lineWidth = 1.6;
          g.stroke();
        });
      }

      function refreshCurveText() {
        curveMaxHint.textContent = '（最多 23:59 = 1439）';
        curveNote.textContent =
          '每 10 分钟掷一次骰子。按现在这条曲线，一般 ' + fmtDuration(curveEta()) + ' 前后会开口；到 ' +
          fmtDuration(curveMax) + ' 一定会说。双击空白加点，双击点删点，圆点可以直接拖。';
        drawCurve();
      }

      let dragIndex = -1;
      const canvasPos = (ev) => {
        const rect = curveCanvas.getBoundingClientRect();
        return { x: ((ev.clientX - rect.left) / rect.width) * W, y: ((ev.clientY - rect.top) / rect.height) * H };
      };
      const hitPoint = (x, y) => {
        let best = -1;
        let bestD = 12;
        curvePoints.forEach(([t, p], i) => {
          const d = Math.hypot(plotX(t) - x, plotY(p) - y);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        return best;
      };

      curveCanvas.addEventListener('pointerdown', (ev) => {
        const { x, y } = canvasPos(ev);
        const i = hitPoint(x, y);
        if (i < 0) return;
        dragIndex = i;
        try {
          curveCanvas.setPointerCapture(ev.pointerId);
        } catch (_) {}
        drawCurve(i);
      });
      curveCanvas.addEventListener('pointermove', (ev) => {
        if (dragIndex < 0) return;
        const { x, y } = canvasPos(ev);
        const i = dragIndex;
        const first = i === 0;
        const last = i === curvePoints.length - 1;
        let t = unplotX(x);
        if (first) t = 0;
        else if (last) t = curveMax;
        else t = Math.max(curvePoints[i - 1][0] + 10, Math.min(curvePoints[i + 1][0] - 10, t));
        let p = unplotY(y);
        if (i > 0) p = Math.max(curvePoints[i - 1][1], p);
        if (i < curvePoints.length - 1) p = Math.min(curvePoints[i + 1][1], p);
        curvePoints[i] = [Math.round(t), Math.round(p)];
        refreshCurveText();
        drawCurve(i);
      });
      const endDrag = () => {
        if (dragIndex < 0) return;
        dragIndex = -1;
        drawCurve();
      };
      curveCanvas.addEventListener('pointerup', endDrag);
      curveCanvas.addEventListener('pointercancel', endDrag);

      curveCanvas.addEventListener('dblclick', (ev) => {
        const { x, y } = canvasPos(ev);
        const i = hitPoint(x, y);
        if (i >= 0) {
          if (curvePoints.length <= 2) return toast('至少留两个点', true);
          if (i === 0 || i === curvePoints.length - 1) return toast('两端的点不能删', true);
          curvePoints.splice(i, 1);
        } else {
          const t = Math.round(unplotX(x));
          if (t <= 0 || t >= curveMax) return;
          if (curvePoints.some((p) => Math.abs(p[0] - t) < 8)) return;
          curvePoints.push([t, Math.round(curveAt(t))]);
          curvePoints.sort((a, b) => a[0] - b[0]);
        }
        refreshCurveText();
      });

      curveMaxInput.addEventListener('change', () => {
        const next = Math.max(15, Math.min(CURVE_MAX_LIMIT, Number(curveMaxInput.value) || 720));
        curveMaxInput.value = String(next);
        curveMax = next;
        curvePoints = curvePoints
          .map(([t, p]) => [Math.min(t, curveMax), p])
          .filter((p, i, arr) => i === 0 || p[0] > arr[i - 1][0]);
        if (curvePoints.length < 2) curvePoints = CURVE_DEFAULT.map((p) => [Math.min(p[0], curveMax), p[1]]);
        curvePoints[curvePoints.length - 1][0] = curveMax;
        refreshCurveText();
      });

      const curveRow = h(
        'div',
        { class: 'row row-block', style: pro.mode === 'curve' ? '' : 'display:none' },
        h(
          'div',
          { class: 'row-main' },
          h('div', { class: 'row-label', text: '概率曲线' }),
          h('div', { class: 'row-hint', text: '横轴是「距上次开口多久」，纵轴是这一次开口的概率。越往右越可能开口，走到最右必说。' }),
        ),
        h(
          'div',
          { class: 'row-ctrl row-ctrl-block' },
          h(
            'div',
            { class: 'curve-head' },
            h('span', { class: 'text-dim', text: '最长间隔（分钟）' }),
            curveMaxInput,
            curveMaxHint,
            h('button', {
              class: 'btn btn-ghost btn-mini',
              type: 'button',
              text: '恢复默认曲线',
              onClick: () => {
                curvePoints = CURVE_DEFAULT.map((p) => [p[0], p[1]]);
                curveMax = 720;
                curveMaxInput.value = '720';
                refreshCurveText();
              },
            }),
          ),
          h('div', { class: 'curve-box' }, curveCanvas, curveNote),
        ),
      );

      const syncMode = () => {
        const isCurve = proMode.value === 'curve';
        everyRow.style.display = isCurve ? 'none' : '';
        curveRow.style.display = isCurve ? '' : 'none';
        if (isCurve) refreshCurveText();
      };
      proMode.addEventListener('change', syncMode);

      // 保存时以输入框里的值为准（用户可能改完上限直接点保存，没先失焦）
      const collectProactive = () => {
        const maxNow = Math.max(15, Math.min(CURVE_MAX_LIMIT, Number(curveMaxInput.value) || curveMax));
        const pts = curvePoints
          .map(([t, p]) => [Math.min(Math.round(t), maxNow), Math.round(p)])
          .filter((p, i, arr) => i === 0 || p[0] > arr[i - 1][0]);
        if (pts.length < 2) pts.push([Math.min(30, maxNow), 5]);
        pts[pts.length - 1][0] = maxNow;
        return {
          enabled: proSwitch.querySelector('input').checked,
          mode: proMode.value === 'curve' ? 'curve' : 'fixed',
          everyMinutes: Number(proEvery.value) || 90,
          curveMaxMinutes: maxNow,
          curvePoints: pts,
          quietFrom: proFrom.value || '23:00',
          quietTo: proTo.value || '08:00',
        };
      };

      const proSection = h(
        'section',
        { class: 'section' },
        h(
          'div',
          { class: 'section-head' },
          h(
            'div',
            null,
            h('div', { class: 'section-title', text: '主动聊天' }),
            h('div', { class: 'section-desc', text: '到点了就自己找你说句话。QQ 私聊和 B 站私信推荐共用这一套节奏和免打扰。' }),
          ),
          h('div', { class: 'section-tools' }, h('span', { class: 'badge' + (pro.enabled ? ' badge-ok' : ''), text: pro.enabled ? '已开启' : '已关闭' })),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '开关' }), h('div', { class: 'row-hint', text: '打开后，按下面的节奏主动发一句。' })),
          h('div', { class: 'row-ctrl' }, proSwitch),
        ),
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '节奏' }), h('div', { class: 'row-hint', text: '固定间隔 = 到点就发；概率曲线 = 隔得越久越可能发。QQ 和 B 站各按自己的「距上次开口」算。' })),
          h('div', { class: 'row-ctrl' }, proMode),
        ),
        everyRow,
        curveRow,
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '免打扰时段' }), h('div', { class: 'row-hint', text: '这段时间一句都不发。跨零点也认（比如 23:00 到 08:00）。' })),
          h('div', { class: 'row-ctrl' }, proFrom, h('span', { class: 'text-dim', text: ' 到 ' }), proTo),
        ),
        h(
          'div',
          { class: 'row-actions', style: 'margin-top:12px' },
          h('button', {
            class: 'btn btn-primary',
            type: 'button',
            text: '保存',
            onClick: () =>
              dsh.proactive
                .save(collectProactive())
                .then((next) => {
                  toast(next.enabled ? '主动聊天已打开' : '主动聊天已关闭');
                  refresh();
                })
                .catch((err) => toast(String(err.message || err), true)),
          }),
          h('button', {
            class: 'btn',
            type: 'button',
            text: '现在试一条',
            onClick: () => {
              const first = ((allowBox.value || '').split(/[,，\s]+/).filter(Boolean) || [])[0];
              if (!first) return toast('先在「只和谁互动」里填一个 QQ 号', true);
              toast('正在想说什么…');
              dsh.proactive
                .sendNow(first)
                .then((r) => toast(r && r.ok ? '发了：「' + r.text.slice(0, 30) + '…」' : '没发出去：' + ((r && r.error) || '未知原因'), !(r && r.ok)))
                .catch((err) => toast(String(err.message || err), true));
            },
          }),
        ),
      );
      refreshCurveText();
      syncMode();
      root.appendChild(proSection);

      // ================= B 站 · 收到的私信 =================
      const mailBox = h('div', { class: 'section' });
      const mailList = h('div', { class: 'list' }, h('div', { class: 'row-hint', text: '点右边「收一下」拉取最近私信。' }));
      mailBox.appendChild(h('div', { class: 'section-title', text: 'B 站 · 收到的私信' }));
      mailBox.appendChild(h('div', { class: 'section-note', text: '读的是她这个小号的私信。别人回了她，她终于能看见了。' }));
      mailBox.appendChild(h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title', text: '未读会话' }), h('div', { class: 'row-hint', text: '只列「最后一句是对方说的」，也就是真的在等回的人。' })), h('div', { class: 'row-ctrl' }, h('button', { class: 'btn btn-primary', text: '收一下', onClick: async () => {
        const arr = await dsh.biliInbox();
        mailList.innerHTML = '';
        if (!arr.length) { mailList.appendChild(h('div', { class: 'row-hint', text: '没有在等回复的人。' })); return; }
        for (const s of arr) { mailList.appendChild(h('div', { class: 'list-row' }, h('div', { class: 'list-main' }, h('div', { class: 'list-title', text: s.name || s.talkerId }), h('div', { class: 'list-sub', text: s.last.text })))); }
      } }))));
      mailBox.appendChild(mailList);
      root.appendChild(mailBox);
      // ================= 群聊分寸感 =================
      const gcfg = await dsh.group.config();
      const gInput = h('input', { class: 'input', type: 'text', value: (gcfg.allowedGroups || []).join(','), placeholder: '群号，逗号分开；留空 = 所有群' });
      const gCool = h('input', { class: 'input', type: 'number', value: String(gcfg.cooldownSec) });
      const gRate = h('input', { class: 'input', type: 'number', value: String(gcfg.maxPerMinute) });
      const gChance = h('input', { class: 'input', type: 'number', step: '0.05', value: String(gcfg.jumpChance) });
      const gAt = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: gcfg.atOnly }), h('span', { class: 'track' }));
      const gOn = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: gcfg.enabled }), h('span', { class: 'track' }));
      const gStatus = h('div', { class: 'row-hint', text: gcfg.enabled ? (gcfg.atOnly ? '现在只接 @ 她的消息' : '现在会挑话题接话') : '现在是关着的' });

      async function gSave() {
        const next = await dsh.group.save({
          enabled: gOn.querySelector('input').checked,
          atOnly: gAt.querySelector('input').checked,
          allowedGroups: gInput.value.split(/[,，\s]+/).filter(Boolean),
          cooldownSec: Number(gCool.value) || 90,
          maxPerMinute: Number(gRate.value) || 3,
          jumpChance: Math.max(0, Math.min(1, Number(gChance.value) || 0.35)),
        });
        gStatus.textContent = next.enabled ? (next.atOnly ? '现在只接 @ 她的消息' : '现在会挑话题接话') : '现在是关着的';
        toast('群聊设置已保存');
      }

      const groupSection = h(
        'div',
        { class: 'section' },
        h('div', { class: 'section-title', text: '群聊分寸感' }),
        h('div', { class: 'section-note', text: '群里不是每句都该接。开着「只认 @」最安全；关掉之后她会看话题和冷场程度决定要不要插一句，也会自我限速。' }),
        h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title', text: '开启群聊' }), h('div', { class: 'row-hint', text: '关着的话，群里 @ 她也不回。' })), h('div', { class: 'row-ctrl' }, gOn)),
        h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title', text: '只认 @' }), h('div', { class: 'row-hint', text: '最保守：只有点名或 @ 才接。' })), h('div', { class: 'row-ctrl' }, gAt)),
        h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title', text: '只在这些群' }), h('div', { class: 'row-hint', text: '填群号，逗号分开；留空就不限制。' })), h('div', { class: 'row-ctrl is-field' }, gInput)),
        h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title', text: '插话冷却（秒）' }), h('div', { class: 'row-hint', text: '说完一句，至少隔多久才会再开口。' })), h('div', { class: 'row-ctrl' }, gCool)),
        h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title', text: '每分钟最多' }), h('div', { class: 'row-hint', text: '超过就闭嘴，不排队。' })), h('div', { class: 'row-ctrl' }, gRate)),
        h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title', text: '插话概率' }), h('div', { class: 'row-hint', text: '0~1。0.35 = 大概三成闲聊会接一句。' })), h('div', { class: 'row-ctrl' }, gChance)),
        h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title', text: '当前' }), gStatus), h('div', { class: 'row-ctrl' }, h('button', { class: 'btn btn-primary', text: '保存', onClick: gSave }))),
      );
      root.appendChild(groupSection);
      // ================= B 站 · 账号 =================
      const biliStatus = await dsh.bili.status();
      const biliLifeInfo = await dsh.bili.life();
      if (!ctx.alive()) return;

      const biliBadge = h('span', {
        class: 'badge' + (biliStatus.hasCookie ? ' badge-ok' : ''),
        text: biliStatus.hasCookie ? '已登录' : '未登录',
      });
      // 她自己（登录的小号）
      const selfLine = h('div', {
        class: 'row-value',
        text: biliStatus.selfName ? biliStatus.selfName + '　UID ' + (biliStatus.selfUid || '—') : '还没登录（扫码或填 Cookie 后点「体检」）',
      });
      // 管理员（主人）
      const biliSess = h('input', { class: 'input', type: 'password', value: '', placeholder: 'SESSDATA 的值（浏览器 F12 → Application → Cookies 里找）' });
      const biliJct = h('input', { class: 'input', type: 'password', value: '', placeholder: 'bili_jct 的值（同一个地方，名字就叫 bili_jct）' });
      const biliBuvid = h('input', { class: 'input', type: 'password', value: '', placeholder: 'buvid3（可选，有就填，能少被风控）' });
      const biliOut = h('div', { class: 'path-box path-box-multi', text: biliStatus.hasCookie ? '点「体检」看看现在能不能发。' : '还没登录。点「扫码登录」最快，或者把 SESSDATA / bili_jct 粘进来。' });

      const biliLoginRow = h('div', { class: 'row-main' },
        h('div', { class: 'row-label', text: '登录状态' }),
        h('div', { class: 'row-hint', text: '这里登录的是「她」的小号；收信的「你」在「管理员」页里填 —— 两个不是同一个号。' }));

      async function runBiliCheck() {
        biliOut.textContent = '正在体检…';
        try {
          const r = await dsh.bili.check();
          if (!ctx.alive()) return;
          if (!r.logged) {
            biliBadge.className = 'badge badge-err';
            biliBadge.textContent = '未登录';
            biliOut.textContent = r.error || '没登录成功';
            return;
          }
          biliBadge.className = 'badge' + (r.canSend ? ' badge-ok' : ' badge-warn');
          biliBadge.textContent = r.canSend ? '可以发私信' : '登录了，但发不了';
          if (r.self) {
            selfLine.textContent = (r.self.name || '（没拿到名字）') + '　UID ' + (r.self.uid || '—');
          }
          const lines = [
            '登录的是她：' + (r.me.uname || '') + '（UID ' + r.me.mid + '）',
            '管理员（收信人）：' + (r.owner || '还没填') + (biliStatus.ownerName ? '（' + biliStatus.ownerName + '）' : ''),
            '互关：' + (r.mutual ? '是' : '否'),
            r.error ? '问题：' + r.error : '一切正常，可以发。',
          ];
          biliOut.textContent = lines.join('\n');
        } catch (err) {
          biliOut.textContent = '体检失败：' + (err.message || err);
        }
      }

      const saveBili = () => {
        const patch = {};
        if (biliSess.value.trim()) patch.sessdata = biliSess.value.trim();
        if (biliJct.value.trim()) patch.biliJct = biliJct.value.trim();
        if (biliBuvid.value.trim()) patch.buvid3 = biliBuvid.value.trim();
        return dsh.bili.save(patch).then((s) => {
          biliSess.value = '';
          biliJct.value = '';
          biliBuvid.value = '';
          biliBadge.className = 'badge' + (s.hasCookie ? ' badge-ok' : '');
          biliBadge.textContent = s.hasCookie ? '已登录' : '未登录';
          return s;
        });
      };

      // ---- 扫码登录 ----
      let qrModal = null;
      function openQrLogin() {
        if (qrModal) return;
        const img = h('img', { class: 'qr-img', alt: 'B 站登录二维码' });
        const tip = h('div', { class: 'qr-tip', text: '正在生成二维码…' });
        const regen = h('button', { class: 'btn', type: 'button', text: '重新生成' });
        const box = h('div', { class: 'qr-box' }, img, tip, h('div', { class: 'row-actions', style: 'justify-content:center;margin-top:14px' }, regen));
        const modal = ctx.openModal({
          title: 'B 站扫码登录',
          desc: '用手机 B 站 App 扫码。注意别扫成主人号 —— 登进来的是给她用的小号。',
          body: box,
        });

        let timer = null;
        let stopped = false;
        function stop() { stopped = true; if (timer) { clearInterval(timer); timer = null; } }

        async function start() {
          stop();
          stopped = false;
          tip.textContent = '正在生成二维码…';
          img.removeAttribute('src');
          try {
            const r = await dsh.bili.loginStart();
            img.src = r.qr;
            tip.textContent = '把手机对准二维码扫一下';
          } catch (err) {
            tip.textContent = '生成失败：' + String(err.message || err);
            return;
          }
          timer = setInterval(async () => {
            if (stopped) return;
            try {
              const p = await dsh.bili.loginPoll();
              if (p.status === 'done') {
                stop();
                tip.textContent = '登录成功' + (p.account && p.account.name ? '：' + p.account.name : '');
                toast('B 站登录成功');
                setTimeout(() => { modal.close(); ctx.refresh(); }, 900);
              } else if (p.status === 'expired') {
                stop();
                tip.textContent = '二维码过期了，点「重新生成」';
              } else {
                tip.textContent = p.message || '等扫码…';
              }
            } catch (err) {
              stop();
              tip.textContent = '轮询出错：' + String(err.message || err);
            }
          }, 1500);
        }

        regen.addEventListener('click', () => start());
        const rawClose = modal.close;
        modal.close = () => { stop(); qrModal = null; try { dsh.bili.loginCancel(); } catch (_) {} rawClose(); };
        qrModal = modal;
        start();
        return modal;
      }

      root.appendChild(
        h('section', { class: 'section' },
          h('div', { class: 'section-head' },
            h('div', null,
              h('div', { class: 'section-title', text: 'B 站' + SP.g2 + '账号' }),
              h('div', { class: 'section-desc', text: '这里登录的是「她」的小号（她用这个号发信）；收信的「你」在侧栏底部的「管理员」页里填。两个不是同一个号。' })),
            h('div', { class: 'section-tools' }, biliBadge)),
          h('div', { class: 'row' }, biliLoginRow,
            h('div', { class: 'row-ctrl' },
              h('button', { class: 'btn', type: 'button', text: '体检', onClick: () => { saveBili().then(runBiliCheck).catch((e) => toast(String(e.message || e), true)); } }))),
          h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '她（登录的小号）' }), h('div', { class: 'row-hint', text: '就是上面登录进来的那个号，自动识别，不用填。' })),
            h('div', { class: 'row-ctrl is-field' }, selfLine)),
          h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: 'SESSDATA' }), h('div', { class: 'row-hint', text: '留空 = 不改，只更新前面几项。' })),
            h('div', { class: 'row-ctrl is-field' }, biliSess)),
          h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: 'bili_jct' }), h('div', { class: 'row-hint', text: '发私信要它做 csrf 校验。' })),
            h('div', { class: 'row-ctrl is-field' }, biliJct)),
          h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: 'buvid3' }), h('div', { class: 'row-hint', text: '可选。填了更像正常浏览器。' })),
            h('div', { class: 'row-ctrl is-field' }, biliBuvid)),
          h('div', { class: 'row-actions' },
            h('button', {
              class: 'btn btn-primary', type: 'button', text: '保存',
              onClick: () => saveBili().then(() => toast('B 站账号已保存')).catch((e) => toast(String(e.message || e), true)),
            }),
            h('button', { class: 'btn', type: 'button', text: '扫码登录', onClick: openQrLogin }),
            h('button', { class: 'btn', type: 'button', text: '清空登录', onClick: () => dsh.bili.save({ sessdata: '', biliJct: '', buvid3: '' }).then(() => { biliBadge.className = 'badge'; biliBadge.textContent = '未登录'; biliOut.textContent = '登录信息已清空。'; toast('已清空'); }).catch((e) => toast(String(e.message || e), true)) })),
          biliOut));

      // ================= B 站 · 养成 =================
      const dailyInput = h('input', { type: 'checkbox' });
      dailyInput.checked = !!biliLifeInfo.enabled;
      const dailySwitch = h('label', { class: 'switch' }, dailyInput, h('span', { class: 'track' }));
      const preferInput = h('input', {
        class: 'input input-wide',
        type: 'text',
        placeholder: '比如：猫, 摄影, 动画（逗号隔开）',
        value: (biliLifeInfo.preferTags || []).join('，'),
      });
      const blockInput = h('input', {
        class: 'input input-wide',
        type: 'text',
        placeholder: '比如：跳脸, 恐怖, 擦边（命中就不推）',
        value: (biliLifeInfo.blockTags || []).join('，'),
      });
      const lifeOut = h('div', { class: 'path-box path-box-multi', text: '还没发过。' });
      const lifeList = h('div', { class: 'list' });
      const quotaBadge = h('span', {
        class: 'badge' + (biliStatus.quota && biliStatus.quota.count ? ' badge-ok' : ''),
        text: '今天 ' + ((biliStatus.quota && biliStatus.quota.count) || 0) + ' 条',
      });

      function renderLife(info) {
        lifeList.innerHTML = '';
        const hist = (info && info.history) || [];
        if (!hist.length) {
          lifeList.appendChild(h('div', { class: 'empty', text: '还没有发过。点「现在发一条」试试。' }));
          return;
        }
        hist.slice(0, 8).forEach((item) => {
          const when = new Date(item.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          lifeList.appendChild(
            h('div', { class: 'list-row' },
              h('div', { class: 'list-main' },
                h('div', { class: 'list-title' }, h('span', { text: item.title || item.bv || '（没有标题）' })),
                h('div', { class: 'list-sub', text: when + SP.g3 + (item.ok ? '已发出' : '没发成：' + (item.message || '未知原因')) + (item.text ? SP.g3 + item.text.slice(0, 40) : '') })),
              h('div', { class: 'list-ctrl' },
                h('span', { class: 'badge' + (item.ok ? ' badge-ok' : ' badge-err'), text: item.ok ? '成功' : '失败' }))));
        });
      }
      renderLife(biliLifeInfo);

      const saveLife = () => dsh.bili.lifeSave({
        enabled: dailyInput.checked,
        preferTags: preferInput.value,
        blockTags: blockInput.value,
      })
        .then((r) => { renderLife(r.overview); toast('养鱼设置已保存'); })
        .catch((e) => toast(String(e.message || e), true));

      root.appendChild(
        h('section', { class: 'section' },
          h('div', { class: 'section-head' },
            h('div', null,
              h('div', { class: 'section-title', text: 'B 站' + SP.g2 + '养成' }),
              h('div', { class: 'section-desc', text: '她会自己去刷视频，隔一段时间挑一个，用私信推给你。' })),
            h('div', { class: 'section-tools' }, quotaBadge)),
          h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '自动私信推荐' }), h('div', { class: 'row-hint', text: '节奏和免打扰跟「通用 → 主动聊天」共用一套（总开关也在那儿）；同一个视频 7 天不重复。' })),
            h('div', { class: 'row-ctrl' }, dailySwitch)),
          h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '想看的标签' }), h('div', { class: 'row-hint', text: '命中这些词的优先推；一个都没命中就退回全部。逗号隔开。' })),
            h('div', { class: 'row-ctrl' }, preferInput)),
          h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '不看的标签' }), h('div', { class: 'row-hint', text: '标题、分区、简介、作者里命中就不推。逗号隔开。' })),
            h('div', { class: 'row-ctrl' }, blockInput)),
          h('div', { class: 'row-actions' },
            h('button', { class: 'btn btn-primary', type: 'button', text: '保存', onClick: saveLife }),
            h('button', {
              class: 'btn', type: 'button', text: '现在发一条',
              onClick: () => {
                lifeOut.textContent = '正在挑视频、正在写…';
                dsh.bili.lifeRun().then((r) => {
                  lifeOut.textContent = r.ok ? '发出去了：' + (r.text || '') : '没发出去：' + (r.message || '未知原因');
                  if (r.ok) toast('私信已发出'); else toast(r.message || '没发出去', true);
                  return dsh.bili.life().then((info) => renderLife(info));
                }).catch((e) => { lifeOut.textContent = '出错：' + (e.message || e); toast('出错', true); });
              },
            }),
            h('button', {
              class: 'btn', type: 'button', text: '看看今天的推荐',
              onClick: () => {
                lifeOut.textContent = '正在拉…';
                dsh.bili.recommendText(5).then((r) => { lifeOut.textContent = r.text || '没拉到'; })
                  .catch((e) => { lifeOut.textContent = '拉取失败：' + (e.message || e); });
              },
            })),
          lifeOut,
          h('div', { class: 'list-head' }, h('span', { text: '最近发的' })),
          lifeList,
          h('div', { class: 'row' },
            h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '手动发一条' }), h('div', { class: 'row-hint', text: '不超过 300 字。只发给上面那个 UID。' })),
            h('div', { class: 'row-ctrl' },
              h('button', {
                class: 'btn', type: 'button', text: '发送',
                onClick: () => {
                  const box = document.getElementById('biliManualBox');
                  const text = (box && box.value || '').trim();
                  if (!text) return toast('先写点什么', true);
                  dsh.bili.send(text).then((r) => {
                    if (r.ok) { box.value = ''; toast('已发出'); lifeOut.textContent = '已发出：' + text.slice(0, 40); }
                    else toast(r.message || '没发出去', true);
                  }).catch((e) => toast(String(e.message || e), true));
                },
              }))),
          h('textarea', { class: 'input textarea', id: 'biliManualBox', rows: '3', placeholder: '想让她说什么，就直接写在这里发出去。' })));
    },
  };
})();

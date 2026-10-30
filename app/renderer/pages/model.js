'use strict';

/**
 * 模型页：接入 / 记忆 / 人格 / 表情包
 * ------------------------------------------------------------
 * 这一页是整个"脑子"的配置入口：
 *   接入 —— 用哪个大模型（Ollama 本机 / 硅基流动云端 / 自定义）
 *   记忆 —— 记在哪、怎么找（本地关键词 / 本地 + 云端向量）
 *   人格 —— 说话方式（可增删改，内置几套预设）
 */

(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  function section(h, title, desc, right) {
    return h(
      'section',
      { class: 'section' },
      h(
        'div',
        { class: 'section-head' },
        h('div', null, h('div', { class: 'section-title', text: title }), desc ? h('div', { class: 'section-desc', text: desc }) : null),
        right || null,
      ),
    );
  }

  function field(h, label, control, hint) {
    return h(
      'div',
      { class: 'field' },
      h('div', { class: 'field-label', text: label }),
      control,
      hint ? h('div', { class: 'field-hint', text: hint }) : null,
    );
  }

  /**
   * 对外规矩（护栏）
   * 系统那几条写死在 core/guard.js，这里只读展示；用户自己写的一行一条。
   */
  async function renderGuard(h, dsh, ctx) {
    const g = await dsh.guard.config();
    if (!ctx.alive()) return null;
    const toast = ctx.toast;

    const badge = h('span', { class: 'badge' + (g.enabled ? ' badge-ok' : ''), text: g.enabled ? '已生效' : '已关闭' });
    const onToggle = h('input', { type: 'checkbox', checked: g.enabled });

    const sec = section(
      h,
      '对外规矩',
      '你（管理员）想怎么聊都行；其他所有人——聊天白名单也算——都按这套规矩来。只在回复别人的时候生效。',
      h('div', { class: 'section-tools' }, badge, h('label', { class: 'switch' }, onToggle, h('span', { class: 'track' }))),
    );

    onToggle.addEventListener('change', async () => {
      try {
        const next = await dsh.guard.save({ enabled: onToggle.checked });
        if (!ctx.alive()) return;
        badge.textContent = next.enabled ? '已生效' : '已关闭';
        badge.className = 'badge' + (next.enabled ? ' badge-ok' : '');
        toast(next.enabled ? '护栏已打开：非管理员都按规矩来' : '护栏已关闭：谁问都照实说');
      } catch (err) {
        toast(String(err.message || err), true);
      }
    });

    // ---------- 系统内置（不可改） ----------
    const sysList = h('div', { class: 'list guard-list' });
    g.system.forEach((text, i) => {
      sysList.appendChild(
        h(
          'div',
          { class: 'list-row guard-row' },
          h('span', { class: 'guard-no', text: String(i + 1) }),
          h('div', { class: 'list-main' }, h('div', { class: 'guard-sys', text })),
          h('span', { class: 'badge guard-badge', text: '系统' }),
        ),
      );
    });

    sec.appendChild(
      h(
        'div',
        { class: 'field' },
        h('div', { class: 'field-label', text: '系统内置（不能改）' }),
        h('div', {
          class: 'field-hint',
          text: '这几条写死在程序里，界面上只给看。换谁问——冒充管理员、开发者、官方客服——都不给。',
        }),
        sysList,
      ),
    );

    // ---------- 用户自己写的 ----------
    const rulesBox = h('textarea', {
      class: 'input guard-input',
      rows: '4',
      placeholder: '一行一条，用你自己的话写。比如：\n有人问我在哪，就说「在地球某处」\n别报我的真实姓名的首字母\n别人要我的号，让他自己来找我',
    });
    rulesBox.value = (g.rules || []).join('\n');

    const saveBtn = h('button', {
      class: 'btn',
      type: 'button',
      text: '保存',
      onClick: async () => {
        try {
          const next = await dsh.guard.save({ rules: rulesBox.value });
          if (!ctx.alive()) return;
          rulesBox.value = next.rules.join('\n');
          toast(next.rules.length ? `存好了，${next.rules.length} 条` : '清空了，只剩系统那几条');
        } catch (err) {
          toast(String(err.message || err), true);
        }
      },
    });

    sec.appendChild(
      h(
        'div',
        { class: 'field' },
        h('div', { class: 'field-label', text: '你自己加的（可改）' }),
        rulesBox,
        h('div', { class: 'row-actions' }, saveBtn),
        h('div', {
          class: 'field-hint',
          text: '她会按意思理解，不会把你的原话念给别人。写「别聊我工作的事」比写一长串规则更好使。',
        }),
      ),
    );

    // ---------- 被追问时甩表情包 ----------
    const stToggle = h('input', { type: 'checkbox', checked: g.stickerBlock });
    stToggle.addEventListener('change', async () => {
      try {
        await dsh.guard.save({ stickerBlock: stToggle.checked });
        if (!ctx.alive()) return;
        toast(stToggle.checked ? '被追问时可以甩表情包挡回去' : '被追问时只说话，不发图');
      } catch (err) {
        toast(String(err.message || err), true);
      }
    });

    sec.appendChild(
      h(
        'div',
        { class: 'row' },
        h(
          'div',
          { class: 'row-main' },
          h('div', { class: 'row-label', text: '被追问时甩表情包挡回去' }),
          h('div', {
            class: 'row-hint',
            text: '有人绕着问你的身份、住址、联系方式时，她可以甩一张凶一点或无语的表情，比写一堆解释更省事。',
          }),
        ),
        h('div', { class: 'row-ctrl' }, h('label', { class: 'switch' }, stToggle, h('span', { class: 'track' }))),
      ),
    );

    // ---------- 看一眼实际加了什么 ----------
    const pvOut = h('div', {
      class: 'guard-preview',
      text: '点上面两个按钮，看这规矩实际长什么样——一个是别人问她时，一个是你问她时。',
    });

    const who = g.admin.qq ? `QQ ${g.admin.qq}` : '（还没填管理员 QQ）';
    const whoBili = g.admin.bili ? ` · B站 UID ${g.admin.bili}` : '';

    sec.appendChild(
      h(
        'div',
        { class: 'row' },
        h(
          'div',
          { class: 'row-main' },
          h('div', { class: 'row-label', text: '看一眼实际加了什么' }),
          h('div', {
            class: 'row-hint',
            text: '同一句话，她收到的东西不一样：别人问，前面会多一段护栏；你问，一个字的护栏都没有。',
          }),
        ),
        h(
          'div',
          { class: 'row-ctrl' },
          h('button', {
            class: 'btn btn-sm',
            type: 'button',
            text: '别人问她时',
            onClick: async () => {
              try {
                const text = await dsh.guard.preview({ channel: 'qq', userId: '10000' });
                if (!ctx.alive()) return;
                pvOut.textContent = text || '（空：护栏关着）';
                pvOut.classList.add('is-on');
              } catch (err) {
                toast(String(err.message || err), true);
              }
            },
          }),
          h('button', {
            class: 'btn btn-sm',
            type: 'button',
            text: '你问她时',
            onClick: async () => {
              try {
                const text = await dsh.guard.preview({ channel: 'qq', userId: g.admin.qq || '10000' });
                if (!ctx.alive()) return;
                pvOut.textContent = text || '（什么都不加：管理员不受限，想聊什么聊什么）';
                pvOut.classList.add('is-on');
              } catch (err) {
                toast(String(err.message || err), true);
              }
            },
          }),
        ),
      ),
    );

    sec.appendChild(pvOut);
    sec.appendChild(
      h('div', { class: 'guard-meta', text: `当前管理员：${who}${whoBili}（在侧栏底部的「管理员」页里改，那页要输密钥）` }),
    );

    sec.appendChild(
      h('div', {
        class: 'section-note',
        text: '护栏只加在「回复别人」的那一次请求里；人格、记忆、表情包、语音这些配置都不受影响，别人也看不到。',
      }),
    );

    return sec;
  }

  PAGES.model = {
    async render(root, ctx) {
      const { h, t, toast, openModal, refresh, dsh } = ctx;

      const [overview, memoryStats, memoryList, personas] = await Promise.all([
        dsh.model.overview(),
        dsh.memory.stats(),
        dsh.memory.list(20),
        dsh.personas.all(),
      ]);
      if (!ctx.alive()) return;

      // ===================== 接入 =====================
      const providerList = h('div', { class: 'list' });
      const activeProvider = overview.providers.find((p) => p.id === overview.active) || overview.providers[0];

      for (const provider of overview.providers) {
        const isActive = provider.id === overview.active;
        const right = h(
          'div',
          { class: 'list-ctrl' },
          h(
            'div',
            { class: 'row-actions' },
            !isActive
              ? h('button', {
                  class: 'btn btn-sm',
                  type: 'button',
                  text: '设为当前',
                  onClick: async () => {
                    try {
                      await dsh.model.setActive(provider.id);
                      toast('已切换到 ' + provider.name);
                      refresh();
                    } catch (err) {
                      toast(String(err.message || err), true);
                    }
                  },
                })
              : null,
            h('button', {
              class: 'btn btn-sm',
              type: 'button',
              text: '配置',
              onClick: () => openProviderEditor(provider),
            }),
          ),
        );

        providerList.appendChild(
          h(
            'div',
            { class: 'list-row' + (isActive ? ' is-active' : '') },
            h(
              'div',
              { class: 'list-main' },
              h(
                'div',
                { class: 'list-title' },
                h('span', { text: provider.name }),
                h('span', { class: 'badge', text: provider.subtitle || '' }),
                isActive ? h('span', { class: 'badge badge-ok', text: '当前使用' }) : null,
              ),
              h(
                'div',
                { class: 'list-sub' },
                h('span', { text: provider.baseUrl || '（还没填地址）' }),
                h('span', { class: 'meta-gap' }),
                h('span', { text: '模型：' + (provider.modelLabel || provider.model || '未填'), title: provider.model || '' }),
                h('span', { class: 'meta-gap' }),
                h('span', { text: provider.needsKey ? (provider.hasKey ? '已填 Key ' + provider.apiKeyMasked : '还没填 Key') : '不需要 Key' }),
              ),
            ),
            right,
          ),
        );
      }


      function modelHintOf(provider) {
        if (provider.id === 'deepseek') return '点下面的档位会自己填；也可以手填别的（比如新出的型号）';
        if (provider.id === 'ollama') return 'Ollama 例：qwen2.5:7b，ollama list 里能看到装了哪些';
        if (provider.id === 'siliconflow') return '硅基流动例：deepseek-ai/DeepSeek-V3，用它模型列表里的原名';
        return '填服务商给的模型名';
      }
      function openProviderEditor(provider) {
        const baseInput = h('input', { class: 'input', type: 'text', value: provider.baseUrl || '', placeholder: 'https://…/v1' });
        const modelInput = h('input', { class: 'input', type: 'text', value: provider.model || '', placeholder: '模型名' });
        const keyInput = h('input', {
          class: 'input',
          type: 'password',
          value: '',
          placeholder: provider.hasKey ? '已保存（留空表示不改）' : 'sk-…',
        });
        const resultLine = h('div', { class: 'field-hint', text: provider.hint || '' });
        const modelList = h('div', { class: 'model-list' });

        // 档位（只有云端几家有预设：Flash / Pro / Max …）
        const tierList = h('div', { class: 'model-list' });
        const tierBox = h(
          'div',
          { class: 'field', style: 'display:none' },
          h('div', { class: 'field-label', text: '档位' }),
          tierList,
          h('div', {
            class: 'field-hint',
            text: '点一个就填上对应的模型名。真有没有这个档位，点下面的「试一下」或「列出可用模型」就知道；也可以直接在上面手填。',
          }),
        );

        dsh.model
          .catalog(provider.id)
          .then((list) => {
            if (!list || !list.length) return;
            tierBox.style.display = '';
            const markActive = () => {
              for (const c of tierList.children) {
                c.classList.toggle('is-active', c.dataset.model === modelInput.value);
              }
            };
            for (const item of list) {
              tierList.appendChild(
                h('button', {
                  class: 'model-chip' + (item.id === modelInput.value ? ' is-active' : ''),
                  type: 'button',
                  text: item.label,
                  title: item.id + (item.note ? ' — ' + item.note : ''),
                  dataset: { model: item.id },
                  onClick: () => {
                    modelInput.value = item.id;
                    markActive();
                  },
                }),
              );
            }
            modelInput.addEventListener('input', markActive);
          })
          .catch(() => {});

        async function pullModels() {
          resultLine.textContent = '正在拉模型列表…';
          modelList.textContent = '';
          try {
            const res = await dsh.model.test(provider.id, {
              baseUrl: baseInput.value,
              apiKey: keyInput.value,
            });
            if (!res.ok) {
              resultLine.textContent = '拉不到：' + res.detail;
              return;
            }
            const names = (res.models || []).slice(0, 80);
            resultLine.textContent = `连上了，${res.detail.replace(/^连上了，/, '')}。点一个填进去：`;
            for (const name of names) {
              modelList.appendChild(
                h('button', {
                  class: 'model-chip' + (name === modelInput.value ? ' is-active' : ''),
                  type: 'button',
                  text: name,
                  onClick: () => {
                    modelInput.value = name;
                    for (const c of modelList.children) c.classList.remove('is-active');
                    modelList.children[names.indexOf(name)].classList.add('is-active');
                  },
                }),
              );
            }
          } catch (err) {
            resultLine.textContent = '拉不到：' + String(err.message || err);
          }
        }

        const modal = openModal({
          title: '配置：' + provider.name,
          desc: '只要兼容 OpenAI 的 /v1 接口就能接。改完点保存，点测试会真的发一次请求。',
          body: h(
            'div',
            null,
            field(h, '接口地址', baseInput, '通常是 …/v1，后面不用带 /chat/completions'),
            field(h, '模型名', modelInput, modelHintOf(provider)),
            tierBox,
            field(h, 'API Key', keyInput, provider.needsKey ? '必填；只存在本机 settings.json 里' : '本地模型一般不需要'),
            h('div', { class: 'inline-row' },
              h('button', { class: 'btn', type: 'button', text: '列出可用模型', onClick: () => pullModels() })),
            modelList,
            resultLine,
          ),
          footer: h(
            'div',
            { class: 'modal-actions' },
            h('button', {
              class: 'btn',
              type: 'button',
              text: '测试连接',
              onClick: async () => {
                resultLine.textContent = '正在测试…';
                try {
                  await dsh.model.save(provider.id, {
                    baseUrl: baseInput.value,
                    model: modelInput.value,
                    apiKey: keyInput.value,
                  });
                  const res = await dsh.model.test(provider.id);
                  resultLine.textContent = res.ok
                    ? `${res.detail}（${res.ms}ms）` + (res.models && res.models.length ? '：' + res.models.slice(0, 6).join(', ') : '')
                    : '失败：' + res.detail;
                } catch (err) {
                  resultLine.textContent = '失败：' + String(err.message || err);
                }
              },
            }),
            h('button', {
              class: 'btn btn-primary',
              type: 'button',
              text: '保存',
              onClick: async () => {
                try {
                  await dsh.model.save(provider.id, {
                    baseUrl: baseInput.value,
                    model: modelInput.value,
                    apiKey: keyInput.value,
                  });
                  modal.close();
                  toast('已保存');
                  refresh();
                } catch (err) {
                  toast(String(err.message || err), true);
                }
              },
            }),
          ),
        });
      }

      root.appendChild(
        section(
          h,
          '接入',
          '挑一套用。三套可以同时配好，随时切换 —— 换模型不用重启。',
          h('span', { class: 'badge', text: '当前：' + (activeProvider ? activeProvider.name : '未选') }),
        ),
      );
      root.lastChild.appendChild(providerList);

      // ===================== 记忆 =====================
      const backendSelect = h(
        'select',
        { class: 'select' },
        h('option', { value: 'local', text: '本地（只存本机，关键词检索）' }),
        h('option', { value: 'ollama', text: '本地 + Ollama 向量（语义检索）' }),
        h('option', { value: 'siliconflow', text: '本地 + 硅基流动向量（语义检索）' }),
      );
      backendSelect.value = memoryStats.backend;
      backendSelect.addEventListener('change', async () => {
        try {
          await dsh.settings.patch({ model: { memory: { backend: backendSelect.value } } });
          toast('记忆方式已切换');
          refresh();
        } catch (err) {
          toast(String(err.message || err), true);
        }
      });

      const memorySection = section(
        h,
        '记忆',
        '记忆永远存在本机数据库里；选 Ollama / 硅基流动只是借用它们把文字变成向量，方便按意思找。',
        h('span', { class: 'badge', text: `共 ${memoryStats.count} 条` }),
      );

      memorySection.appendChild(
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-label', text: '记忆方式' }),
          h('div', { class: 'row-ctrl' }, backendSelect),
        ),
      );

      // ---- 向量状态：能不能按意思找、还有多少条没算 ----
      const vecBadge = h('span', {
        class: 'badge' + (memoryStats.backend !== 'local' && memoryStats.vectorized ? ' badge-ok' : ''),
        text:
          memoryStats.backend === 'local'
            ? '关键词检索'
            : memoryStats.vectorized
              ? `已向量 ${memoryStats.vectorized}/${memoryStats.count}`
              : '还没有向量',
      });
      const vecOut = h('div', {
        class: 'path-box path-box-multi',
        text:
          memoryStats.backend === 'local'
            ? '现在是本地关键词检索：不用向量模型，也不联网，但只会「字面命中」。想按意思找，把上面的「记忆方式」换成 Ollama。'
            : memoryStats.dim
              ? `向量模型：${memoryStats.embedModel || '(没说)'}` + SP.g2 + `${memoryStats.dim} 维。已向量 ${memoryStats.vectorized} / ${memoryStats.count} 条。`
              : `已选 ${memoryStats.backend}，但一条向量都还没有。点「补算向量」把老记忆算出来。`,
      });

      const probeBtn = h('button', {
        class: 'btn',
        type: 'button',
        text: '测试向量',
        onClick: async () => {
          vecOut.textContent = '正在问模型要一条向量…';
          try {
            const r = await dsh.memory.probe();
            if (!ctx.alive()) return;
            vecOut.textContent = (r.ok ? '✅ ' : '❌ ') + (r.detail || '');
          } catch (err) {
            vecOut.textContent = '测试失败：' + (err.message || err);
          }
        },
      });

      const backfillBtn = h('button', {
        class: 'btn btn-primary',
        type: 'button',
        text: '补算向量',
        onClick: async () => {
          if (memoryStats.backend === 'local') {
            vecOut.textContent = '现在是关键词检索，不需要向量。先把「记忆方式」换成 Ollama 再来。';
            return;
          }
          backfillBtn.disabled = true;
          let total = 0;
          try {
            for (let i = 0; i < 40; i++) {
              const r = await dsh.memory.backfill(8);
              if (!ctx.alive()) return;
              total += r.done || 0;
              vecOut.textContent = `正在补… 这一轮算了 ${r.done || 0} 条，累计 ${total} 条，还剩 ${r.left || 0} 条。`;
              if (!r.done || !r.left) break;
            }
            vecOut.textContent += '\n补完了，刷新一下看看状态。';
            toast('向量补算完成，共 ' + total + ' 条');
            refresh();
          } catch (err) {
            vecOut.textContent = '补算失败：' + (err.message || err);
            toast('补算失败', true);
          } finally {
            backfillBtn.disabled = false;
          }
        },
      });

      memorySection.appendChild(
        h(
          'div',
          { class: 'row' },
          h(
            'div',
            { class: 'row-main' },
            h('div', { class: 'row-label', text: '按意思找（向量）' }),
            h('div', { class: 'row-hint', text: '把「喝什么」和「热牛奶」连起来靠的就是它。算一次存本地，之后不用再算。' }),
          ),
          h('div', { class: 'row-ctrl' }, vecBadge, probeBtn, backfillBtn),
        ),
      );
      memorySection.appendChild(vecOut);

      // 自动提炼：聊完让本地小模型挑一句值得记的
      const distillCfg = await dsh.distill.config();
      if (!ctx.alive()) return;
      const distillSwitch = h('label', { class: 'switch' }, h('input', { type: 'checkbox' }), h('span', { class: 'track' }));
      distillSwitch.querySelector('input').checked = distillCfg.enabled !== false;
      distillSwitch.querySelector('input').addEventListener('change', async (e) => {
        try {
          await dsh.distill.save({ enabled: e.target.checked });
          toast(e.target.checked ? '聊完会自己记一笔' : '不再自动记');
        } catch (err) {
          toast(String(err.message || err), true);
        }
      });
      const distillWhere = distillCfg.provider === 'ollama' ? '本机 Ollama（免费）' : '云端 DeepSeek';
      memorySection.appendChild(
        h(
          'div',
          { class: 'row' },
          h(
            'div',
            { class: 'row-main' },
            h('div', { class: 'row-label', text: '聊完自己记一笔' }),
            h('div', { class: 'row-hint', text: '每轮聊完让模型（' + (distillCfg.model || '未填') + '）挑一句值得长期记住的事；当前走' + distillWhere + '。' }),
          ),
          h('div', { class: 'row-ctrl' }, distillSwitch),
        ),
      );

      // 提炼用哪个引擎：本机 Ollama（免费）或云端 DeepSeek
      const distillChoices = [
        { provider: 'ollama', model: 'qwen2.5:0.5b', text: '本机 Ollama · qwen2.5:0.5b（免费）' },
        { provider: 'deepseek', model: 'deepseek-chat', text: 'DeepSeek 云端 · deepseek-chat' },
      ];
      const optKey = (x) => x.provider + '|' + x.model;
      const curKey = (distillCfg.provider || 'ollama') + '|' + (distillCfg.model || '');
      if (!distillChoices.some((x) => optKey(x) === curKey)) {
        distillChoices.push({ provider: distillCfg.provider || 'ollama', model: distillCfg.model || '', text: '当前配置 · ' + (distillCfg.model || '未填') });
      }
      const distillModelSel = h('select', { class: 'input', style: 'width: 260px;' });
      distillChoices.forEach((x) => distillModelSel.appendChild(h('option', { value: optKey(x), text: x.text })));
      distillModelSel.value = curKey;
      distillModelSel.addEventListener('change', async () => {
        const hit = distillChoices.find((x) => optKey(x) === distillModelSel.value);
        if (!hit) return;
        distillModelSel.disabled = true;
        try {
          await dsh.distill.save({ provider: hit.provider, model: hit.model });
          toast('提炼改用 ' + (hit.provider === 'ollama' ? '本机 Ollama' : 'DeepSeek'));
          refresh();
        } catch (err) {
          toast(String(err.message || err), true);
          distillModelSel.disabled = false;
        }
      });
      memorySection.appendChild(
        h(
          'div',
          { class: 'row' },
          h(
            'div',
            { class: 'row-main' },
            h('div', { class: 'row-label', text: '提炼用什么模型' }),
            h('div', { class: 'row-hint', text: '判断「以后还用不用得上」不需要多聪明：本机 Ollama 免费、断网也能记；云端更准，但要花 token。' }),
          ),
          h('div', { class: 'row-ctrl' }, distillModelSel),
        ),
      );

      // ---- 画像 / 遗忘曲线 / 备份 ----
      const KIND_NAMES = { fact: '事实', pref: '偏好', event: '经历', bond: '关系', plan: '约定', other: '其它' };
      const dcfg = memoryStats.decay || {};
      const statLine = h(
        'div',
        { class: 'inline-row' },
        h('span', { class: 'badge', text: `活跃 ${memoryStats.active ?? memoryStats.count} 条` }),
        h('span', { class: 'badge', text: `归档 ${memoryStats.archived || 0} 条` }),
        h('span', { class: 'badge', text: '平均重要度 ' + (memoryStats.avgImportance || '-') }),
        h('span', { class: 'badge' + (memoryStats.pinned ? ' badge-ok' : ''), text: `置顶 ${memoryStats.pinned || 0}` }),
      );
      memorySection.appendChild(statLine);

      const profile = await dsh.memory.profile(5);
      if (!ctx.alive()) return;
      if (profile.length) {
        memorySection.appendChild(h('div', { class: 'list-head' }, h('span', { text: '长期画像（每次说话都会带上）' })));
        const profList = h('div', { class: 'list' });
        for (const p of profile) {
          profList.appendChild(
            h(
              'div',
              { class: 'list-row' },
              h(
                'div',
                { class: 'list-main' },
                h('div', { class: 'list-text', text: p.text }),
                h('div', { class: 'list-sub', text: `${KIND_NAMES[p.kind] || '事实'}` + SP.g2 + `重要度 ${p.importance}` + SP.g2 + (p.pinned ? '置顶' : '高重要度') }),
              ),
            ),
          );
        }
        memorySection.appendChild(profList);
      }

      // 遗忘曲线
      const decaySwitch = h('label', { class: 'switch' }, h('input', { type: 'checkbox' }), h('span', { class: 'track' }));
      decaySwitch.querySelector('input').checked = dcfg.enabled !== false;
      const decayHalf = h('input', { class: 'input input-num', type: 'number', min: 3, max: 365, step: 1 });
      decayHalf.value = String(dcfg.halfLifeDays || 30);
      const decayBelow = h('input', { class: 'input input-num', type: 'number', min: 5, max: 80, step: 5 });
      decayBelow.value = String(Math.round((dcfg.archiveBelow || 0.28) * 100));
      const decayDays = h('input', { class: 'input input-num', type: 'number', min: 1, max: 365, step: 1 });
      decayDays.value = String(dcfg.minAgeDays || 21);
      const decayOut = h('div', { class: 'path-box path-box-multi', text: '按上面的参数算，太久没被想起的记忆会归档，不会删除。' });

      const saveDecayBtn = h('button', {
        class: 'btn',
        type: 'button',
        text: '保存',
        onClick: async () => {
          try {
            const r = await dsh.memory.decaySave({
              enabled: decaySwitch.querySelector('input').checked,
              halfLifeDays: Number(decayHalf.value) || 30,
              archiveBelow: (Number(decayBelow.value) || 28) / 100,
              minAgeDays: Number(decayDays.value) || 21,
            });
            decayOut.textContent = `已保存：半衰期 ${r.halfLifeDays} 天，留存低于 ${Math.round(r.archiveBelow * 100)}% 且超过 ${r.minAgeDays} 天就归档。`;
            toast('遗忘曲线已保存');
          } catch (err) {
            toast(String(err.message || err), true);
          }
        },
      });
      const runDecayBtn = h('button', {
        class: 'btn',
        type: 'button',
        text: '立刻跑一次',
        onClick: async () => {
          runDecayBtn.disabled = true;
          try {
            const r = await dsh.memory.decay();
            decayOut.textContent = r.ok ? `跑完了：这次归档 ${r.archived} 条（没删，列表里能翻出来）。` : `没跑：${r.message || '未知原因'}`;
            toast(r.ok ? '归档 ' + r.archived + ' 条' : '没跑');
          } catch (err) {
            decayOut.textContent = '出错：' + (err.message || err);
          } finally {
            runDecayBtn.disabled = false;
          }
        },
      });

      memorySection.appendChild(h('div', { class: 'row' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '遗忘曲线' }),
          h('div', { class: 'row-hint', text: '越久没被想起，记得越淡；低于阈值就归档（还能翻出来，不会真删）。越常被想起，强度越高、忘得越慢。' })),
        h('div', { class: 'row-ctrl' }, decaySwitch)));
      memorySection.appendChild(h('div', { class: 'row' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '半衰期（天）' }),
          h('div', { class: 'row-hint', text: '默认 30 天：一条 30 天没被用到的记忆，留存掉到一半。' })),
        h('div', { class: 'row-ctrl' }, decayHalf)));
      memorySection.appendChild(h('div', { class: 'row' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '归档阈值（%）' }),
          h('div', { class: 'row-hint', text: '留存低于这个百分比才归档；重要度 ≥ 8 的不归档。' })),
        h('div', { class: 'row-ctrl' }, decayBelow)));
      memorySection.appendChild(h('div', { class: 'row' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '至少保留（天）' }),
          h('div', { class: 'row-hint', text: '再淡也先留这么久，避免刚说过两天就被归档。' })),
        h('div', { class: 'row-ctrl' }, decayDays)));
      memorySection.appendChild(h('div', { class: 'row-actions' }, saveDecayBtn, runDecayBtn));
      memorySection.appendChild(decayOut);

      // 备份 / 恢复
      const bcfg = memoryStats.backup || {};
      const backupUrl = h('input', { class: 'input input-wide', type: 'text', placeholder: '可留空。填 http(s) 地址（WebDAV 之类）就同时 PUT 一份 JSON 上去' });
      backupUrl.value = bcfg.url || '';
      const backupOut = h('div', {
        class: 'path-box path-box-multi',
        text: bcfg.lastAt
          ? `上次备份：${new Date(bcfg.lastAt).toLocaleString()}${bcfg.lastOk ? '（成功）' : '（' + (bcfg.lastError || '失败') + '）'}`
          : '还没备份过。备份是 JSON 快照，存在 data/memory-backup/，也能传到云端地址。',
      });
      const saveUrlBtn = h('button', {
        class: 'btn',
        type: 'button',
        text: '保存地址',
        onClick: async () => {
          try {
            const r = await dsh.memory.backupCfg({ url: backupUrl.value.trim() });
            toast(r.url ? '云端地址已保存' : '云端地址已清空');
          } catch (err) {
            toast(String(err.message || err), true);
          }
        },
      });
      const backupBtn = h('button', {
        class: 'btn btn-primary',
        type: 'button',
        text: '立即备份',
        onClick: async () => {
          backupBtn.disabled = true;
          backupOut.textContent = '正在备份…';
          try {
            const r = await dsh.memory.backup();
            backupOut.textContent = `已导出 ${r.count} 条到本机：${r.file}\n云端上传：${r.uploaded ? '成功' : r.error ? '失败（' + r.error + '）' : '没配地址，跳过'}`;
            toast('备份完成');
          } catch (err) {
            backupOut.textContent = '备份失败：' + (err.message || err);
          } finally {
            backupBtn.disabled = false;
          }
        },
      });
      const restoreBtn = h('button', {
        class: 'btn',
        type: 'button',
        text: '从最近备份恢复',
        onClick: async () => {
          restoreBtn.disabled = true;
          try {
            const r = await dsh.memory.restoreLatest();
            backupOut.textContent = `已从 ${r.file} 恢复：新增 ${r.added} 条，更新 ${r.updated} 条。`;
            toast('恢复完成');
            refresh();
          } catch (err) {
            backupOut.textContent = '恢复失败：' + (err.message || err);
          } finally {
            restoreBtn.disabled = false;
          }
        },
      });

      memorySection.appendChild(h('div', { class: 'row' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '云端备份地址' }),
          h('div', { class: 'row-hint', text: '本机永远存一份；这里填地址就额外备份到云端（一次 PUT 整个 JSON）。' })),
        h('div', { class: 'row-ctrl' }, backupUrl, saveUrlBtn)));
      memorySection.appendChild(h('div', { class: 'row-actions' }, backupBtn, restoreBtn));
      memorySection.appendChild(backupOut);

      const distillRunBtn = h('button', {
        class: 'btn',
        type: 'button',
        text: '整理最近聊天',
        onClick: async () => {
          distillRunBtn.disabled = true;
          try {
            const r = await dsh.distill.run(60);
            toast(r.saved && r.saved.length ? '新记住 ' + r.saved.length + ' 条' : '没挑出新的');
            if (r.saved && r.saved.length) refresh();
          } catch (err) {
            toast(String(err.message || err), true);
          } finally {
            distillRunBtn.disabled = false;
          }
        },
      });
      memorySection.appendChild(h('div', { class: 'row', style: 'margin-top: 16px;' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: '整理最近聊天' }),
          h('div', { class: 'row-hint', text: '把最近 60 条聊天里能记住的事提炼成记忆条目；跟已有的重复就跳过。' })),
        h('div', { class: 'row-ctrl' }, distillRunBtn)));

      const addInput = h('input', { class: 'input', type: 'text', placeholder: '记一条：比如「主人喜欢早上听歌」' });
      const addBtn = h('button', {
        class: 'btn btn-primary',
        type: 'button',
        text: '记住',
        onClick: async () => {
          const text = addInput.value.trim();
          if (!text) return;
          addBtn.disabled = true;
          try {
            await dsh.memory.add(text, []);
            addInput.value = '';
            toast('已记住');
            refresh();
          } catch (err) {
            toast(String(err.message || err), true);
          } finally {
            addBtn.disabled = false;
          }
        },
      });

      const distillTry = h('button', {
        class: 'btn',
        type: 'button',
        text: '自动记试试',
        onClick: async () => {
          const text = addInput.value.trim();
          if (!text) {
            toast('先在上面写一句，再点这个', true);
            return;
          }
          distillTry.disabled = true;
          try {
            const saved = await dsh.distill.try(text);
            if (saved && saved.length) {
              addInput.value = '';
              toast('自动记下了：' + saved.join(' / '));
              refresh();
            } else {
              toast('这句没挑出值得记的（或者刚刚已经记过）');
            }
          } catch (err) {
            toast(String(err.message || err), true);
          } finally {
            distillTry.disabled = false;
          }
        },
      });

      memorySection.appendChild(h('div', { class: 'inline-row' }, addInput, addBtn, distillTry));

      const memList = h('div', { class: 'list' });
      if (!memoryList.length) {
        memList.appendChild(h('div', { class: 'empty', text: '还没有记忆。上面写一句，就会记下来。' }));
      }
      for (const item of memoryList) {
        memList.appendChild(
          h(
            'div',
            { class: 'list-row' },
            h(
              'div',
              { class: 'list-main' },
              h('div', { class: 'list-text', text: item.text }),
              h(
                'div',
                { class: 'list-sub', text: `${KIND_NAMES[item.kind] || '事实'}` + SP.g2 + `重要度 ${item.importance}` + SP.g2 + `用过 ${item.usedCount || 0} 次` + SP.g2 + new Date(item.createdAt).toLocaleString() },
              ),
            ),
            h(
              'div',
              { class: 'list-ctrl is-buttons' },
              h('button', {
                class: 'btn btn-sm' + (item.pinned ? ' btn-primary' : ''),
                type: 'button',
                text: item.pinned ? '取消置顶' : '置顶',
                onClick: async () => {
                  try {
                    await dsh.memory.update(item.id, { pinned: !item.pinned });
                    refresh();
                  } catch (err) {
                    toast(String(err.message || err), true);
                  }
                },
              }),
              h('button', {
                class: 'btn btn-sm',
                type: 'button',
                text: '归档',
                onClick: async () => {
                  try {
                    await dsh.memory.update(item.id, { archived: true });
                    toast('已归档（不会真删）');
                    refresh();
                  } catch (err) {
                    toast(String(err.message || err), true);
                  }
                },
              }),
              h('button', {
                class: 'btn btn-sm',
                type: 'button',
                text: '删除',
                onClick: async () => {
                  try {
                    await dsh.memory.remove(item.id);
                    toast('已删除');
                    refresh();
                  } catch (err) {
                    toast(String(err.message || err), true);
                  }
                },
              }),
            ),
          ),
        );
      }
      memorySection.appendChild(memList);
      root.appendChild(memorySection);

      // ===================== 人格 =====================
      const personaSection = section(
        h,
        '人格',
        '人格决定"它怎么说话"。一套人格 = 系统提示词 + 风格 + 长度 + 禁区。先用内置的，不满意就改。',
        h('span', { class: 'badge', text: `${personas.items.length} 套` }),
      );

      function openPersonaEditor(persona) {
        const isNew = !persona;
        const data = persona || { id: '', name: '', emoji: '🙂', style: '', length: 'medium', systemPrompt: '', forbidden: [] };
        const nameInput = h('input', { class: 'input', type: 'text', value: data.name, placeholder: '比如：毒舌猫娘' });
        const emojiInput = h('input', { class: 'input input-emoji', type: 'text', value: data.emoji, placeholder: '🐳' });
        const styleInput = h('input', { class: 'input', type: 'text', value: data.style || '', placeholder: '一句话概括语气' });
        const lengthSelect = h(
          'select',
          { class: 'select' },
          h('option', { value: 'short', text: '短（1-2 句）' }),
          h('option', { value: 'medium', text: '中（3-5 句）' }),
          h('option', { value: 'long', text: '长（可以展开）' }),
        );
        lengthSelect.value = data.length || 'medium';
        const promptArea = h('textarea', { class: 'input textarea', rows: 8, placeholder: '它是谁、怎么说话、有什么禁忌…' });
        promptArea.value = data.systemPrompt || '';
        const forbidInput = h('input', {
          class: 'input',
          type: 'text',
          value: (data.forbidden || []).join('、'),
          placeholder: '用顿号或逗号隔开，比如：卖萌、长篇罗列',
        });

        const modal = openModal({
          title: isNew ? '新建人格' : '编辑：' + data.name,
          desc: '改的是本机保存的那份；内置预设改了会记住覆盖。',
          body: h(
            'div',
            null,
            h('div', { class: 'inline-row' }, emojiInput, nameInput),
            field(h, '风格一句话', styleInput),
            field(h, '回复长度', lengthSelect),
            field(h, '系统提示词', promptArea, '这段会放在对话最前面，决定它是什么角色。'),
            field(h, '禁区', forbidInput, '写在这里的行为模型会尽量避开。'),
          ),
          footer: h(
            'div',
            { class: 'modal-actions' },
            h('button', {
              class: 'btn btn-primary',
              type: 'button',
              text: '保存',
              onClick: async () => {
                const id = isNew
                  ? 'p-' + Date.now().toString(36)
                  : data.id;
                try {
                  await dsh.personas.save({
                    id,
                    name: nameInput.value.trim() || '未命名',
                    emoji: emojiInput.value.trim() || '🙂',
                    style: styleInput.value.trim(),
                    length: lengthSelect.value,
                    systemPrompt: promptArea.value,
                    forbidden: forbidInput.value.split(/[、,，\s]+/).filter(Boolean),
                  });
                  modal.close();
                  toast('已保存');
                  refresh();
                } catch (err) {
                  toast(String(err.message || err), true);
                }
              },
            }),
          ),
        });
      }

      personaSection.appendChild(
        h(
          'div',
          { class: 'inline-row' },
          h('span', { class: 'field-hint', text: '当前使用：' + ((personas.items.find((p) => p.id === personas.activeId) || {}).name || '无') }),
          h('button', { class: 'btn btn-primary', type: 'button', text: '＋ 新建人格', onClick: () => openPersonaEditor(null) }),
        ),
      );

      const personaList = h('div', { class: 'list' });
      for (const item of personas.items) {
        const isActive = item.id === personas.activeId;
        personaList.appendChild(
          h(
            'div',
            { class: 'list-row' + (isActive ? ' is-active' : '') },
            h('span', { class: 'persona-emoji', text: item.emoji || '🙂' }),
            h(
              'div',
              { class: 'list-main' },
              h(
                'div',
                { class: 'list-title' },
                h('span', { text: item.name }),
                item.builtin ? h('span', { class: 'badge', text: '内置' }) : h('span', { class: 'badge', text: '自建' }),
                isActive ? h('span', { class: 'badge badge-ok', text: '使用中' }) : null,
              ),
              h('div', { class: 'list-sub', text: item.style || '（没写风格）' }),
            ),
            h(
              'div',
              { class: 'list-ctrl' },
              h(
                'div',
                { class: 'row-actions' },
                !isActive
                  ? h('button', {
                      class: 'btn btn-sm',
                      type: 'button',
                      text: '使用',
                      onClick: async () => {
                        try {
                          await dsh.personas.setActive(item.id);
                          toast('已切换到「' + item.name + '」');
                          refresh();
                        } catch (err) {
                          toast(String(err.message || err), true);
                        }
                      },
                    })
                  : null,
                h('button', { class: 'btn btn-sm', type: 'button', text: '编辑', onClick: () => openPersonaEditor(item) }),
                !item.builtin
                  ? h('button', {
                      class: 'btn btn-sm btn-danger',
                      type: 'button',
                      text: '删除',
                      onClick: async () => {
                        try {
                          await dsh.personas.remove(item.id);
                          toast('已删除');
                          refresh();
                        } catch (err) {
                          toast(String(err.message || err), true);
                        }
                      },
                    })
                  : null,
              ),
            ),
          ),
        );
      }
      personaSection.appendChild(personaList);
      root.appendChild(personaSection);

      // ===================== 遥控电脑 =====================
      const rcSection = section(h, '遥控电脑', '你在 QQ 里说一句话，她照着做——开网页、截屏、调音量、跑命令。');
      root.appendChild(rcSection);

      try {
        let rc = await dsh.remote.config();
        if (!ctx.alive()) return;

        const rcHead = h('div', { class: 'row' },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title', text: '允许 QQ 指挥电脑' }),
            h('div', { class: 'row-desc', text: '只认「管理员」页里的白名单和管理员 QQ；关着的时候她完全不碰电脑。' }),
          ),
          h('div', { class: 'row-ctrl' },
            h('label', { class: 'switch' },
              h('input', {
                type: 'checkbox',
                checked: rc.enabled,
                onChange: async (e) => {
                  const on = e.target.checked;
                  try {
                    rc = await dsh.remote.save({ enabled: on });
                    toast(on ? '遥控已打开' : '遥控已关闭');
                  } catch (err) {
                    e.target.checked = !on;
                    toast(String(err.message || err), true);
                  }
                },
              }),
              h('span', { class: 'track' }),
            ),
          ),
        );
        rcSection.appendChild(rcHead);

        // 危险动作：管理员只拿到「格式提示」，照着那一行发过来才执行
        rcSection.appendChild(
          h('div', { class: 'row' },
            h('div', { class: 'row-main' },
              h('div', { class: 'row-title', text: '危险动作要按格式确认' }),
              h('div', { class: 'row-hint', text: '关机 / 重启 / 注销 / 睡眠 / 锁屏 / 卸载：你（管理员）问一句「帮我关机」，她只回你该发的格式——!Control computer：确认关机，不会动手；你把这一行原样发给她，才真执行。不是管理员的人问，一律回「没有权限哦~嘻嘻」，再问也只会让你去找管理员。这一行必须自己占一行、行首就是它，前面有别的字一律不算。' }),
            ),
          ),
        );

        // 遥控白名单搬到了「管理员」页，这里只留一句指路的
        rcSection.appendChild(
          h('div', { class: 'row' },
            h('div', { class: 'row-main' },
              h('div', { class: 'row-title', text: '谁可以遥控' }),
              h('div', { class: 'row-hint', text: '名单在侧栏底部的「管理员」页里改（那页要输密钥才进得去）。管理员自己永远可以。' }),
            ),
          ),
        );

        const runCmd = h('input', { type: 'checkbox', checked: rc.allowRunCmd });
        rcSection.appendChild(
          h('div', { class: 'row' },
            h('div', { class: 'row-main' },
              h('div', { class: 'row-title', text: '允许「跑命令」（最危险）' }),
              h('div', { class: 'row-desc', text: '打开后她能执行任意 PowerShell。不建议常开，用完记得关。' }),
            ),
            h('div', { class: 'row-ctrl' },
              h('label', { class: 'switch' }, runCmd, h('span', { class: 'track' })),
            ),
          ),
        );
        runCmd.addEventListener('change', async () => {
          rc = await dsh.remote.save({ allowRunCmd: runCmd.checked });
          toast(runCmd.checked ? '跑命令已允许（小心）' : '跑命令已关闭');
        });

        const rcTry = h('input', { class: 'input', placeholder: '例如：截个屏 / 打开 bilibili / 内存还剩多少' });
        const rcOut = h('div', { class: 'path-box path-box-multi' });
        const rcOutWrap = h('div', { class: 'row-field', style: 'display: none;' }, rcOut);
        rcSection.appendChild(
          h('div', { class: 'row row-stack' },
            h('div', { class: 'row-title', text: '先在这里试一句（只演流程，不会真执行）' }),
            h('div', { class: 'row-field' }, rcTry),
            h('div', { class: 'row-actions' },
              h('button', {
                class: 'btn btn-ghost btn-sm',
                text: '试一下',
                onClick: async () => {
                  const text = String(rcTry.value || '').trim();
                  if (!text) return;
                  rcOutWrap.style.display = '';
                  rcOut.textContent = '执行中…';
                  try {
                    const r = await dsh.remote.test(text);
                    rcOut.textContent = r ? (typeof r === 'string' ? r : (r.text + (r.file ? '\n（附了一张截图）' : ''))) : '这句不算命令，她会当普通聊天回。';
                  } catch (err) {
                    rcOut.textContent = String(err.message || err);
                  }
                },
              }),
            ),
            rcOutWrap,
          ),
        );

        const list = SP.join((rc.actions || []).map((a) => a.desc), SP.g2);
        rcSection.appendChild(h('div', { class: 'section-note', text: '能做的事：' + list }));
        rcSection.appendChild(h('div', { class: 'section-note', text: '危险动作只认你亲手发来的那一行：问「帮我关机」她只会回格式 !Control computer：确认关机，你原样发过来才执行（60 秒后关机，发「取消关机」能撤回）。页面上「试一下」只演流程，永远不执行。' }));
      } catch (err) {
        rcSection.appendChild(h('div', { class: 'empty', text: '读不到遥控配置：' + String(err.message || err) }));
      }

      // ===================== 表情包 =====================
      const stickerSection = section(h, '表情包', '按情绪分组、什么时候配哪张图。');
      root.appendChild(stickerSection);

      // 对外规矩：独立一块，放在表情包下面
      const guardSection = await renderGuard(h, dsh, ctx);
      if (!ctx.alive()) return;
      if (guardSection) root.appendChild(guardSection);

      let auto = await dsh.stickers.auto();
      if (!ctx.alive()) return;
      if (!auto || !auto.rules) {
        stickerSection.appendChild(h('div', { class: 'empty', text: '读不到表情包配置。' }));
        return;
      }

      const autoStat = h('div', {
        class: 'section-desc',
        text: `共 ${auto.total} 张` + SP.g2 + `${auto.groups.length} 个分组`,
      });

      // 概率输入
      const chanceInput = h('input', {
        class: 'input',
        type: 'number',
        step: '0.05',
        min: '0',
        max: '1',
        value: String(auto.chance),
        style: 'width:96px',
      });

      const enabledToggle = h('input', { type: 'checkbox', checked: auto.enabled });

      // 规则表
      const rulesBox = h('div', { class: 'rule-list' });

      function paintRules() {
        rulesBox.textContent = '';
        for (const rule of auto.rules) {
          const sel = h('select', { class: 'select rule-select' });
          const pool = Array.from(new Set([rule.group].concat(auto.groups, rule.pools))).filter(Boolean);
          for (const name of pool) sel.appendChild(h('option', { value: name, text: name }));
          sel.value = rule.group;
          sel.addEventListener('change', async (e) => {
            const v = e.currentTarget.value;
            try {
              auto = await dsh.stickers.saveAuto({ map: { [rule.id]: v } });
              if (!ctx.alive()) return;
              toast(`「${rule.zh}」改成用「${v}」`);
              paintRules();
            } catch (err) {
              toast(String(err.message || err), true);
            }
          });

          rulesBox.appendChild(
            h(
              'div',
              { class: 'rule-row' },
              h('div', { class: 'rule-mood', text: `${rule.emo} ${rule.zh}` }),
              h('div', { class: 'rule-keys', text: '比如：' + rule.keys.join('、') }),
              sel,
              rule.has
                ? h('span', { class: 'badge badge-ok', text: '有图' })
                : h('span', { class: 'badge badge-warn', text: '这组空的' }),
            ),
          );
        }
      }
      paintRules();

      // 试试一句话
      const tryInput = h('input', { class: 'input', type: 'text', placeholder: '输入一句她会回的话，比如：哈哈好耶' });
      const tryOut = h('div', { class: 'try-out' });

      async function runTry() {
        try {
          const res = await dsh.stickers.testPick(tryInput.value || '');
          if (!ctx.alive()) return;
          tryOut.textContent = '';
          if (!res.sticker) {
            tryOut.appendChild(h('div', { class: 'section-note', text: '挑不出图：' + (res.reason || '表情包是空的') }));
            return;
          }
          tryOut.appendChild(
            h(
              'div',
              { class: 'try-card' },
              h('img', { class: 'try-img', src: encodeURI(res.sticker.url), alt: res.sticker.name }),
              h(
                'div',
                { class: 'try-info' },
                h('div', { class: 'try-line', text: `情绪：${res.moodZh || '没看出来'} → 分组「${res.group}」` }),
                h('div', { class: 'try-sub', text: res.reason }),
                h('div', { class: 'try-sub', text: res.sticker.name }),
              ),
            ),
          );
        } catch (err) {
          toast(String(err.message || err), true);
        }
      }

      enabledToggle.addEventListener('change', async () => {
        try {
          auto = await dsh.stickers.saveAuto({ enabled: enabledToggle.checked });
          if (!ctx.alive()) return;
          toast(enabledToggle.checked ? '自动配图已打开' : '自动配图已关闭');
        } catch (err) {
          toast(String(err.message || err), true);
        }
      });

      stickerSection.appendChild(
        h(
          'div',
          { class: 'section-head' },
          h('div', null, autoStat),
          h(
            'div',
            { class: 'section-tools' },
            h(
              'label',
              { class: 'switch' },
              enabledToggle,
              h('span', { class: 'track' }),
            ),
            h('span', { class: 'field-hint', text: '自动配图' }),
          ),
        ),
      );

      stickerSection.appendChild(
        h(
          'div',
          { class: 'field' },
          h('div', { class: 'field-label', text: '配图概率' }),
          h(
            'div',
            { class: 'inline-row' },
            chanceInput,
            h('button', {
              class: 'btn btn-sm',
              type: 'button',
              text: '保存',
              onClick: async () => {
                try {
                  auto = await dsh.stickers.saveAuto({ chance: Number(chanceInput.value) });
                  if (!ctx.alive()) return;
                  chanceInput.value = String(auto.chance);
                  toast('概率改成 ' + Math.round(auto.chance * 100) + '%');
                } catch (err) {
                  toast(String(err.message || err), true);
                }
              },
            }),
          ),
          h('div', {
            class: 'field-hint',
            text: '每回一句话，有多大概率顺手带一张表情。0.2 = 大约五分之一。',
          }),
        ),
      );

      stickerSection.appendChild(
        h('div', { class: 'field' },
          h('div', { class: 'field-label', text: '什么情绪配哪一组' }),
          h('div', {
            class: 'field-hint',
            text: '她会先看自己回的那句话里有什么词，判断情绪，再从对应分组里随机挑一张。那组空了会自动往下一组找。',
          }),
          rulesBox,
        ),
      );

      stickerSection.appendChild(
        h('div', { class: 'field' },
          h('div', { class: 'field-label', text: '试试一句话' }),
          h('div', { class: 'inline-row' }, tryInput, h('button', { class: 'btn btn-sm', type: 'button', text: '挑一张看看', onClick: runTry })),
          tryOut,
        ),
      );

      stickerSection.appendChild(
        h('div', {
          class: 'section-note',
          text: '要改图片本身的分组（哪张图算「开心」），去「表情包」页点「管理」。这里管的是「什么时候用哪一组」。',
        }),
      );
    },
  };
})();

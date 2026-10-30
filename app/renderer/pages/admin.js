'use strict';

/**
 * 管理员页
 * ------------------------------------------------------------
 * 右下角齿轮（设置）上面那一格。集中放「谁是管理员」：
 *   - 管理员 QQ、B 站 UID、显示用的名字
 *   - 遥控电脑白名单（管理员自己永远可以）
 *   - 进入这一页要输密钥：第一次进来设一把，之后每次进来都要输
 *
 * 解锁状态只存在内存里（window.__adminUnlockedAt），
 * 离开这一页时 app.js 会把它清掉 —— 所以「每次进来都要重新输」。
 */
(function () {
  const PAGES = (window.DSHPages = window.DSHPages || {});

  const UNLOCK_MS = 30 * 60 * 1000;

  function isUnlocked() {
    return Date.now() - Number(window.__adminUnlockedAt || 0) < UNLOCK_MS;
  }

  function markUnlocked() {
    window.__adminUnlockedAt = Date.now();
  }

  PAGES.admin = {
    async render(root, ctx) {
      const { h, t, dsh, toast, openModal, refresh } = ctx;

      const section = (title, desc, children, right) =>
        h(
          'section',
          { class: 'section' },
          h(
            'div',
            { class: 'section-head' },
            h('div', null, h('div', { class: 'section-title', text: title }), desc ? h('div', { class: 'section-desc', text: desc }) : null),
            right ? h('div', { class: 'section-tools' }, right) : null,
          ),
          ...children,
        );

      const row = (label, hint, control) =>
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-main' }, h('div', { class: 'row-label', text: label }), hint ? h('div', { class: 'row-hint', text: hint }) : null),
          h('div', { class: 'row-ctrl is-field' }, control),
        );

      const keyBox = (text) => h('div', { class: 'key-box', text });

      // ---------------- 锁屏：已经有密钥，但这次还没解 ----------------
      function renderLocked(keyInfo) {
        const input = h('input', { class: 'input key-input', type: 'password', placeholder: '输入进入密钥' });
        const err = h('div', { class: 'field-hint', text: '' });
        const btn = h('button', { class: 'btn btn-primary', type: 'button', text: '进入' });

        async function submit() {
          const key = input.value;
          if (!key) return;
          btn.disabled = true;
          try {
            const r = await dsh.admin.keyVerify({ key });
            if (!ctx.alive()) return;
            if (r && r.ok) {
              markUnlocked();
              toast('欢迎回来');
              refresh();
              return;
            }
            err.textContent = (r && r.error) || '密钥不对';
            input.value = '';
            input.focus();
          } catch (e) {
            err.textContent = String((e && e.message) || e);
          } finally {
            btn.disabled = false;
          }
        }

        btn.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') submit();
        });

        const card = h(
          'div',
          { class: 'lock-card' },
          h('div', { class: 'lock-ico', text: '🔒' }),
          h('div', { class: 'lock-title', text: '这一页要密码' }),
          h('div', { class: 'lock-desc', text: '管理员的东西都在这儿：QQ、B 站账号、遥控白名单。每次进来都得重新输一次。' }),
          h('div', { class: 'lock-form' }, input, btn),
          err,
          h('div', { class: 'lock-foot', text: '忘了密钥的话，删掉 data\\admin-key.json 再重启软件，会重新让你设一把。' }),
        );

        root.appendChild(card);
        setTimeout(() => {
          try {
            input.focus();
          } catch (_) {}
        }, 60);
        return keyInfo;
      }

      // ---------------- 第一次：设密钥 ----------------
      function openSetup() {
        const randBox = h('div', { class: 'key-out' }, h('div', { class: 'key-hint', text: '还没生成。点下面「生成一把」看看。' }));
        const doneBtn = h('button', { class: 'btn btn-primary', type: 'button', text: '我已经记下来了', style: 'display:none' });
        let generated = '';

        const genBtn = h('button', { class: 'btn', type: 'button', text: '生成一把' });
        genBtn.addEventListener('click', () => {
          dsh.admin.keySetup({ mode: 'random' }).then((r) => {
            if (!ctx.alive()) return;
            if (!r || !r.ok) {
              toast((r && r.error) || '生成失败', true);
              return;
            }
            generated = r.key;
            randBox.textContent = '';
            randBox.appendChild(keyBox(generated));
            randBox.appendChild(h('div', { class: 'key-hint', text: '记到安全的地方（密码管理器、纸上都行）。这串只显示这一次，关了弹窗就找不回来了。' }));
            genBtn.style.display = 'none';
            doneBtn.style.display = '';
          }).catch((e) => toast(String(e.message || e), true));
        });

        doneBtn.addEventListener('click', () => {
          markUnlocked();
          close();
          toast('设好了，下次进来要输这个密钥');
          refresh();
        });

        const customInput = h('input', { class: 'input', type: 'text', placeholder: '自己设一把（6–15 位，含大小写字母和数字）' });
        const customErr = h('div', { class: 'field-hint', text: '只能用字母、数字、下划线；下划线最多一个。' });
        const customBtn = h('button', { class: 'btn btn-primary', type: 'button', text: '用这个' });
        customBtn.addEventListener('click', () => {
          if (!ctx.alive()) return;
          const key = customInput.value;
          const check = checkKey(key);
          if (!check.ok) {
            customErr.textContent = check.error;
            return;
          }
          dsh.admin.keySetup({ mode: 'custom', key }).then((r) => {
            if (!ctx.alive()) return;
            if (!r || !r.ok) {
              customErr.textContent = (r && r.error) || '没设成';
              return;
            }
            markUnlocked();
            close();
            toast('设好了，下次进来要输这个密钥');
            refresh();
          }).catch((e) => toast(String(e.message || e), true));
        });

        const body = h(
          'div',
          { class: 'key-setup' },
          h('div', { class: 'key-sec-title', text: '随机生成一把（推荐）' }),
          h('div', { class: 'key-sec-desc', text: '15 位，含大小写字母、数字，最多一个下划线。' }),
          h('div', { class: 'row-actions' }, genBtn, doneBtn),
          randBox,
          h('div', { class: 'key-sep' }),
          h('div', { class: 'key-sec-title', text: '或者自己设一把' }),
          h('div', { class: 'key-sec-desc', text: '长度 6–15，必须同时有大写、小写、数字。' }),
          customInput,
          customErr,
          h('div', { class: 'row-actions' }, customBtn),
        );

        const m = openModal({
          title: '第一次用管理员功能：先设一把密钥',
          desc: '以后每次点开「管理员」都要输它。忘了只能删 data\\admin-key.json 重设。',
          body,
        });
        function close() {
          if (m && typeof m.close === 'function') m.close();
          else if (m && m.remove) m.remove();
        }
        return m;
      }

      // 前端先校验一遍，省一次来回（后端还会再验一次）
      function checkKey(key) {
        const s = String(key || '');
        if (!s) return { ok: false, error: '密钥不能是空的' };
        if (s.length < 6 || s.length > 15) return { ok: false, error: '长度要在 6–15 位之间（现在是 ' + s.length + ' 位）' };
        if (!/^[A-Za-z0-9_]+$/.test(s)) return { ok: false, error: '只能用字母、数字和下划线' };
        if ((s.match(/_/g) || []).length > 1) return { ok: false, error: '下划线最多一个' };
        if (!/[A-Z]/.test(s)) return { ok: false, error: '至少要有一个大写字母' };
        if (!/[a-z]/.test(s)) return { ok: false, error: '至少要有一个小写字母' };
        if (!/[0-9]/.test(s)) return { ok: false, error: '至少要有一个数字' };
        return { ok: true };
      }

      const keyInfo = await dsh.admin.keyStatus();
      if (!ctx.alive()) return;

      if (!keyInfo.hasKey) {
        const sec = section(
          '还差一把钥匙',
          '这一页放的是「谁是管理员」。第一次进来先设一把密钥，以后每次进来都要输。',
          [h('div', { class: 'section-note', text: '设置过程中会弹一个窗口，可以随机生成，也可以自己写。' })],
        );
        const again = h('button', { class: 'btn btn-primary', type: 'button', text: '去设密钥', style: 'margin-top:12px' });
        again.addEventListener('click', () => openSetup());
        sec.appendChild(h('div', { class: 'row-actions' }, again));
        root.appendChild(sec);
        setTimeout(() => openSetup(), 120);
        return;
      }

      if (!isUnlocked()) {
        renderLocked(keyInfo);
        return;
      }

      // ---------------- 解锁后：内容 ----------------
      const info = await dsh.admin.info();
      if (!ctx.alive()) return;

      const qqInput = h('input', { class: 'input', type: 'text', value: info.qq || '', placeholder: '比如 10001' });
      const uidInput = h('input', { class: 'input', type: 'text', value: info.biliUid || '', placeholder: 'B 站 UID，例如 1122334455' });
      const nameInput = h('input', { class: 'input', type: 'text', value: info.biliName || '', placeholder: '自己认得出的名字' });
      const remoteInput = h('input', {
        class: 'input',
        type: 'text',
        value: ((info.remote && info.remote.allowed) || []).join('，'),
        placeholder: '除了管理员，还有谁的 QQ 可以指挥电脑（逗号隔开）',
      });

      async function saveAll(btn) {
        btn.disabled = true;
        try {
          await dsh.admin.save({ qq: qqInput.value.trim(), biliUid: uidInput.value.trim(), biliName: nameInput.value.trim(), remoteList: remoteInput.value });
          if (!ctx.alive()) return;
          toast('已保存');
          refresh();
        } catch (e) {
          toast(String((e && e.message) || e), true);
        } finally {
          btn.disabled = false;
        }
      }

      const saveBtn = h('button', { class: 'btn btn-primary', type: 'button', text: '保存', onClick: () => saveAll(saveBtn) });
      const saveBtn2 = h('button', { class: 'btn', type: 'button', text: '保存白名单', onClick: () => saveAll(saveBtn2) });

      const identity = section(
        '管理员身份',
        '这两个号是「谁是她主人」的唯一凭据：成长、关系、对外规矩的放行、遥控电脑的权限，全都认它。',
        [
          row('管理员 QQ', '你自己的 QQ 号。它永远在聊天白名单里，遥控电脑和对外规矩也拿它当管理员。', qqInput),
          row('B 站 UID', '你的 B 站 UID，私信只发给你。', uidInput),
          row('管理员用户名', '只影响界面显示，填个自己认得的就行。', nameInput),
          h('div', { class: 'row-actions' }, saveBtn),
        ],
      );
      root.appendChild(identity);

      root.appendChild(
        section(
          '遥控电脑白名单',
          '除管理员以外，还能用 QQ 指挥这台电脑的人。留空 = 只有管理员能。',
          [row('可以遥控的 QQ', '逗号隔开。遥控的设置（开不开、允不允许跑命令）在「模型 → 遥控电脑」里。', remoteInput), h('div', { class: 'row-actions' }, saveBtn2)],
        ),
      );

      // ---------------- 换密钥 ----------------
      const oldInput = h('input', { class: 'input', type: 'password', placeholder: '现在的密钥' });
      const newInput = h('input', { class: 'input', type: 'password', placeholder: '新密钥（6–15 位，含大小写和数字）' });
      const repInput = h('input', { class: 'input', type: 'password', placeholder: '再输一遍新密钥' });
      const changeMsg = h('div', { class: 'field-hint', text: '' });
      const changeBtn = h('button', { class: 'btn', type: 'button', text: '换密钥' });
      changeBtn.addEventListener('click', async () => {
        const check = checkKey(newInput.value);
        if (!check.ok) {
          changeMsg.textContent = check.error;
          return;
        }
        if (newInput.value !== repInput.value) {
          changeMsg.textContent = '两次输的新密钥不一样';
          return;
        }
        changeBtn.disabled = true;
        try {
          const r = await dsh.admin.keyChange({ oldKey: oldInput.value, newKey: newInput.value });
          if (!ctx.alive()) return;
          if (!r || !r.ok) {
            changeMsg.textContent = (r && r.error) || '没换成';
            return;
          }
          oldInput.value = '';
          newInput.value = '';
          repInput.value = '';
          changeMsg.textContent = '换好了，下次进来用新密钥。';
          toast('密钥已更换');
        } catch (e) {
          changeMsg.textContent = String((e && e.message) || e);
        } finally {
          changeBtn.disabled = false;
        }
      });

      const lockBtn = h('button', { class: 'btn', type: 'button', text: '现在就锁上' });
      lockBtn.addEventListener('click', () => {
        window.__adminUnlockedAt = 0;
        refresh();
      });

      const keySec = section(
        '进入密钥',
        '每次点开这一页都要输一次。换密钥要先验旧的。',
        [
          row('现在的密钥 → 新的', '新密钥规则：6–15 位，必须同时有大写字母、小写字母、数字。', h('div', { class: 'key-stack' }, oldInput, newInput, repInput)),
          h('div', { class: 'row-actions' }, changeBtn, lockBtn),
          changeMsg,
        ],
        h('span', { class: 'badge badge-ok', text: '已解锁' }),
      );
      root.appendChild(keySec);

      root.appendChild(
        section('还有哪些地方认这个管理员', '这些不用再填一遍，它们都直接读上面那个 QQ / UID。', [
          h('div', { class: 'section-note', text: '对外规矩（模型页）：只对管理员放行；遥控电脑（模型页）：管理员永远有权限；主动聊天、成长、关系：只算管理员的号。' }),
        ]),
      );
    },
  };
})();

'use strict';

/**
 * QQ 身份（插件示例 · 也是插件机制的实测）
 * ------------------------------------------------------------
 * 能做的事（都走 NapCat 的 OneBot 扩展接口）：
 *   改昵称   set_qq_profile { nickname }
 *   改签名   set_qq_profile { personal_note }
 *   换头像   set_qq_avatar  { file }
 *   发空间   优先用 NapCat 的登录态直连空间接口；不行再试 send_qzone_msg
 *
 * 谁能指挥她：本插件自己的白名单（留空 = 只有管理员 QQ 能）。
 * 触发方式：私聊她这些命令
 *   改名 <新名字>
 *   改签名 <新签名>
 *   换头像 <本机图片的完整路径>
 *   发说说 <内容>
 *   看看资料
 */

const CMDS = [
  { key: 'nickname', re: /^(?:帮我|帮忙|给我)?\s*(?:把)?(?:名字|昵称)?\s*(?:改|改一下|改成|换成|换|设为|设置成)(?:名字|昵称)?\s*(?:为|成)?\s*[:：]?\s*([\s\S]+)$/, label: '改昵称' },
  { key: 'nickname', re: /^(?:改|换)(?:名|昵称)\s*[:：]?\s*([\s\S]+)$/, label: '改昵称' },
  { key: 'sign', re: /^(?:帮我|帮忙|给我)?\s*(?:把)?(?:签名|简介|个签|个性签名)\s*(?:改|改成|换成|设为|设置成)\s*(?:为|成)?\s*[:：]?\s*([\s\S]+)$/, label: '改签名' },
  { key: 'sign', re: /^改(?:签名|简介|个签)\s*[:：]?\s*([\s\S]+)$/, label: '改签名' },
  { key: 'avatar', re: /^(?:帮我|帮忙|给我)?\s*(?:换|改|换一下)(?:个头像|头像)\s*(?:成|为)?\s*[:：]?\s*([\s\S]+)$/, label: '换头像' },
  { key: 'profile', re: /^(看看资料|我的资料|查询资料|你叫什么|看看你是谁|你是谁)$/, label: '看资料' },
  { key: 'help', re: /^(帮助|能做什么|会什么|命令)$/, label: '看能做什么' },
];

let ctxRef = null;
let lastResult = '还没试过。';

function cfg() {
  const c = (ctxRef.settings.get() || {}).who || {};
  return {
    allowed: Array.isArray(c.allowed) ? c.allowed.map(String) : [],
  };
}

function ownerQq() {
  try {
    return String(ctxRef.settings.getGlobal('channels.qq.ownerQq') || '');
  } catch (_) {
    return '';
  }
}

function canUse(userId) {
  const id = String(userId || '');
  if (!id) return false;
  if (id === ownerQq()) return true;
  return cfg().allowed.includes(id);
}

async function say(userId, text) {
  try {
    await ctxRef.qq.sendPrivate(userId, text);
  } catch (err) {
    ctxRef.log.warn('回消息失败：' + (err && err.message ? err.message : err));
  }
}

async function callAction(action, params) {
  try {
    const res = await ctxRef.qq.call(action, params || {});
    if (res && res.status === 'failed') {
      return { ok: false, message: (res.message || (res.data && res.data.message) || '被拒绝了') };
    }
    return { ok: true, message: '好了' };
  } catch (err) {
    return { ok: false, message: String((err && err.message) || err) };
  }
}

async function run(cmd, arg, userId) {
  if (cmd === 'help') {
    return {
      ok: true,
      message: [
        '我能做的：',
        '· 改名字：说「名字改成鲸鱼娘」或「改名 鲸鱼娘」',
        '· 改签名：说「签名改成 今天也在努力」',
        '· 换头像：说「换头像 C:\\图片\\某个.gif」（给本机完整路径）',
        '· 发说说：说「发说说 今天天气不错」',
        '· 问问我是谁：「你叫什么」',
      ].join('\n'),
    };
  }

  if (cmd === 'profile') {
    try {
      const res = await ctxRef.qq.call('get_login_info', {});
      const d = res || {};
      return {
        ok: true,
        message: '我现在叫 ' + (d.nickname || d.nick || '？') + '（QQ ' + (d.user_id || d.uin || userId) + '）',
      };
    } catch (err) {
      return { ok: false, message: '查不到资料：' + String((err && err.message) || err) };
    }
  }

  if (cmd === 'nickname') {
    const r = await callAction('set_qq_profile', { nickname: arg });
    return { ok: r.ok, message: r.ok ? '名字换了，现在叫「' + arg + '」' : '改名没成功：' + r.message };
  }

  if (cmd === 'sign') {
    const r = await callAction('set_qq_profile', { personal_note: arg });
    return { ok: r.ok, message: r.ok ? '签名换成「' + arg + '」了' : '改签名没成功：' + r.message };
  }

  if (cmd === 'avatar') {
    const file = /^[a-zA-Z]:\\/.test(arg) ? 'file:///' + arg.replace(/\\/g, '/') : arg;
    const r = await callAction('set_qq_avatar', { file });
    return { ok: r.ok, message: r.ok ? '头像换了' : '换头像没成功：' + r.message };
  }

  if (cmd === 'qzone') {
    // 走本体统一的「发说说」：先试直连空间接口，不行再让 NapCat 自己发
    let text = String(arg || '').trim();
    try {
      if (!text) text = await ctxRef.qzone.compose();
      const r = await ctxRef.qzone.publish(text);
      const preview = text.length > 40 ? text.slice(0, 40) + '…' : text;
      return { ok: true, message: '说说发了：「' + preview + '」' };
    } catch (err) {
      return { ok: false, message: '空间没发出去：' + String((err && err.message) || err) };
    }
  }

  return { ok: false, message: '没听懂' };
}

module.exports = {
  activate(ctx) {
    ctxRef = ctx;

    ctx.handle('state', () => {
      const c = cfg();
      return {
        values: { allowed: c.allowed, sayText: (ctx.settings.get() || {}).sayText || '', owner: ownerQq() || '（还没在「通道」里填管理员 QQ）' },
        note: '最近一次：' + lastResult,
      };
    });

    ctx.handle('set', ({ key, value }) => {
      if (key === 'sayText') {
        ctx.settings.patch({ sayText: String(value || '') });
        return { ok: true, message: '记下了，点「发这条说说」就发出去' };
      }
      if (key === 'allowed') {
        const list = (Array.isArray(value) ? value : String(value || '').split(/[,，\s]+/))
          .map((s) => String(s).replace(/\D/g, ''))
          .filter(Boolean);
        ctx.settings.patch({ who: { allowed: list } });
        ctx.log.info('白名单更新：' + (list.join(',') || '（空）'));
        return { ok: true };
      }
      return { ok: false, message: '没有这个设置项：' + key };
    });

    ctx.handle('action', async ({ key }) => {
      if (key === 'qzone') {
        const bag = ctx.settings.get() || {};
        const text = String((bag.sayText || (bag.values && bag.values.sayText) || '')).trim();
        if (!text) return { ok: false, message: '先在下面那个框里写点内容' };
        try {
          const r = await ctx.qq.zone(text);
          lastResult = r && r.ok ? '✅ 说说发了' : '❌ 说说没发出去';
          return { ok: !!(r && r.ok), message: (r && r.message) || '发出去了' };
        } catch (e) {
          lastResult = '❌ 说说没发出去';
          return { ok: false, message: (e && e.message) || '没发出去' };
        }
      }
      if (key === 'test') {
        const st = ctx.qq.status();
        const online = typeof st === 'string' ? st : st && st.status;
        return {
          ok: online === 'online',
          message: online === 'online' ? 'QQ 连着：' + (st.selfName || '') : 'QQ 没连上，先去「通道」连接',
        };
      }
      if (key === 'profile') {
        const r = await run('profile', '', ownerQq());
        lastResult = (r.ok ? '✅ ' : '❌ ') + '看资料：' + r.message;
        return { ok: r.ok, message: r.message };
      }
      if (key === 'selftest') {
        // 自检：查一次资料，再用她现在的名字"改"一次（改回原名，看不出变化，只验证接口通不通）
        const me = await ctx.qq.call('get_login_info', {});
        const nick = (me && (me.nickname || me.nick)) || '食蜂操祈';
        try {
          await ctx.qq.call('set_qq_profile', { nickname: nick });
          const msg = '接口通了：查到你叫「' + nick + '」，改名接口也接受了（改回原名，看不出变化）';
          lastResult = '✅ 自检：' + msg;
          return { ok: true, message: msg };
        } catch (err) {
          const msg = '改名接口失败了：' + String((err && err.message) || err);
          lastResult = '❌ 自检：' + msg;
          return { ok: false, message: msg };
        }
      }
      if (key === 'reset') {
        lastResult = '已清空记录。';
        return { ok: true, message: '清空好了' };
      }
      return { ok: false, message: '没有这个动作：' + key };
    });

    ctx.onMessage(async (event, text) => {
      if (!event || event.message_type !== 'private') return false;
      const userId = String(event.user_id || '');
      if (!canUse(userId)) return false;

      const body = String(text || '').trim();

      // 「发说说 / 发个空间 / 发一下 QQ空间 ……」先说这条：说法很多，交给本体统一判断
      const zi = ctxRef.qzone.detect(body);
      if (zi) {
        event.__handled = true;
        const r = await run('qzone', zi.body, userId);
        lastResult = (r.ok ? '✅ ' : '❌ ') + '发说说：' + r.message;
        ctx.log.info(lastResult);
        await say(userId, r.message);
        return true;
      }

      for (const c of CMDS) {
        const m = body.match(c.re);
        if (!m) continue;
        // 同步就打上标记，避免本体再回复一遍（插件自己回）
        event.__handled = true;
        const arg = m[1] === undefined ? '' : String(m[1]).trim();
        const r = await run(c.key, arg, userId);
        lastResult = (r.ok ? '✅ ' : '❌ ') + c.label + '：' + r.message;
        ctx.log.info(lastResult);
        await say(userId, r.message);
        return true; // 这条我处理了
      }
      return false;
    });

    ctx.registerSection({
      id: 'qq-identity',
      pageId: 'channels',
      order: 60,
      title: '她自己的 QQ（插件）',
      desc: '插件 qq-identity：让她能改自己的头像 / 昵称 / 签名、发 QQ 空间。下面填「谁能指挥她」。',
      fields: [
        {
          key: 'allowed',
          type: 'list',
          label: '白名单（谁可以让她改）',
          hint: '填 QQ 号，用逗号或换行分开。管理员 QQ 永远可以用；这里留空 = 只有管理员能。',
          placeholder: '例如：123456789，987654321',
        },
        {
          key: 'sayText',
          type: 'textarea',
          label: '现在发一条说说',
          hint: '写好点下面「发这条说说」。不用开浏览器、不用登录，用的是她自己的 QQ 登录态。',
          placeholder: '例如：今天的风很好，尾巴摇得很开心～',
        },
      ],
      actions: [
        { key: 'qzone', label: '发这条说说', type: 'primary' },
        { key: 'test', label: '试试能不能用' },
        { key: 'profile', label: '看看她现在的资料' },
        { key: 'selftest', label: '自检（改回原名）' },
        { key: 'reset', label: '清空最近记录' },
      ],
    });

    ctx.registerTool({ id: 'qq-identity.profile', name: '改她的 QQ 资料 / 发说说' });
    ctx.log.info('QQ 身份插件已就绪（命令：改名 / 改签名 / 换头像 / 发说说 / 看看资料）');
  },

  deactivate() {
    ctxRef = null;
  },
};

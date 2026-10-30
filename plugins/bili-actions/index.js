'use strict';

/**
 * B站 操作插件
 * 让她能：关注 / 取关 / 拉黑 / 解除拉黑 UP，改自己的名字和简介，
 * 给视频点赞、取消点赞、投币，（尽力）举报。
 *
 * 听懂人话：先按关键词猜（快、不花钱），猜不出来再问模型（慢、要联网）。
 * 谁能指挥她：管理员 QQ 永远可以；外加本插件自己的白名单。
 */

const PLUGIN_ID = 'bili-actions';

const API = {
  relation: 'https://api.bilibili.com/x/relation/modify',
  profile: 'https://api.bilibili.com/x/member/web/update',
  sign: 'https://api.bilibili.com/x/member/web/sign/update',
  like: 'https://api.bilibili.com/x/web-interface/archive/like',
  coin: 'https://api.bilibili.com/x/web-interface/coin/add',
  report: 'https://api.bilibili.com/x/web-interface/report',
  searchUser: 'https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&page=1&page_size=8&keyword=',
};

const ACT = { follow: 1, unfollow: 2, block: 5, unblock: 6 };

let ctx = null;
let store = { allowed: [], log: [], tryCmd: '' };

// ---------------------------------------------------------------- 存储

function load() {
  const bag = ctx.settings.get() || {};
  const who = bag.who || {};
  store = {
    allowed: Array.isArray(who.allowed) ? who.allowed.map(String) : [],
    log: Array.isArray(bag.log) ? bag.log.slice(0, 20) : [],
    tryCmd: String(bag.tryCmd || ''),
  };
}

function save() {
  ctx.settings.patch({ who: { allowed: store.allowed }, log: store.log.slice(0, 20), tryCmd: store.tryCmd });
}

function note(text) {
  store.log = [{ at: Date.now(), text: String(text || '') }, ...store.log].slice(0, 20);
  save();
}

function ownerQq() {
  const v = ctx.settings.getGlobal('channels.qq.ownerQq');
  return v ? String(v) : '';
}

function canUse(userId) {
  const id = String(userId || '');
  if (!id) return false;
  if (ownerQq() && id === ownerQq()) return true;
  return store.allowed.includes(id);
}

// ---------------------------------------------------------------- 听懂人话（规则层）

function clean(text) {
  return String(text || '').replace(/[\s，。！？、,.!?~～…]/g, '');
}

function findMid(text) {
  const t = String(text || '');
  const url = t.match(/space\.bilibili\.com\/(\d+)/i);
  if (url) return url[1];
  const mid = t.match(/(\d{3,})/);
  if (mid) return mid[1];
  return '';
}

function findBv(text) {
  const m = String(text || '').match(/BV[0-9A-Za-z]{10}/);
  return m ? m[0] : '';
}

function stripVerbs(text, verbs) {
  let t = String(text || '').trim();
  verbs.forEach((v) => {
    t = t.split(v).join(' ');
  });
  t = t.replace(/[，。！？、,.!?~～…]/g, ' ');
  t = t.replace(/(帮我|帮忙|给我|请|把|将|我的|你的|一下|吧|呗|呀|啊|了|现在|名字|昵称)/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * 规则解析：返回 { action, arg, extra } 或 null
 * action: follow / unfollow / block / unblock / like / unlike / coin / report / uname / sign / who / help
 */
function parseByRules(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const t = clean(raw);
  const bv = findBv(raw);
  const mid = findMid(raw);

  if (/取消关注|取关|别关注|不想关注|不关注了/.test(t)) {
    return { action: 'unfollow', arg: mid || stripVerbs(raw, ['取消关注', '取关', '别关注', '不想关注', '不关注了']) };
  }
  if (/解除拉黑|取消拉黑|放出来|别拉黑/.test(t)) {
    return { action: 'unblock', arg: mid || stripVerbs(raw, ['解除拉黑', '取消拉黑', '放出来', '别拉黑']) };
  }
  if (/取消点赞|取消赞|把赞取消|别赞了/.test(t)) return { action: 'unlike', arg: bv };
  if (/拉黑|屏蔽|黑名单/.test(t)) return { action: 'block', arg: mid || stripVerbs(raw, ['拉黑', '屏蔽', '黑名单']) };
  if (/举报|投诉/.test(t)) return { action: 'report', arg: bv, extra: raw };
  if (/投币|投个币|投个硬币|硬币/.test(t)) return { action: 'coin', arg: bv };
  if (/点赞|赞一下|点个赞|三连/.test(t)) return { action: 'like', arg: bv };
  if (/改简介|改签名|签名改成|简介改成|换个简介|换个签名|个签/.test(t)) {
    return {
      action: 'sign',
      arg: stripVerbs(raw, ['改简介', '改签名', '签名改成', '简介改成', '换个简介', '换个签名', '个签', '改成', '改为']),
    };
  }
  if (/改名字|改名|昵称改成|名字改成|换个名字|叫我/.test(t)) {
    return {
      action: 'uname',
      arg: stripVerbs(raw, ['改名字', '改名', '昵称改成', '名字改成', '换个名字', '叫我', '改成', '改为']),
    };
  }
  if (/看看账号|我是谁|账号信息|你叫啥|你叫什么/.test(t)) return { action: 'who' };
  if (/关注/.test(t)) return { action: 'follow', arg: mid || stripVerbs(raw, ['关注一下', '关注']) };
  if (/能(做|干)什么|帮助|怎么用|命令/.test(t)) return { action: 'help' };
  return null;
}

/** 大概是不是在说 B 站的事（决定要不要花模型的钱） */
function looksBili(text) {
  return /关注|取关|拉黑|屏蔽|简介|签名|改名|名字|昵称|点赞|赞|投币|硬币|举报|投诉|BV|B站|b站|up主|UP主|账号/i.test(
    String(text || '')
  );
}

// ---------------------------------------------------------------- 听懂人话（模型层）

const NLU_SYSTEM = `你在帮一个 B 站操作助手理解用户的话。把用户的话翻译成一个 JSON，不要多余文字。
可选 action：
- follow 关注某人, unfollow 取关, block 拉黑, unblock 解除拉黑 （需要 mid：纯数字 UID）
- like 点赞视频, unlike 取消点赞, coin 投币, report 举报 （需要 bv：形如 BV1xxxxxxxxx）
- uname 改她自己的昵称, sign 改她自己的简介 （需要 text：新内容）
- who 询问账号信息, help 看能做什么, none 与 B 站无关
输出格式：{"action":"follow","mid":"123456"} / {"action":"like","bv":"BV1chxT6xEyo"} / {"action":"uname","text":"新名字"} / {"action":"none"}
只输出 JSON。`;

async function parseByModel(text) {
  try {
    const out = await ctx.ai.chat(
      [
        { role: 'system', content: NLU_SYSTEM },
        { role: 'user', content: String(text || '').slice(0, 300) },
      ],
      { temperature: 0, maxTokens: 120, timeoutMs: 20000 }
    );
    const m = String(out || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (!j || !j.action || j.action === 'none') return null;
    const arg = j.mid || j.bv || j.text || '';
    return { action: String(j.action), arg: String(arg), byModel: true };
  } catch (err) {
    ctx.log.warn('模型没解析成功：' + String((err && err.message) || err));
    return null;
  }
}

// ---------------------------------------------------------------- 动作

async function userOf(who) {
  const raw = String(who || '').trim();
  if (!raw) return { ok: false, message: '你没说是谁：给我 UID 数字，或者 UP 的名字' };
  if (/^\d+$/.test(raw)) return { ok: true, mid: raw, name: '' };
  try {
    const j = await ctx.bili.get(API.searchUser + encodeURIComponent(raw));
    const list = (j && j.data && j.data.result) || [];
    if (!list.length) return { ok: false, message: '搜不到「' + raw + '」这个 UP，直接给我 UID 数字吧' };
    const first = list[0];
    return { ok: true, mid: String(first.mid), name: String(first.uname || '').replace(/<[^>]+>/g, '') };
  } catch (err) {
    return { ok: false, message: '按名字搜被 B 站拦了，直接给我 UID 数字更快' };
  }
}

async function setRelation(who, act, verb) {
  const r = await userOf(who);
  if (!r.ok) return r.message;
  const res = await ctx.bili.post(API.relation, { fid: r.mid, act, re_src: 11 });
  if (!res.ok) return verb + '失败：' + res.message;
  const who2 = r.name ? '「' + r.name + '」' : 'UID ' + r.mid;
  note(verb + ' ' + who2);
  return '好，已经' + verb + ' ' + who2;
}

async function whoami() {
  try {
    const me = await ctx.bili.me();
    if (!me.ok) return { ok: false, message: me.message };
    return { ok: true, uname: me.uname, mid: me.mid };
  } catch (err) {
    return { ok: false, message: String((err && err.message) || err) };
  }
}

async function doLike(bv, on) {
  if (!bv) return '给我一个 BV 号（视频链接里 BV 开头那串）';
  const res = await ctx.bili.post(API.like, { bvid: bv, like: on ? 1 : 2 });
  if (!res.ok) return (on ? '点赞' : '取消点赞') + '失败：' + res.message;
  note((on ? '点赞 ' : '取消点赞 ') + bv);
  return (on ? '点赞了 ' : '取消了点赞 ') + bv;
}

async function doCoin(bv) {
  if (!bv) return '给我一个 BV 号';
  const res = await ctx.bili.post(API.coin, { bvid: bv, multiply: 1, select_like: 1 });
  if (!res.ok) {
    if (/账号异常|风控|risk/i.test(res.message)) return '投币被拦了：B 站把这个号当异常账号（新号常这样），过几天或实名之后才行';
    if (res.code === -403) return '投币失败：这个号没币，或者没做过手机号/实名验证';
    return '投币失败：' + res.message;
  }
  note('投币 ' + bv);
  return '投了一个币给 ' + bv;
}

async function doReport(bv, raw) {
  if (!bv) return '给我一个 BV 号';
  const reason = String(raw || '').replace(bv, '').replace(/举报|投诉|一下|这个|视频/g, '').trim() || '其他';
  const res = await ctx.bili.post(API.report, { bvid: bv, reason_type: 1, content: reason });
  if (!res.ok) return '举报要用的接口 B 站没公开（返回：' + res.message + '），我先记下这条，等有接口再做';
  note('举报 ' + bv);
  return '已提交举报：' + bv;
}

async function setUname(name) {
  const v = String(name || '').trim().slice(0, 20);
  if (!v) return '你想让我叫什么？把新名字告诉我';
  const res = await ctx.bili.post(API.profile, { uname: v });
  if (!res.ok) {
    if (res.code === 40007) return '改名需要 6 个硬币，这个号硬币不够（投币/签到攒一攒再来）';
    if (res.code === 40014) return '「' + v + '」这个名字被人占了，换一个';
    if (res.code === 40004) return '昵称里不能有特殊符号（除了 - 和 _）';
    return '改名失败：' + res.message;
  }
  note('改名 → ' + v);
  return '名字改好了：' + v;
}

async function setSign(text) {
  const v = String(text || '').trim().slice(0, 80);
  if (!v) return '简介想写什么？';
  const res = await ctx.bili.post(API.sign, { usersign: v });
  if (!res.ok) return '改简介失败：' + res.message;
  note('改简介 → ' + v);
  return '简介改好了：' + v;
}

const HELP = [
  '我能干的：',
  '· 关注 / 取关 / 拉黑 / 解除拉黑 某个 UP（给我 UID 最准）',
  '· 改名字、改简介',
  '· 给视频点赞 / 取消点赞 / 投币',
  '· 举报视频（B 站可能没接口）',
  '· 问问「你的账号是什么」',
  '说人话也行，我听不懂会去问模型再猜一次。',
].join('\n');

async function execute(parsed) {
  if (!parsed) return '';
  switch (parsed.action) {
    case 'follow':
      return setRelation(parsed.arg, ACT.follow, '关注了');
    case 'unfollow':
      return setRelation(parsed.arg, ACT.unfollow, '取消关注了');
    case 'block':
      return setRelation(parsed.arg, ACT.block, '拉黑了');
    case 'unblock':
      return setRelation(parsed.arg, ACT.unblock, '解除拉黑了');
    case 'like':
      return doLike(parsed.arg, true);
    case 'unlike':
      return doLike(parsed.arg, false);
    case 'coin':
      return doCoin(parsed.arg);
    case 'report':
      return doReport(parsed.arg, parsed.extra);
    case 'uname':
      return setUname(parsed.arg);
    case 'sign':
      return setSign(parsed.arg);
    case 'who': {
      const me = await whoami();
      return me.ok ? '我是 ' + me.uname + '（UID ' + me.mid + '）' : 'B 站这边没登录：' + me.message;
    }
    case 'help':
      return HELP;
    default:
      return '';
  }
}

/** 主入口：先规则、再模型 */
async function handleCommand(text) {
  const byRules = parseByRules(text);
  if (byRules) return execute(byRules);
  if (!looksBili(text)) return '';
  const byModel = await parseByModel(text);
  if (byModel) return execute(byModel);
  return '这句我没听明白。会说「关注 12345678」「点赞 BV1chxT6xEyo」「改名字 鲸鱼娘」这种，或者直接问我能干嘛。';
}

// ---------------------------------------------------------------- 插件钩子

module.exports = {
  activate(c) {
    ctx = c;
    load();

    c.onMessage(async (event, text) => {
      const userId = String((event && event.user_id) || '');
      if (!canUse(userId)) return false;
      const quick = parseByRules(text);
      if (!quick && !looksBili(text)) return false;
      event.__handled = true;

      let reply = '';
      try {
        reply = await handleCommand(text);
      } catch (err) {
        reply = '出错了：' + String((err && err.message) || err);
      }
      if (!reply) return false;
      try {
        await ctx.qq.sendPrivate(userId, reply);
      } catch (err) {
        ctx.log.warn('回复失败：' + String((err && err.message) || err));
      }
      return true;
    });

    c.handle('state', () => ({
      values: { allowed: store.allowed, tryCmd: store.tryCmd },
      note: store.log.length ? '最近一次：' + store.log[0].text : '还没动过手。',
    }));

    c.handle('set', ({ key, value } = {}) => {
      if (key === 'tryCmd') {
        store.tryCmd = String(value || '');
        save();
      }
      if (key === 'allowed') {
        store.allowed = (Array.isArray(value) ? value : []).map((v) => String(v).replace(/\D/g, '')).filter(Boolean);
        save();
      }
      return { ok: true };
    });

    c.handle('action', async ({ key } = {}) => {
      if (key === 'test') {
        const me = await whoami();
        return me.ok
          ? { ok: true, message: 'B 站账上是 ' + me.uname + '（UID ' + me.mid + '）' }
          : { ok: false, message: 'B 站没登录：' + me.message };
      }
      if (key === 'profile') {
        const me = await whoami();
        return me.ok ? { ok: true, message: me.uname + '（UID ' + me.mid + '）' } : { ok: false, message: '没登录：' + me.message };
      }
      if (key === 'selftest') {
        const me = await whoami();
        if (!me.ok) return { ok: false, message: '读不到账号，登录态可能过期了' };
        const res = await ctx.bili.post(API.profile, { uname: me.uname });
        if (!res.ok) return { ok: false, message: '写接口不通：' + res.message };
        note('自检：改名接口通过');
        return { ok: true, message: '写接口通了：用原名「' + me.uname + '」写了一次，没改内容' };
      }
      if (key === 'runTry') {
        const text = String(store.tryCmd || '').trim();
        if (!text) return { ok: false, message: '上面那格是空的，先写一句话' };
        let parsed = parseByRules(text);
        let via = '按关键词';
        if (!parsed) {
          parsed = await parseByModel(text);
          via = '问模型';
        }
        if (!parsed) return { ok: false, message: '这句我没听懂（规则和模型都没解析出来）' };
        const reply = await execute(parsed);
        note('试命令：' + text + ' → ' + parsed.action + (parsed.arg ? ' ' + parsed.arg : ''));
        return { ok: true, message: '[' + via + '认出是 ' + parsed.action + '] ' + reply };
      }
      if (key === 'help') return { ok: true, message: HELP };
      if (key === 'reset') {
        store.log = [];
        save();
        return { ok: true, message: '记录清空了' };
      }
      return { ok: false, message: '不认识的按钮：' + key };
    });

    c.registerSection({
      id: 'bili-actions-main',
      pageId: 'channels',
      order: 61,
      title: '她自己的 B 站（插件）',
      desc: '插件 ' + PLUGIN_ID + '：关注/拉黑 UP、改名字和简介、点赞投币。说人话也行，听不懂她会去问模型。',
      fields: [
        {
          key: 'tryCmd',
          type: 'text',
          label: '在这里试一句话',
          hint: '说人话就行：把我关注一下那个 12345678 / 给 BV1chxT6xEyo 点个赞 / 名字改成鲸鱼娘',
        },
        {
          key: 'allowed',
          type: 'list',
          label: '白名单（谁可以让她动 B 站）',
          hint: '填 QQ 号，用逗号或换行分开。管理员 QQ 永远可以用；这里留空 = 只有管理员能。',
        },
      ],
      actions: [
        { key: 'test', label: '试试能不能用', primary: true },
        { key: 'profile', label: '看看她现在的资料' },
        { key: 'selftest', label: '自检（写一次原名）' },
        { key: 'runTry', label: '跑一下这条' },
        { key: 'help', label: '她会哪些命令' },
        { key: 'reset', label: '清空最近记录' },
      ],
    });

    c.log.info('B站操作插件已就绪（规则 + 模型兜底）');
  },

  deactivate() {
    ctx = null;
  },
};

/* 英文补充 10：管理员页 + 模型/记忆/总览/养成 补漏
 * ------------------------------------------------------------
 * en.js 负责整页翻译，这里把巡检发现的漏网中文按原文对上英文。
 * 键必须和代码里的中文一字不差（en.js 是整段匹配，不做模糊）。
 */
(function () {
  if (!window.__EN_DICT) return;
  const dict = window.__EN_DICT;

  Object.assign(dict.MAP, {
    // ---------------- 管理员：锁屏 ----------------
    进入: 'Enter',
    '输入进入密钥': 'Enter the access key',
    '这一页要密码': 'This page needs the key',
    '管理员的东西都在这儿：QQ、B 站账号、遥控白名单。每次进来都得重新输一次。':
      'Admin stuff lives here: QQ, Bilibili account, remote allowlist. You re-enter the key on every visit.',
    '忘了密钥的话，删掉 data\\admin-key.json 再重启软件，会重新让你设一把。':
      'Forgot the key? Delete data\\admin-key.json and restart to set a new one.',
    欢迎回来: 'Welcome back',
    密钥不对: 'Wrong key',

    // ---------------- 管理员：第一次设密钥 ----------------
    '设置过程中会弹一个窗口，可以随机生成，也可以自己写。':
      'A dialog opens: generate one randomly or write your own.',
    去设密钥: 'Set the key',
    '还没生成。点下面「生成一把」看看。': 'Not generated yet — hit “Generate one” below.',
    生成一把: 'Generate one',
    我已经记下来了: 'I wrote it down',
    '记到安全的地方（密码管理器、纸上都行）。这串只显示这一次，关了弹窗就找不回来了。':
      'Store it somewhere safe (password manager or paper). It is shown only once — close the dialog and it is gone.',
    '设好了，下次进来要输这个密钥': 'Key set — you will need it next time',
    '自己设一把（6–15 位，含大小写字母和数字）': 'Write your own (6–15 chars, letters + digits)',
    '只能用字母、数字、下划线；下划线最多一个。': 'Letters, digits, underscore only; at most one underscore.',
    用这个: 'Use this',
    没设成: 'Not set',
    '随机生成一把（推荐）': 'Generate a random one (recommended)',
    '15 位，含大小写字母、数字，最多一个下划线。': '15 chars with letters and digits, at most one underscore.',
    或者自己设一把: 'Or write your own',
    '长度 6–15，必须同时有大写、小写、数字。': '6–15 chars; must mix upper, lower and digits.',
    '第一次用管理员功能：先设一把密钥': 'First time: set an admin key',
    '以后每次点开「管理员」都要输它。忘了只能删 data\\admin-key.json 重设。':
      'You will need it every time you open Admin. Forgot it? Delete data\\admin-key.json and set a new one.',
    生成失败: 'Failed to generate',

    // 密钥规则（前后端共用）
    密钥不能是空的: 'Key cannot be empty',
    '只能用字母、数字和下划线': 'Letters, digits and underscore only',
    下划线最多一个: 'At most one underscore',
    至少要有一个大写字母: 'At least one uppercase letter',
    至少要有一个小写字母: 'At least one lowercase letter',
    至少要有一个数字: 'At least one digit',
    '错了太多次，等 30 秒再试': 'Too many wrong tries — wait 30s',
    '已经设过密钥了，直接输密钥进就行（要换的话在页面里改）':
      'A key is already set — just enter it (change it on this page if needed)',
    还没设过密钥: 'No key set yet',

    // ---------------- 管理员：解锁后 ----------------
    管理员身份: 'Owner identity',
    '这两个号是「谁是她主人」的唯一凭据：成长、关系、对外规矩的放行、遥控电脑的权限，全都认它。':
      'These two IDs are the only proof of who owns her: growth, bonds, guard exemptions and remote control all look them up.',
    管理员QQ: 'Owner QQ',
    '管理员 QQ': 'Owner QQ',
    '你自己的 QQ 号。它永远在聊天白名单里，遥控电脑和对外规矩也拿它当管理员。':
      'Your own QQ. Always allow-listed; remote control and the guard treat it as the owner.',
    'B 站 UID': 'Bilibili UID',
    '你的 B 站 UID，私信只发给你。': 'Your Bilibili UID — DMs go only there.',
    管理员用户名: 'Owner name',
    '只影响界面显示，填个自己认得的就行。': 'Display only — pick something you recognize.',
    遥控电脑白名单: 'Remote-control allowlist',
    '除管理员以外，还能用 QQ 指挥这台电脑的人。留空 = 只有管理员能。':
      'Besides the owner, who may drive this PC over QQ. Empty = owner only.',
    可以遥控的QQ: 'QQ numbers allowed to drive it',
    '可以遥控的 QQ': 'QQ numbers allowed to drive it',
    '逗号隔开。遥控的设置（开不开、允不允许跑命令）在「模型 → 遥控电脑」里。':
      'Comma-separated. Remote settings (on/off, run-command permission) live under Model → Remote.',
    保存白名单: 'Save allowlist',
    进入密钥: 'Access key',
    '每次点开这一页都要输一次。换密钥要先验旧的。': 'Required every time you open this page. Changing it verifies the old one first.',
    已解锁: 'Unlocked',
    '现在的密钥 → 新的': 'Current key → new',
    '新密钥规则：6–15 位，必须同时有大写字母、小写字母、数字。': 'New key rules: 6–15 chars, must include upper, lower and digits.',
    换密钥: 'Change key',
    现在就锁上: 'Lock now',
    '比如 10001': 'e.g. 10001',
    'B 站 UID，例如 1122334455': 'Bilibili UID, e.g. 1122334455',
    自己认得出的名字: 'A name you recognize',
    '除了管理员，还有谁的 QQ 可以指挥电脑（逗号隔开）': 'Other QQ numbers that may drive this PC (comma-separated)',
    现在的密钥: 'Current key',
    '新密钥（6–15 位，含大小写和数字）': 'New key (6–15 chars, letters + digits)',
    再输一遍新密钥: 'Repeat the new key',
    '两次输的新密钥不一样': 'The two new keys do not match',
    没换成: 'Not changed',
    '换好了，下次进来用新密钥。': 'Changed — use the new key next time.',
    密钥已更换: 'Key changed',
    还有哪些地方认这个管理员: 'Where else the owner is recognized',
    '这些不用再填一遍，它们都直接读上面那个 QQ / UID。': 'No need to fill these again — they all read the QQ / UID above.',
    '对外规矩（模型页）：只对管理员放行；遥控电脑（模型页）：管理员永远有权限；主动聊天、成长、关系：只算管理员的号。':
      'Guard (Model): owner-only exemptions; Remote (Model): the owner always has rights; proactive chat, growth, bonds: only the owner counts.',

    // ---------------- 模型：记忆向量 ----------------
    还没有向量: 'No vectors yet',
    '本机 Ollama · qwen2.5:0.5b（免费）': 'Ollama local · qwen2.5:0.5b (free)',
    'DeepSeek 云端 · deepseek-chat': 'DeepSeek cloud · deepseek-chat',

    // ---------------- 记忆：作息 ----------------
    后半夜: 'After midnight',
    清晨: 'Dawn',
    上午: 'Morning',
    中午: 'Noon',
    下午: 'Afternoon',
    晚上: 'Evening',
    深夜: 'Late night',
    '困到不行，脑子转得慢': 'dead tired, slow brain',
    '刚醒，还有点迷糊': 'just woke up, still groggy',
    精神不错: 'in good spirits',
    '有点饿，想着吃什么': 'a bit hungry, thinking about food',
    一天里最活跃: 'most energetic of the day',
    放松下来: 'relaxed',
    有点困但舍不得睡: 'sleepy but not ready for bed',
    '句子短，容易打错字，想睡觉': 'short sentences, typos, wants to sleep',
    '慢半拍，会赖床，说话软': 'a beat slow, lingers in bed, talks softly',
    愿意多聊两句: 'happy to chat more',
    容易把话题拐到吃的: 'steers talk toward food',
    '话最多，愿意主动找话题': 'talkative, starts topics',
    '说话随意，会撒娇': 'casual, a little clingy',
    '话变少，句子变短': 'fewer words, shorter sentences',

    // ---------------- 总览：一键启动状态 ----------------
    重新启动: 'Restart',
    聊天: 'Chat',
    主动找你: 'Reaches out to you',
    '还没填 NapCat 启动程序，去「通道」页选一次': 'NapCat launcher not set — pick it on the Channels page',
    '已经开着，重新拉一次让它挂上钩子': 'Already running; relaunching to attach',
    'QQ 还没登录 —— 在下面扫码，扫完会自动接着连，不用再点一次':
      'QQ not signed in — scan below; it auto-reconnects, no need to click again',
    '还没登录，去「通道 → B 站账号」扫码登录': 'Not signed in — scan to sign in on Channels → Bilibili',
    '登录了，但还没填「管理员 UID」（私信只发给这个号）': 'Signed in, but Owner UID is empty (DMs only go there)',
    '已登录，自动私信关着': 'Signed in, auto DM off',
    收到消息会自动回: 'Auto-replies to messages',
    '自动回复关着（不会主动回话）': 'Auto reply off (she will not answer)',
    '关着，她不会主动说话': 'Off — she will not start conversations',
    已经停了: 'Stopped',
    '会断开 QQ、停掉主动聊天和 B 站自动私信。软件本身不退出，随时可以再点一次打开。':
      'Disconnects QQ and stops proactive chat and Bilibili auto-DM. The app stays open — click again anytime to resume.',
    '关掉以后，她在 QQ 里就不在线了，也不会主动找你。': 'Once off, she is offline on QQ and will not reach out.',
    '看图那套接口的用量（和聊天分开算）': 'Usage for the vision API (separate from chat)',

    // ---------------- 养成：心情 ----------------
    今天还没状态: 'No mood today',
  });

  dict.RULES.push(
    [/^长度要在 (\d+)–(\d+) 位之间（现在是 (\d+) 位）$/, (m, lo, hi, cur) => `Must be ${lo}–${hi} characters (currently ${cur})`],
    [/^试太多次了，(\d+) 秒再试$/, 'Too many tries — wait $1s'],
    [/^密钥不对（还能试 (\d+) 次）$/, 'Wrong key ($1 tries left)'],
    [/^已选 (.+)，但一条向量都还没有。点「补算向量」把老记忆算出来。$/, 'You picked $1 but no vectors exist yet. Hit “Backfill vectors” to compute them.'],
    [/^已登录，自动私信开着（每 (\d+) 分钟一条）$/, 'Signed in, auto DM on (every $1 min)'],
    [/^开着，大约每 (\d+) 分钟看一次$/, 'On — checks about every $1 min'],
    [/^提炼改用 (.+)$/, 'Distill now uses $1'],
    [/^(后半夜|清晨|上午|中午|下午|晚上|深夜)（(\d+) 点）$/, (m, phase, hour) => `${dict.MAP[phase] || phase} (${hour}:00)`],
    [/^已配置：(.+)（发语音开着）$/, 'Configured: $1 (voice on)'],
    [/^已配置：(.+)（但「允许发语音」关着）$/, 'Configured: $1 (voice allowed off)'],
    [/^有点困但舍不得睡 —— 说话方式：话变少，句子变短$/, 'sleepy but not ready for bed — speaking style: fewer words, shorter sentences'],
    [/^困到不行，脑子转得慢 —— 说话方式：句子短，容易打错字，想睡觉$/, 'dead tired, slow brain — speaking style: short sentences, typos, wants to sleep'],
    [/^刚醒，还有点迷糊 —— 说话方式：慢半拍，会赖床，说话软$/, 'just woke up, still groggy — speaking style: a beat slow, lingers in bed, talks softly'],
    [/^精神不错 —— 说话方式：愿意多聊两句$/, 'in good spirits — speaking style: happy to chat more'],
    [/^有点饿，想着吃什么 —— 说话方式：容易把话题拐到吃的$/, 'a bit hungry, thinking about food — speaking style: steers talk toward food'],
    [/^一天里最活跃 —— 说话方式：话最多，愿意主动找话题$/, 'most energetic of the day — speaking style: talkative, starts topics'],
    [/^放松下来 —— 说话方式：说话随意，会撒娇$/, 'relaxed — speaking style: casual, a little clingy'],
  );

  dict.POST.push(
    // 心情/愿望：出现在「今天：…」这类拼装句里，替换里面的片段
    [/心情不错，尾巴一直摆/g, 'in a good mood, tail wagging'],
    [/有点犯困，说话慢半拍/g, 'a bit sleepy, a beat slow'],
    [/精神很好，什么都想问一句/g, 'full of energy, asking about everything'],
    [/有点小得意，刚做成了一件事/g, 'a little proud, just finished something'],
    [/懒洋洋的，不想动/g, 'lazy, not wanting to move'],
    [/有点闹脾气，嘴上不服软/g, 'a little grumpy, will not admit it'],
    [/安静，想一个人待着/g, 'quiet, wants to be alone'],
    [/很亢奋，想出去玩/g, 'amped up, wants to go out'],
    [/有点饿，注意力不集中/g, 'a bit hungry, distracted'],
    [/心里软软的/g, 'feeling soft'],
    [/在琢磨事情，说话会比较直/g, 'mulling something over, talks bluntly'],
    [/刚睡醒，还没缓过来/g, 'just woke up, still groggy'],
    [/想找点好吃的/g, 'wants something tasty'],
    [/想趴着听人说话/g, 'wants to lie down and listen'],
    [/想听点新鲜事/g, 'wants to hear something new'],
    [/想被夸两句/g, 'wants a compliment'],
    [/想被人哄一哄/g, 'wants to be coaxed'],
    [/想被让一步/g, 'wants you to give in a little'],
    [/想听你说说今天/g, 'wants to hear about your day'],
    [/想去看看外面/g, 'wants to go outside'],
    [/想听你报菜名/g, 'wants you to list dishes'],
    [/想被陪着说会儿话/g, 'wants company to chat'],
    [/想找人辩论一下/g, 'wants a friendly debate'],
    [/想被随口问一句/g, 'wants you to ask how she is'],
    // 模型：提炼引擎名片段
    [/本机 Ollama（免费）/g, 'Ollama (local, free)'],
    [/云端 DeepSeek/g, 'DeepSeek (cloud)'],
    [/DeepSeek 云端/g, 'DeepSeek (cloud)'],
    [/本机 Ollama/g, 'Ollama (local)'],
  );

  if (window.EN && window.EN.refresh) window.EN.refresh();
})();

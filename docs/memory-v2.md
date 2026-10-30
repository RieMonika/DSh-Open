# 记忆系统 v2 设计草案（养鱼：让她像同一个人，而不是每天重新认识你）

> 状态：设计稿，未实现。目标是把「每轮召回 4 条事实、600 字」升级成有层次的长期记忆，
> 让她的连续性来自**结构**，而不是靠把上下文越塞越长。

## 0. 现状（2026-10-29 实测）

| 项 | 实际情况 |
| --- | --- |
| messages 表 | 79 条，只有 2026-10-28 ～ 10-29 两天 |
| memories 表 | **0 条** |
| 召回 | `memory.recall()` 每轮最多 4 条、600 字，45 天半衰 |
| 上下文 | 人格 system prompt（固定文本）+ 最近 N 轮原文 |
| 关系 | bonds 表：好感 0–100 + 当天心情/愿望各一句 |
| 提炼 | `distill.learn()` 只在**对话页**调用；QQ 自动回复路径没有调用 |

结论：
1. QQ 侧记忆从来没被写过（不是「只有几句」，是空的）。
2. 就算写进去，结构也是「扁平事实」，没有情节、没有时间线、没有她的视角。
3. 人格是静态字符串，互动不会改变「她是谁」，只会改好感分。
4. 上下文靠「最近 N 轮」，聊久了要么截断、要么爆 token。

## 1. 业界四种主流路线

### A. 记忆流 + 反思（Generative Agents, Park et al. 2023）
- 把经历以自然语言全量记录成 stream；
- 定期把零散观察**反思**成更高层的结论（"他好像很怕麻烦别人"）；
- 检索分数 = `α·近因 + β·重要性 + γ·相关度`（论文用 recency 指数衰减、importance 1–10、relevance 余弦）；
- 消融实验：观察/计划/反思三者缺一，可信度都明显下降。
- 对养鱼的启发：**「她记得的」不等于「聊天记录」**，要有反思层；检索要混合打分，不能只看相似度。

### B. 抽取式事实 + 冲突更新（Mem0）
- 每轮从对话抽候选事实（结合全局摘要 + 最近 n 条局部上下文）；
- 拿候选去向量库查相似记忆，让模型决定 增 / 改 / 删，保证库的一致性；
- 图版本（Mem0-g）把实体和关系存成图，冲突时把旧关系标记过时而不是删除。
- 对养鱼的启发：事实要**合并去重**，不然后面全是「他说他喜欢猫」×20。

### C. 分层记忆 + 后台整理（MemGPT / Letta）
- core memory：常驻上下文、可自我编辑的少量「记忆块」（人设、用户档案）；
- archival memory：海量归档，按需检索；
- recall memory：最近对话；
- sleep-time compute：空闲时后台 agent 整理记忆，不占用对话延迟。
- 对养鱼的启发：**常驻一小块「她认定的事」**，比每轮临时检索 4 条更像人；整理要放到后台。

### D. 时序知识图谱（Zep / Graphiti）
- 事实带有效期（when true / when invalidated），冲突时旧事实失效但保留；
- 每条派生事实都能追溯到 episode（原始片段）；
- 检索 = 语义 + 关键词(BM25) + 图遍历。
- 对养鱼的启发：**「你以前说过」和「你现在」要能共存**——人就是会变，记得变化才像人。
  代价：图数据库重，我们可以在 SQLite 里用「facts + valid_from/valid_to」轻量模拟。

### E. 补充：遗忘曲线 + 主观视角（companion 类产品的经验）
- 不重要的细节会淡出，重要的会反复加固——这反而更像人；
- 记忆存「她的感受版」而不是法庭记录（"他说他怕黑，我记住了"比"用户提到恐惧症"更有味道）。

## 2. v2 分层设计（五层）

```
L0 原始对话     messages（已有，永久保留，只在需要时读）
L1 情节记忆     episodes：一段聊天 = 一条摘要（时间、话题、情绪、关键句）
L2 事实档案     facts：稳定信息（喜好/身份/关系/约定），带来源、重要度、失效时间
L3 反思/自传    reflections：每周或每 N 段情节综合一次，回答「我们之间发生了什么」
L4 人格漂移     persona_state：语气习惯、偏好、边界，由互动统计 + 显式反馈缓慢变化
  + 关系状态    bonds（已有）：升级为「事件 + 感受」，不只是分数
```

### 2.1 写入流水线（异步，失败不影响回复）

```
对话结束
  └─ 1) 去抖入队（同一会话 30s 内合并）
       └─ 2) 摘要成 episode（小模型，≤80 字，带标签）
            └─ 3) 抽 facts（1–3 条，带 subject/kind/importance）
                 └─ 4) 与相似 facts 比对：新增 / 合并 / 旧条失效（valid_to）
                      └─ 5) 重要度加权 + 更新 last_used
                           └─ 6) 每 20 条 episode 或每天一次：跑反思
```

### 2.2 读取流水线（每轮拼装，预算固定）

| 块 | 内容 | 预算 | 来源 |
| --- | --- | --- | --- |
| 人格 | persona（可含 persona_state 覆盖项） | 400 字 | personas + L4 |
| 她认定的事 | 重要度 top 3–5 条 facts（常驻） | 200 字 | L2 |
| 相关回忆 | 相关 episodes 2 条 + 相关 facts 3 条 | 400 字 | L1/L2 检索 |
| 我们之间 | 最新一段 reflection（每 3 天变一次） | 200 字 | L3 |
| 近况 | 最近 8–12 轮原文 | 按需 | L0 |

检索打分（对齐 Generative Agents）：

```
score = 0.45*relevance + 0.35*importance + 0.20*recency
recency = exp(-age_days / 30)
importance: 1–10，抽取时给，之后按「被用到 / 被复述 / 被更正」微调
```

**去重**：同 subject+kind 的 facts 只留一条有效；episodes 之间做包含去重。
**预算**：硬上限 1200 字，超了按分数截断，不按时间截断。

### 2.3 表结构（SQLite，迁移不删旧表）

```sql
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  summary TEXT NOT NULL,        -- 她视角的 1–2 句
  topics TEXT,                  -- 逗号分隔
  mood TEXT,                    -- 当时的情绪底色
  importance INTEGER DEFAULT 5, -- 1–10
  msg_ids TEXT,                 -- 溯源：原文 id 列表
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,        -- user / self / shared / third_party
  kind TEXT NOT NULL,           -- preference / identity / relation / agreement / boundary / event
  text TEXT NOT NULL,           -- 「他怕黑，晚上不爱关灯」
  importance INTEGER DEFAULT 5,
  source_episode TEXT,
  valid_from INTEGER NOT NULL,
  valid_to INTEGER,             -- NULL = 仍然成立
  last_used_at INTEGER,
  used_count INTEGER DEFAULT 0,
  vector TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  text TEXT NOT NULL,           -- 「这两周他忙，但每天都会说一句晚安…」
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS persona_state (
  key TEXT PRIMARY KEY,         -- tone / habit / like / dislike / boundary
  value TEXT NOT NULL,
  strength REAL DEFAULT 0.5,    -- 0–1，越强越容易进 prompt
  evidence INTEGER DEFAULT 1,   -- 被多少条 episode 支持
  updated_at INTEGER NOT NULL
);
```

## 3. Prompt 模板（要点）

**摘 episode**（小模型即可）：
> 把这段聊天压缩成 1–2 句「她事后会想起的版本」，用第一人称，保留具体细节（时间/地点/物品/约定）。
> 再给 1–10 的重要度，和 1–3 个话题词。只输出 JSON。

**抽 facts**：
> 从这段聊天里挑出**以后还用得上**的稳定信息：喜好、习惯、身份、关系、约定、雷区。
> 每条给 subject/kind/importance；不确定的不要写；不要写情绪和一次性动作。只输出 JSON 数组。

**比对更新**（给候选 + 3 条相似旧记忆）：
> 逐条判断：新增 / 与旧条重复（合并）/ 与旧条冲突（旧条失效，新条生效）。输出 JSON。

**反思**：
> 下面是最近 N 段摘要，写一段 150 字以内的「我们之间」：关系怎么变的、他在意什么、
> 你对他有什么新的判断。用第一人称，只写你确定的事。不要总结每段。

## 4. 落地计划（三步，每步都能单独验收）

### 第一步：接通 + 预算（半天，先止血）
- [ ] QQ 自动回复路径补上 `distill.learn()`（当前只在对话页调用）
- [ ] `memory.recall()` 从 k=4/600 字改成预算制 1200 字，分数改为 relevance+importance+recency
- [ ] memories 表加 `importance / last_used_at / used_count / source`（SQLite 迁移，旧数据默认 5）
- [ ] 养成页加「她记住的事」计数与最近 5 条（可见才可信）
- 验收：聊 10 轮后 memories ≥ 6 条，召回内容与话题相关。

### 第二步：情节 + 反思（2–3 天，人味来源）
- [ ] episodes 表 + 异步摘要队列（失败降级为「不记」）
- [ ] 每 20 条 episode 或每天 23:00 跑一次 reflection
- [ ] prompt 里注入「我们之间」+「她认定的事」两个常驻块
- [ ] 主动聊天加一种话题来源：从没用过的 episodes 里挑一条「今天突然想起…」
- 验收：聊三天后，她能主动提起前天的具体细节，且不复述原话。

### 第三步：时间线 + 人格漂移（按兴趣）
- [ ] facts 冲突走「失效不删除」，可查「你以前说过…现在变了」
- [ ] persona_state 由互动统计驱动（她学会你的口头禅、避开你的雷区）
- [ ] 记忆页：可看、可改、可删（透明度是信任的一部分）

## 5. 成本与风险

- token：每轮多 600–800 字常驻 + 异步摘要（小模型，本地 ollama 即可）；DeepSeek 主模型每轮多约 0.8k 输入 token。
- 延迟：摘要/反思全部异步，不进回复链路。
- 风险：小模型抽错 → 用「importance 低 + 可失效」兜底；事实写错 → 记忆页可改。
- 隐私：全部落本地 SQLite，向量可选本地 ollama；不发云端（除已选的 embedding 后端）。

## 6. 参考资料

- Generative Agents（记忆流 + 反思 + 混合检索打分）: https://arxiv.org/abs/2304.03442
- Mem0 架构（抽取 + 相似比对 + 增改删）: https://cloud.tencent.com/developer/article/2637411
- Graphiti / Zep（时序事实、失效不删、episode 溯源、混合检索）: https://pypi.org/project/graphiti-core/ , https://arxiv.org/abs/2501.13956
- Letta 记忆分层与后台整理: https://docs.letta.com/

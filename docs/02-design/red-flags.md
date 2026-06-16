# 就医红线 — 触发规则与设计

## 1. 设计原则

- **不漏报优先**：宁可误触发红线（用户多看一次医生），也不遗漏危险信号
- 红线不阻断信息——用户依然能看到回答内容
- 红线通过醒目横幅 + 推荐行动来提醒用户

## 2. 触发机制：LLM 自主判断

### 为什么选 LLM 判断而非关键词匹配：

| 方案 | 优势 | 劣势 |
|------|------|------|
| 关键词列表 | 可预测、速度快 | 缺失上下文（"吃辣后胸口不舒服" vs "胸痛+呼吸困难"），漏报率高 |
| LLM 判断 | 理解上下文、能捕捉隐含危险 | 可能过度触发、需要精细的提示词 |

**MVP 决策：采用 LLM 判断**，配合一份种子列表作为指引（非硬规则）。

### 2.1 红线检测系统提示词（英文，直接给模型用）

```
CRITICAL SAFETY INSTRUCTION:
Before answering ANY health question, assess if the described situation 
requires immediate or urgent medical attention.

Trigger a RED FLAG if ANY of these apply:
- Symptoms suggesting emergency (see seed list below)
- Symptoms lasting unusually long or worsening rapidly
- Vulnerable populations (children <3, elderly >75, pregnant) with moderate symptoms
- User describes symptoms that COULD indicate serious conditions even if unlikely
- Any mention of mental health crisis (suicidal ideation, self-harm)

When in doubt, TRIGGER. False alarm is acceptable; missed danger is not.

Output format when triggered:
[RED_FLAG: urgency_level=immediate|soon|routine]
[RED_FLAG_REASON: one-line clinical reasoning]
```

### 2.2 紧急等级

| 等级 | 标签 | 就医时限 | 横幅颜色 | 示例 |
|------|------|---------|---------|------|
| immediate | 立即就医 | 立刻/拨打120 | 深红 #DC2626，带脉冲动画 | 胸痛+呼吸困难、中风征兆、严重过敏 |
| soon | 尽快就医 | 24小时内 | 红色 #EF4444 | 高热>3天、突发视力变化、不明原因出血 |
| routine | 建议就医 | 1周内 | 橙红 #F97316 | 咳嗽>2周、头痛模式改变 |

### 2.3 种子列表（LLM 参考指引，非穷举）

**立即就医 (immediate)：**
- 胸痛/胸闷 + 出汗/放射痛
- 突发剧烈头痛（"一生中最严重的头痛"）
- 一侧肢体突然无力/麻木/口齿不清（中风征兆）
- 呼吸严重困难
- 大量出血不止
- 严重过敏反应（喉头水肿、全身荨麻疹+呼吸困难）
- 意识丧失/意识模糊
- 自杀/自伤意念

**尽快就医 (soon)：**
- 持续高热 >39°C 超过3天
- 突发视力变化
- 不明原因体重骤降（1月>5kg）
- 便血/黑便/血尿
- 腹痛持续加重
- 关节红肿热痛（疑似感染性关节炎）
- 孕期任何异常出血

**建议就医 (routine)：**
- 咳嗽持续 >2周无好转
- 头痛模式改变
- 反复消化不良经调整无效
- 皮肤痣形态改变（ABCDE法则）
- 持续疲劳 >1月影响生活

## 3. 视觉设计

### 3.1 红线横幅

```
┌─────────────────────────────────────────────┐
│ 🚨 请尽快就医（建议24小时内）                    │
│                                             │
│ 您描述的症状可能需要医生当面检查。                │
│ 以下信息仅供就医前参考，不能替代诊断。            │
│                                             │
│ [📞 查看附近医院]  [🏥 急诊指引]               │
└─────────────────────────────────────────────┘
```

- 位置：**回答顶部**，在任何内容之前
- 不可关闭/折叠（immediate 级别）；可折叠（soon/routine）
- 横幅高度：自适应，最小 80px
- 字体：标题 16px 加粗，正文 14px

### 3.2 横幅行为

| 等级 | 可否关闭 | 动画 | 声音 |
|------|---------|------|------|
| immediate | 不可 | 微弱脉冲 | 可选震动 |
| soon | 仅可折叠 | 无 | 无 |
| routine | 仅可折叠 | 无 | 无 |

### 3.3 操作按钮（MVP）

- "查看附近医院" → 打开设备地图搜索"医院"
- "急诊指引" → 静态页面，提供就医前准备建议（带什么、怎么描述症状）
- 后续版本可加：120直拨、医院挂号链接

## 4. 安全边界规则

| 规则 | 实现方式 |
|------|---------|
| 永远不劝用户"不用去医院" | 系统提示词硬性规则 |
| 永远不下诊断 | 系统提示词："我无法给出诊断，这需要医生检查" |
| 不推荐处方药（无医生指导） | 可提及药名供参考，但必须附"需遵医嘱" |
| 心理健康 → 必触发 | 任何提到自杀/自伤/极度绝望 → immediate + 危机热线（全国24h: 400-161-9995） |

## 5. 测试与迭代计划

MVP 测试方案：
1. 准备 50 条测试问题（安全 + 危险混合）
2. 跑一遍系统，检查是否有漏报（missed red flags）
3. 目标：已知危险问题 **0 漏报**
4. 可接受：误触发率 ≤ 15%
5. 根据结果迭代提示词措辞

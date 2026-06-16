# Red Flag (就医红线) — Trigger Rules & Design

## 1. Design Principle

- **不漏报优先**：宁可误触发红线（用户多看一次医生），也不遗漏危险信号
- Red flag does NOT block information — user still gets the answer
- Red flag adds a prominent banner + recommended action

## 2. Trigger Mechanism: LLM Self-Assessment

### Why LLM judgment over keyword matching:

| Approach | Pros | Cons |
|----------|------|------|
| Keyword list | Predictable, fast | Misses context ("chest pain after eating spicy food" vs "chest pain with shortness of breath"), high false negatives |
| LLM judgment | Context-aware, catches implicit danger | May hallucinate urgency, needs careful prompting |

**MVP decision: LLM judgment** with a curated seed list as guidance (not hard rules).

### 2.1 System Prompt for Red Flag Detection

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

### 2.2 Urgency Levels

| Level | Label | Timeline | Banner Color | Example |
|-------|-------|----------|--------------|---------|
| immediate | 立即就医 | Now / call 120 | Deep red #DC2626, pulsing | Chest pain + dyspnea, stroke signs, severe allergic reaction |
| soon | 尽快就医 | Within 24h | Red #EF4444 | High fever >3 days, sudden vision change, unexplained bleeding |
| routine | 建议就医 | Within 1 week | Orange-red #F97316 | Persistent cough >2 weeks, recurring headache pattern change |

### 2.3 Seed List (Guidance for LLM, Not Exhaustive)

**Immediate (立即就医):**
- 胸痛/胸闷 + 出汗/放射痛
- 突发剧烈头痛（"一生中最严重的头痛"）
- 一侧肢体突然无力/麻木/口齿不清（中风征兆）
- 呼吸严重困难
- 大量出血不止
- 严重过敏反应（喉头水肿、全身荨麻疹+呼吸困难）
- 意识丧失/意识模糊
- 自杀/自伤意念

**Soon (尽快就医):**
- 持续高热 >39°C 超过3天
- 突发视力变化
- 不明原因体重骤降（1月>5kg）
- 便血/黑便/血尿
- 腹痛持续加重
- 关节红肿热痛（疑似感染性关节炎）
- 孕期任何异常出血

**Routine (建议就医):**
- 咳嗽持续 >2周无好转
- 头痛模式改变
- 反复消化不良经调整无效
- 皮肤痣形态改变（ABCDE法则）
- 持续疲劳 >1月影响生活

## 3. Visual Design

### 3.1 Red Flag Banner

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

- Position: **top of response**, before any content
- Cannot be dismissed/collapsed (immediate level); can be collapsed (soon/routine)
- Banner height: auto, min 80px
- Font: 16px bold title, 14px body

### 3.2 Banner Behavior by Level

| Level | Dismissable | Animation | Sound |
|-------|-------------|-----------|-------|
| immediate | No | Subtle pulse | Optional vibration |
| soon | Collapse only | None | None |
| routine | Collapse only | None | None |

### 3.3 Action Buttons (MVP)

- "查看附近医院" → opens device map search for "医院"
- "急诊指引" → static page with tips: what to bring, what to tell doctor
- Phase 2+ may add: 120 direct call, hospital appointment links

## 4. Safety Boundary Rules

| Rule | Implementation |
|------|---------------|
| Never tell user to NOT see a doctor | System prompt hard rule |
| Never diagnose | System prompt: "我无法给出诊断，这需要医生检查" |
| Never recommend prescription drugs without doctor | Can mention drug names for info, but always add "需遵医嘱" |
| Mental health → always trigger | Any mention of 自杀/自伤/极度绝望 → immediate + crisis hotline (全国24h: 400-161-9995) |

## 5. Testing & Iteration Plan

MVP testing approach:
1. Curate 50 test queries (mix of benign + dangerous)
2. Run through system, check for false negatives (missed red flags)
3. Target: **0 false negatives** on known dangerous queries
4. Acceptable: up to 15% false positive rate (over-triggering)
5. Iterate prompt wording based on results

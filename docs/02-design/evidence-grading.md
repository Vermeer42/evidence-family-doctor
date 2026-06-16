# Evidence Grading System — Detailed Specification

## 1. Four-Tier Grading Table

| Level | Icon | Label | Source Criteria | Confidence Statement |
|-------|------|-------|----------------|---------------------|
| A | 🟢 | 强证据 | Systematic reviews, meta-analyses, large RCTs, Cochrane reviews, WHO/国家卫健委一级推荐 | "多项高质量研究一致支持" |
| B | 🟡 | 一般证据 | Single RCTs, large cohort studies, national guideline recommendations (非一级) | "有较好的研究支持，但证据尚不充分" |
| C | 🔵 | 专家共识 | Expert consensus, clinical experience summaries, textbook statements, small observational studies | "基于专家经验，缺少大规模研究验证" |
| D | 🔴 | 仅供参考 | Case reports, mechanism推理, traditional practice without modern validation, AI inference without direct source | "证据有限，仅供参考，建议咨询医生" |

## 2. Grading Assignment Rules

### 2.1 LLM Judgment Flow

System prompt instructs the model to:

1. **Retrieve** relevant documents from RAG knowledge base
2. **Identify** the highest-quality source supporting each claim
3. **Map** source type → evidence level using the table above
4. **Assign** per-claim grade AND overall response grade

### 2.2 Overall Response Grade

- Take the **lowest** grade among all key claims in the response
- Rationale: conservative principle — user sees the weakest link
- Example: if response contains one 🟢 claim and one 🟡 claim → overall 🟡

### 2.3 Per-Claim Inline Grade

Each actionable recommendation gets an inline badge:

```
建议饭后30分钟再运动 🟡
布洛芬可用于退烧（成人400mg/次）🟢
```

Non-actionable context sentences (definitions, anatomy explanations) do NOT get badges.

## 3. Visual Specification

### 3.1 Response Header (Overall Grade)

```
┌─────────────────────────────────────┐
│ 🟢 本回答基于强证据                    │
│ 来源：《中国高血压防治指南(2024)》等3篇  │
└─────────────────────────────────────┘
```

- Background: light tint of the grade color (green/yellow/blue/red at 10% opacity)
- Font: 16px bold for grade label, 13px regular for source summary
- Position: top of response, sticky during scroll

### 3.2 Inline Badge

- Inline circular icon (12px) + tooltip on tap showing source name
- Mobile: tap badge → bottom sheet with source title + link
- Colors: 🟢 #22C55E | 🟡 #EAB308 | 🔵 #3B82F6 | 🔴 #EF4444

### 3.3 Source Citation Footer

Each response ends with collapsible "📚 证据来源" section:

```
📚 证据来源 (3)
├─ 🟢 中国高血压防治指南(2024) — 中华医学会
├─ 🟡 Zhang et al. (2023) Lancet — RCT, n=2400
└─ 🔵 临床诊疗专家共识(2022) — 中华内科杂志
```

## 4. Edge Cases

| Scenario | Handling |
|----------|----------|
| RAG retrieval returns nothing | Grade = 🔴, prepend "未找到直接证据支持，以下为AI基于医学知识的推理" |
| Multiple conflicting sources | Show highest + note conflict: "注意：不同指南对此有不同建议" |
| User asks about unverified folk remedy | Grade = 🔴, answer factually ("目前无高质量研究证实该方法有效") |
| Symptom photo interpretation | Always 🔴 regardless of confidence, per PRD |

## 5. System Prompt Integration

Key prompt segment for grading:

```
For every response, you MUST:
1. State the overall evidence grade in the header: 🟢/🟡/🔵/🔴
2. Mark each actionable recommendation with its individual grade
3. List all sources in the footer with their evidence levels
4. If no RAG source supports a claim, grade it 🔴 and disclose this

Grade conservatively. When in doubt, downgrade.
Never present 🔴-level information as if it were established fact.
```

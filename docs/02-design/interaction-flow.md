# Interaction Flow — Mobile-First Design

## 1. Page Architecture (3 pages)

```
[首页] ──tap──→ [对话页] ──tap source──→ [来源详情页]
```

## 2. Home Page (首页)

### 2.1 Layout

```
┌──────────────────────────────┐
│  🏥 家庭医生                  │  ← app bar, 24px title
│                              │
│  ┌────────────────────────┐  │
│  │ 有什么健康问题？          │  │  ← input area
│  │                        │  │
│  │ [📷]  [🎤]        [发送] │  │  ← action buttons
│  └────────────────────────┘  │
│                              │
│  💡 你可以这样问：             │  ← prompt suggestions
│  ┌──────────┐ ┌──────────┐  │
│  │血压高要注意│ │体检报告看  │  │
│  │什么？     │ │不懂       │  │
│  └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐  │
│  │感冒了怎么│ │腰疼是什么  │  │
│  │办？      │ │原因？      │  │
│  └──────────┘ └──────────┘  │
│                              │
│  ──────── 历史对话 ────────  │
│  📋 昨天: 血压高吃什么药     │
│  📋 前天: 膝盖疼要不要拍片   │
└──────────────────────────────┘
```

### 2.2 Key Design Decisions

- **Input box prominent**: largest interactive element, centered vertically in upper half
- **Font size**: base 16px, input 18px, suggestion cards 15px
- **Suggestion cards**: 4 examples covering common scenarios, tappable → auto-fill input
- **History**: simple list, most recent first, tap to resume conversation
- **No login required** for MVP (stateless, history via localStorage)

### 2.3 Input Methods

| Method | Entry Point | Behavior |
|--------|-------------|----------|
| Typing | Tap input box | Standard keyboard, 18px font for readability |
| Voice | Tap 🎤 button | Browser Speech Recognition API → text transcription → auto-fill input box, user confirms before sending |
| Photo | Tap 📷 button | Camera/album picker → attach image → user adds optional text context → send |

**Voice flow detail:**
1. Tap 🎤 → button turns red, "正在听..." label appears
2. Speech-to-text fills input box in real-time
3. User reviews text, can edit
4. Tap 发送 to submit (NOT auto-send — prevents misrecognition errors)

## 3. Chat Page (对话页)

### 3.1 Layout

```
┌──────────────────────────────┐
│ ← 返回    家庭医生    [新对话] │  ← nav bar
├──────────────────────────────┤
│                              │
│ ┌─ User ────────────────┐   │
│ │ 我血压150/95，要吃药吗？ │   │
│ └───────────────────────┘   │
│                              │
│ ┌─ 🚨 RED FLAG ──────────┐  │  ← if triggered
│ │ 请尽快就医...            │  │
│ └────────────────────────┘  │
│                              │
│ ┌─ AI ──────────────────┐   │
│ │ 🟡 本回答基于一般证据    │   │  ← overall grade header
│ │ 来源：中国高血压指南等   │   │
│ │ ─────────────────────  │   │
│ │ 根据最新指南，您的血压...│   │
│ │ ...                    │   │
│ │ 建议：                 │   │
│ │ • 限盐<5g/天 🟢        │   │  ← inline grade
│ │ • 规律有氧运动 🟢       │   │
│ │ • 是否用药需医生评估 🟡  │   │
│ │ ─────────────────────  │   │
│ │ 📚 证据来源 (2)    ▼   │   │  ← collapsible
│ └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│ [📷] [输入健康问题...] [🎤][↑]│  ← input bar
└──────────────────────────────┘
```

### 3.2 Response Rendering Flow

```
User sends message
    │
    ▼
[Loading: "正在查阅医学资料..." with animated dots]
    │
    ▼
[Stream response token by token]
    │
    ▼
[Response complete → render grade header + source footer]
```

- Streaming: tokens appear progressively (typewriter effect)
- Grade header appears AFTER full response (needs complete context to determine overall grade)
- Inline badges render with each sentence as it streams

### 3.3 Image Upload Flow

```
User taps 📷
    │
    ├─ Camera (拍照)
    │   └─ Capture → preview → confirm
    │
    └─ Album (相册)
        └─ Pick → preview → confirm
            │
            ▼
[Image thumbnail appears in chat + text input prompt: "请描述您的问题"]
            │
            ▼
User adds context (optional) → sends
            │
            ▼
AI response with image analysis + always 🔴 if symptom photo
```

### 3.4 Interaction Details

| Element | Tap Action |
|---------|------------|
| Inline grade badge (🟢🟡🔵🔴) | Bottom sheet: source name + evidence type |
| "📚 证据来源" | Expand/collapse source list |
| Source item in list | Navigate to 来源详情页 |
| Red flag "查看附近医院" | Open device maps |
| "新对话" button | Clear context, start fresh (confirm if current chat has content) |

## 4. Source Detail Page (来源详情页)

### 4.1 Layout

```
┌──────────────────────────────┐
│ ← 返回          证据来源详情  │
├──────────────────────────────┤
│                              │
│ 📖 中国高血压防治指南(2024)    │  ← title
│ ─────────────────────────── │
│ 发布机构：中华医学会           │
│ 证据等级：🟢 强证据           │
│ 类型：临床实践指南             │
│ ─────────────────────────── │
│                              │
│ 📋 相关原文摘录：             │
│ "对于1级高血压患者（收缩压    │
│  140-159mmHg），建议先进行    │
│  3-6个月生活方式干预..."      │
│                              │
│ ─────────────────────────── │
│ 🔗 查看原文                  │  ← external link if available
│                              │
└──────────────────────────────┘
```

### 4.2 Content Strategy

- Show actual RAG chunk that was used (excerpt, not full document)
- Source metadata: publisher, year, evidence type
- External link when available (some guidelines are publicly accessible)
- If source is PubMed paper: show title, authors, journal, DOI link

## 5. Accessibility for Elderly Users

### 5.1 Font & Touch

| Element | Size | Touch Target |
|---------|------|-------------|
| Body text | 16px min | — |
| Input text | 18px | — |
| Buttons | 16px label | 48×48px min |
| Suggestion cards | 15px | 44px height min |
| Grade badges | 12px icon + 14px tooltip | 36×36px tap area |

### 5.2 Color & Contrast

- All text: contrast ratio ≥ 4.5:1 (WCAG AA)
- Grade colors used with icon+text (never color alone) for color-blind users
- Dark mode: NOT in MVP (reduces complexity, elderly users rarely use it)

### 5.3 Interaction Simplicity

- Maximum 2 taps to any function
- No swipe gestures required (all actions via visible buttons)
- No infinite scroll — paginated history (20 items/page)
- Clear "返回" button, no rely on system back gesture alone
- Error states: plain Chinese ("网络不好，请稍后再试"), never show technical errors

## 6. Responsive Behavior

| Viewport | Layout |
|----------|--------|
| < 480px (phone) | Default, single column |
| 480-768px (large phone/small tablet) | Same layout, slightly wider margins |
| > 768px (tablet/desktop) | Centered 480px-max content column, larger fonts (+2px) |

MVP is mobile-first; desktop is passable but not optimized.

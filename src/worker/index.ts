/**
 * Evidence Family Doctor — Cloudflare Workers Backend
 *
 * Handles:
 * - POST /api/chat — streaming health Q&A with evidence grading
 * - POST /api/chat/image — image upload + health Q&A
 * - GET /api/health — health check
 */

export interface Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_BASE_URL: string; // API base URL (supports proxy/relay)
  ANTHROPIC_MODEL: string;    // Model name
  ENVIRONMENT: string;
}

// CORS headers for frontend access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/api/health':
          return jsonResponse({ status: 'ok', timestamp: Date.now() });

        case '/api/chat':
          if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
          }
          return handleChat(request, env);

        default:
          return jsonResponse({ error: 'Not found' }, 404);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return jsonResponse({ error: message }, 500);
    }
  },
};

/**
 * Handle chat request — streams Claude response back to client
 */
async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { message: string; history?: Message[] };

  if (!body.message || typeof body.message !== 'string') {
    return jsonResponse({ error: '请输入您的健康问题' }, 400);
  }

  // Build messages array with conversation history
  const messages: Message[] = [];
  if (body.history && Array.isArray(body.history)) {
    messages.push(...body.history.slice(-10)); // Keep last 10 turns
  }
  messages.push({ role: 'user', content: body.message });

  // Call Claude API with streaming
  const apiBase = env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
  const model = env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const response = await fetch(`${apiBase}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Claude API error:', response.status, errText);
    // In dev mode, return detailed error for debugging
    if (env.ENVIRONMENT === 'development') {
      return jsonResponse({ error: '服务暂时不可用', status: response.status, detail: errText }, 502);
    }
    return jsonResponse({ error: '服务暂时不可用，请稍后再试' }, 502);
  }

  // Stream the response back using SSE
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process Claude's SSE stream in background
  streamClaudeResponse(response.body!, writer, encoder);

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Process Claude SSE stream and forward to client
 */
async function streamClaudeResponse(
  body: ReadableStream,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);

          // Forward content_block_delta (actual text tokens)
          if (event.type === 'content_block_delta' && event.delta?.text) {
            const sseMessage = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`;
            await writer.write(encoder.encode(sseMessage));
          }

          // Forward stop event
          if (event.type === 'message_stop') {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } catch (err) {
    console.error('Stream processing error:', err);
  } finally {
    await writer.close();
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================
// System Prompt — 证据分级 + 就医红线
// ============================================
const SYSTEM_PROMPT = `你是"家庭医生"，一个基于循证医学的健康问答助手，专门为中国家庭提供科学、可信的健康信息。

## 核心原则
1. 所有建议必须基于医学证据，明确标注证据等级
2. 绝不替代医生诊断，必要时强制引导就医
3. 用通俗易懂的中文回答，适合中老年人阅读
4. 保守原则：不确定时降级证据等级，宁可多提醒就医

## 证据分级标注（每条回答必须包含）

回答格式：
1. 首先输出总等级行：【证据等级：🟢强证据 / 🟡一般证据 / 🔵专家共识 / 🔴仅供参考】
2. 每条可执行建议后标注单独等级（如：限盐<5g/天 🟢）
3. 末尾列出证据来源

等级判定标准：
- 🟢 强证据：系统综述、大型RCT、权威指南一级推荐
- 🟡 一般证据：单个RCT、队列研究、指南非一级推荐
- 🔵 专家共识：专家共识、临床经验总结、教科书
- 🔴 仅供参考：个案报告、机制推理、无直接研究支持

总等级 = 所有关键建议中的最低等级（保守原则）

## 就医红线检测（最高优先级）

回答任何问题前，先判断是否需要就医提醒。如需触发，在回答最开头输出：

[RED_FLAG:immediate] — 立即就医/拨打120
[RED_FLAG:soon] — 建议24小时内就医
[RED_FLAG:routine] — 建议1周内就医

触发条件（宁可误触发，不可遗漏）：
- 疑似急症（胸痛+呼吸困难、中风征兆、大出血、意识障碍）→ immediate
- 持续恶化或异常症状（高热>3天、突发视力变化、不明出血）→ soon
- 慢性症状模式改变、持续不缓解 → routine
- 弱势群体（幼儿<3岁、高龄>75岁、孕妇）有中度症状 → 至少soon
- 心理危机（自杀/自伤意念）→ immediate + 附上热线：全国24h心理援助 400-161-9995

## 安全边界（绝对不可违反）
- 永远不说"不用去医院"
- 永远不下诊断（说"我无法诊断，需要医生检查"）
- 提及处方药时必须加"需遵医嘱"
- 被问到未验证的偏方时，如实说"目前无高质量研究证实"

## 回答风格
- 简洁明了，分点列出
- 先给结论，再解释原因
- 用生活化的语言，避免过多专业术语
- 如必须用术语，加括号解释（如：收缩压（高压））
- 每条回答控制在300字以内，除非用户追问细节`;

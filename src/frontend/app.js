/**
 * Family Doctor Frontend — Single Page App
 *
 * Handles: view routing, chat messaging (SSE streaming),
 * evidence badge rendering, red flag alerts, history storage.
 */

// ============ Configuration ============
const API_BASE = location.hostname === 'localhost' ? 'http://localhost:8787' : '';

// ============ DOM References ============
const viewHome = document.getElementById('view-home');
const viewChat = document.getElementById('view-chat');
const homeInput = document.getElementById('home-input');
const homeSendBtn = document.getElementById('home-send-btn');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const messagesContainer = document.getElementById('messages');
const backBtn = document.getElementById('back-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const suggestionCards = document.querySelectorAll('.suggestion-card');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');

// ============ State ============
let conversationHistory = []; // {role, content}[]
let isStreaming = false;

// ============ View Routing ============
function showView(view) {
  if (view === 'chat') {
    viewHome.classList.add('hidden');
    viewChat.classList.remove('hidden');
    chatInput.focus();
  } else {
    viewChat.classList.add('hidden');
    viewHome.classList.remove('hidden');
    renderHistory();
  }
}

// ============ Event Listeners ============

// Home page: enable send button when there's text
homeInput.addEventListener('input', () => {
  homeSendBtn.disabled = !homeInput.value.trim();
});

// Home page: send message
homeSendBtn.addEventListener('click', () => {
  const text = homeInput.value.trim();
  if (!text) return;
  startNewChat(text);
});

// Home page: Enter to send (Shift+Enter for newline)
homeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    homeSendBtn.click();
  }
});

// Suggestion cards
suggestionCards.forEach(card => {
  card.addEventListener('click', () => {
    startNewChat(card.textContent);
  });
});

// Chat page: enable send button
chatInput.addEventListener('input', () => {
  chatSendBtn.disabled = !chatInput.value.trim();
});

// Chat page: send message
chatSendBtn.addEventListener('click', () => {
  const text = chatInput.value.trim();
  if (!text || isStreaming) return;
  sendMessage(text);
});

// Chat page: Enter to send
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    chatSendBtn.click();
  }
});

// Back button
backBtn.addEventListener('click', () => {
  showView('home');
});

// New chat button
newChatBtn.addEventListener('click', () => {
  if (conversationHistory.length > 0) {
    saveCurrentChat();
  }
  conversationHistory = [];
  messagesContainer.innerHTML = '';
  chatInput.value = '';
});

// ============ Core Chat Logic ============

function startNewChat(text) {
  // Save previous chat if exists
  if (conversationHistory.length > 0) {
    saveCurrentChat();
  }
  conversationHistory = [];
  messagesContainer.innerHTML = '';
  homeInput.value = '';
  homeSendBtn.disabled = true;

  showView('chat');
  sendMessage(text);
}

async function sendMessage(text) {
  if (isStreaming) return;

  // Render user message
  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  // Clear input
  chatInput.value = '';
  chatSendBtn.disabled = true;

  // Show loading
  const loadingEl = appendLoading();

  // Call API with streaming
  isStreaming = true;
  let aiResponse = '';

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: conversationHistory.slice(0, -1), // Exclude current message (already in prompt)
      }),
    });

    if (!response.ok) {
      throw new Error(`服务暂时不可用 (${response.status})`);
    }

    // Remove loading indicator, add AI message bubble
    loadingEl.remove();
    const aiEl = appendMessage('ai', '');
    const contentEl = aiEl.querySelector('.msg-content');

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sources = []; // Will be filled when sources event arrives

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
          const parsed = JSON.parse(data);
          if (parsed.text) {
            aiResponse += parsed.text;
            contentEl.innerHTML = renderMarkdown(aiResponse);
            scrollToBottom();
          }
          if (parsed.sources) {
            sources = parsed.sources;
          }
        } catch {
          // skip malformed
        }
      }
    }

    // Final render with full formatting + source cards
    contentEl.innerHTML = renderAIResponse(aiResponse, sources);
    scrollToBottom();
    conversationHistory.push({ role: 'assistant', content: aiResponse, sources });

    // Auto-save after each complete response
    saveCurrentChat();

  } catch (err) {
    loadingEl?.remove();
    const errorEl = appendMessage('ai', '');
    const contentEl = errorEl.querySelector('.msg-content');
    contentEl.innerHTML = `
      <div class="text-red-600">
        <p class="font-medium">❌ ${escapeHtml(err.message)}</p>
        <p class="text-sm mt-1 text-slate-500">请检查网络连接后重试</p>
        <button onclick="retryLastMessage()" class="mt-3 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm hover:bg-brand-500 transition">
          重新发送
        </button>
      </div>`;
  } finally {
    isStreaming = false;
    scrollToBottom();
  }
}

// ============ Message Rendering ============

function appendMessage(role, content) {
  const wrapper = document.createElement('div');
  wrapper.className = role === 'user' ? 'flex justify-end' : 'flex justify-start';

  if (role === 'user') {
    wrapper.innerHTML = `<div class="msg-user">${escapeHtml(content)}</div>`;
  } else {
    wrapper.innerHTML = `
      <div class="msg-ai">
        <div class="msg-content">${content ? renderAIResponse(content) : ''}</div>
      </div>`;
  }

  messagesContainer.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function appendLoading() {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex justify-start';
  wrapper.innerHTML = `
    <div class="msg-ai">
      <p class="text-sm text-slate-400 mb-1">正在查阅医学资料...</p>
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  messagesContainer.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

// ============ AI Response Formatting ============

function renderAIResponse(text, sources = []) {
  let html = text;

  // Extract and render red flag banners (can have multiple)
  const redFlagRegex = /\[RED_FLAG:(immediate|soon|routine)\]/g;
  let redFlagHtml = '';
  let match;
  while ((match = redFlagRegex.exec(html)) !== null) {
    const level = match[1];
    const config = {
      immediate: { icon: '🚨', msg: '请立即就医或拨打120急救电话！', sub: '这可能是紧急情况，请不要耽搁' },
      soon: { icon: '⚠️', msg: '建议24小时内前往医院就诊', sub: '症状需要医生进一步评估' },
      routine: { icon: 'ℹ️', msg: '建议1周内安排门诊就医', sub: '建议让医生做系统检查' },
    };
    const c = config[level];
    redFlagHtml += `
      <div class="red-flag-banner ${level}">
        <div class="flex items-start gap-2">
          <span class="text-xl">${c.icon}</span>
          <div>
            <p class="font-bold">${c.msg}</p>
            <p class="text-sm font-normal opacity-80 mt-1">${c.sub}</p>
          </div>
        </div>
      </div>`;
  }
  html = html.replace(/\[RED_FLAG:(immediate|soon|routine)\]\s*/g, '');

  // Render evidence level header — user-friendly wording
  html = html.replace(
    /【证据等级：(.*?)】/g,
    (_, level) => {
      const cls = getEvidenceClass(level);
      const friendly = getFriendlyLevel(level);
      return `<div class="evidence-badge ${cls}" style="margin:8px 0;padding:6px 14px;font-size:14px;">${friendly}</div>`;
    }
  );

  // Render inline evidence markers — user-friendly compact pills
  html = html.replace(/🟢/g, '<span class="evidence-badge green" style="display:inline-flex;padding:1px 6px;font-size:11px;vertical-align:middle;">🟢 大量研究证实</span>');
  html = html.replace(/🟡/g, '<span class="evidence-badge yellow" style="display:inline-flex;padding:1px 6px;font-size:11px;vertical-align:middle;">🟡 有研究支持</span>');
  html = html.replace(/🔵/g, '<span class="evidence-badge blue" style="display:inline-flex;padding:1px 6px;font-size:11px;vertical-align:middle;">🔵 医生经验</span>');
  html = html.replace(/🔴/g, '<span class="evidence-badge red" style="display:inline-flex;padding:1px 6px;font-size:11px;vertical-align:middle;">🔴 仅供参考</span>');

  // Remove any text-based source section (we render structured sources below)
  html = html.replace(/(?:证据来源|参考来源|来源)[：:]\s*\n[\s\S]*?(?=\n\n|$)/g, '');

  // Basic markdown rendering
  html = renderMarkdown(html);

  // Render structured source cards (from backend)
  let sourcesHtml = '';
  if (sources.length > 0) {
    const sourceCards = sources.map(s => {
      const levelInfo = getSourceLevelInfo(s.evidenceLevel);
      return `
        <div class="source-card">
          <div class="flex items-start justify-between gap-2">
            <p class="font-medium text-slate-800">${escapeHtml(s.title)}</p>
            <span class="evidence-badge ${levelInfo.cls}" style="font-size:11px;padding:1px 6px;white-space:nowrap;">${levelInfo.label}</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">来源：${escapeHtml(s.source)}</p>
          <p class="text-sm text-slate-600 mt-2">${escapeHtml(s.content)}</p>
        </div>`;
    }).join('');

    sourcesHtml = `
      <div class="source-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">
        📚 查看医学依据 (${sources.length}条) ▾
      </div>
      <div class="source-cards-container hidden">
        ${sourceCards}
      </div>`;
  }

  return redFlagHtml + html + sourcesHtml;
}

function getFriendlyLevel(text) {
  if (text.includes('🟢') || text.includes('强')) return '🟢 大量研究证实，非常可靠';
  if (text.includes('🟡') || text.includes('一般')) return '🟡 有研究支持，比较可靠';
  if (text.includes('🔵') || text.includes('共识')) return '🔵 基于医生经验，可以参考';
  if (text.includes('🔴') || text.includes('参考')) return '🔴 尚无充分研究，仅供参考';
  return '🔵 基于医生经验，可以参考';
}

function getSourceLevelInfo(level) {
  const map = {
    A: { cls: 'green', label: '🟢 可靠' },
    B: { cls: 'yellow', label: '🟡 较可靠' },
    C: { cls: 'blue', label: '🔵 参考' },
    D: { cls: 'red', label: '🔴 待验证' },
  };
  return map[level] || map.C;
}

function getEvidenceClass(text) {
  if (text.includes('🟢') || text.includes('强')) return 'green';
  if (text.includes('🟡') || text.includes('一般')) return 'yellow';
  if (text.includes('🔵') || text.includes('共识')) return 'blue';
  if (text.includes('🔴') || text.includes('参考')) return 'red';
  return 'blue';
}

function renderMarkdown(text) {
  // Parse tables first (before line break replacements)
  text = text.replace(/(?:^|\n)((?:\|.+\|[ \t]*\n)+)/g, (match, tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim());
    // Skip separator rows (|---|---|)
    const dataRows = rows.filter(r => !/^\|[\s\-:]+\|$/.test(r.replace(/\|/g, '|').trim()));
    if (dataRows.length === 0) return match;

    let html = '<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:14px;">';
    dataRows.forEach((row, i) => {
      const cells = row.split('|').filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      const tag = i === 0 ? 'th' : 'td';
      const bgStyle = i === 0 ? 'background:#f1f5f9;font-weight:600;' : '';
      html += '<tr>';
      cells.forEach(cell => {
        html += `<${tag} style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;${bgStyle}">${cell.trim()}</${tag}>`;
      });
      html += '</tr>';
    });
    html += '</table>';
    return html;
  });

  return text
    // Horizontal rules
    .replace(/^---+$/gm, '<hr style="border:0;border-top:1px solid #e2e8f0;margin:12px 0;">')
    // Headings (### → h4, ## → h3, # → h2)
    .replace(/^###\s+(.+)/gm, '<h4 style="font-size:15px;font-weight:600;margin-top:14px;margin-bottom:4px;color:#1e293b;">$1</h4>')
    .replace(/^##\s+(.+)/gm, '<h3 style="font-size:16px;font-weight:600;margin-top:16px;margin-bottom:4px;color:#1e293b;">$1</h3>')
    .replace(/^#\s+(.+)/gm, '<h2 style="font-size:18px;font-weight:700;margin-top:16px;margin-bottom:6px;color:#0f172a;">$1</h2>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Blockquotes
    .replace(/^>\s+(.+)/gm, '<div style="border-left:3px solid #e2e8f0;padding-left:12px;color:#475569;margin:8px 0;">$1</div>')
    // Line breaks
    .replace(/\n\n/g, '</p><p style="margin-top:8px;">')
    .replace(/\n/g, '<br>')
    // Bullet points
    .replace(/^[•\-]\s+(.+)/gm, '<li style="margin-left:16px;list-style:disc;">$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)/gm, '<li style="margin-left:16px;list-style:decimal;">$1</li>');
}

// ============ History (localStorage) ============

function saveCurrentChat() {
  if (conversationHistory.length === 0) return;
  const history = getHistory();
  const firstUserMsg = conversationHistory.find(m => m.role === 'user');
  history.unshift({
    id: Date.now(),
    title: firstUserMsg ? firstUserMsg.content.slice(0, 30) : '对话',
    messages: conversationHistory,
    time: new Date().toLocaleString('zh-CN'),
  });
  // Keep max 20 history items
  localStorage.setItem('fd_history', JSON.stringify(history.slice(0, 20)));
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('fd_history') || '[]');
  } catch {
    return [];
  }
}

function renderHistory() {
  const history = getHistory();
  if (history.length === 0) {
    historySection.classList.add('hidden');
    return;
  }
  historySection.classList.remove('hidden');
  historyList.innerHTML = history.map(item => `
    <button class="w-full text-left p-3 rounded-lg transition" data-id="${item.id}">
      <p class="text-sm truncate">${escapeHtml(item.title)}</p>
      <p class="text-xs mt-1">${item.time}</p>
    </button>
  `).join('');

  // Click to restore conversation
  historyList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const item = history.find(h => h.id === id);
      if (item) {
        conversationHistory = item.messages;
        messagesContainer.innerHTML = '';
        item.messages.forEach(msg => {
          if (msg.role === 'user') {
            appendMessage('user', msg.content);
          } else {
            const el = appendMessage('ai', '');
            el.querySelector('.msg-content').innerHTML = renderAIResponse(msg.content, msg.sources || []);
          }
        });
        showView('chat');
      }
    });
  });
}

// ============ Utilities ============

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Retry last failed message
function retryLastMessage() {
  const lastUserMsg = conversationHistory.filter(m => m.role === 'user').pop();
  if (lastUserMsg) {
    // Remove the error message and the failed user message from history
    conversationHistory.pop(); // remove user msg
    messagesContainer.lastChild?.remove(); // remove error bubble
    messagesContainer.lastChild?.remove(); // remove user bubble
    sendMessage(lastUserMsg.content);
  }
}
// Expose to onclick
window.retryLastMessage = retryLastMessage;

// ============ Init ============
renderHistory();

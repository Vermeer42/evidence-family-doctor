/**
 * Family Doctor Frontend — Single Page App
 *
 * Handles: view routing, chat messaging (SSE streaming),
 * evidence badge rendering, red flag alerts, history storage.
 */

// ============ Configuration ============
const API_BASE = 'http://localhost:8787'; // Dev: local worker; Prod: same domain

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
        } catch {
          // skip malformed
        }
      }
    }

    // Final render with full formatting (re-render to apply all formatting rules cleanly)
    contentEl.innerHTML = renderAIResponse(aiResponse);
    scrollToBottom();
    conversationHistory.push({ role: 'assistant', content: aiResponse });

    // Auto-save after each complete response
    saveCurrentChat();

  } catch (err) {
    loadingEl?.remove();
    const errorEl = appendMessage('ai', '');
    const contentEl = errorEl.querySelector('.msg-content');
    contentEl.innerHTML = `
      <div class="text-red-600">
        <p class="font-medium">❌ ${escapeHtml(err.message)}</p>
        <p class="text-sm mt-1 text-gray-500">请检查网络连接后重试</p>
        <button onclick="retryLastMessage()" class="mt-3 px-4 py-2 bg-primary-600 text-white rounded-full text-sm hover:bg-primary-700 transition">
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
      <p class="text-sm text-gray-500 mb-1">正在查阅医学资料...</p>
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  messagesContainer.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

// ============ AI Response Formatting ============

function renderAIResponse(text) {
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

  // Render evidence level header — make it a prominent card
  html = html.replace(
    /【证据等级：(.*?)】/g,
    (_, level) => {
      const cls = getEvidenceClass(level);
      return `<div class="evidence-badge ${cls}" style="margin:8px 0;padding:6px 14px;font-size:14px;">${level}</div>`;
    }
  );

  // Render inline evidence markers — compact pills
  html = html.replace(/🟢/g, '<span class="evidence-badge green" style="display:inline-flex;padding:1px 6px;font-size:11px;vertical-align:middle;">🟢强</span>');
  html = html.replace(/🟡/g, '<span class="evidence-badge yellow" style="display:inline-flex;padding:1px 6px;font-size:11px;vertical-align:middle;">🟡一般</span>');
  html = html.replace(/🔵/g, '<span class="evidence-badge blue" style="display:inline-flex;padding:1px 6px;font-size:11px;vertical-align:middle;">🔵共识</span>');
  html = html.replace(/🔴/g, '<span class="evidence-badge red" style="display:inline-flex;padding:1px 6px;font-size:11px;vertical-align:middle;">🔴参考</span>');

  // Render source references — collapsible section
  html = html.replace(
    /(?:证据来源|参考来源|来源)[：:]\s*\n([\s\S]*?)(?=\n\n|$)/g,
    (_, sources) => {
      const sourceItems = sources.trim().split('\n').filter(s => s.trim());
      if (sourceItems.length === 0) return '';
      return `
        <div class="source-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">
          📚 证据来源 (${sourceItems.length}) ▾
        </div>
        <div class="source-list hidden">
          ${sourceItems.map(s => `<p class="py-1">${s.replace(/^[\-•\d.]+\s*/, '')}</p>`).join('')}
        </div>`;
    }
  );

  // Basic markdown rendering
  html = renderMarkdown(html);

  return redFlagHtml + html;
}

function getEvidenceClass(text) {
  if (text.includes('🟢') || text.includes('强')) return 'green';
  if (text.includes('🟡') || text.includes('一般')) return 'yellow';
  if (text.includes('🔵') || text.includes('共识')) return 'blue';
  if (text.includes('🔴') || text.includes('参考')) return 'red';
  return 'blue';
}

function renderMarkdown(text) {
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
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
    <button class="w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition" data-id="${item.id}">
      <p class="text-elder text-gray-700 truncate">${escapeHtml(item.title)}</p>
      <p class="text-xs text-gray-400 mt-1">${item.time}</p>
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
          appendMessage(msg.role === 'user' ? 'user' : 'ai', msg.content);
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

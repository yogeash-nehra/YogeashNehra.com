// ── Chat assistant widget ──
// Injects the floating chat assistant on any page that includes this script.
// Talks to /api/chat (streams plain text) and keeps the conversation in
// sessionStorage so it survives navigating between pages.

(function () {
  if (document.getElementById('chat-widget')) return;

  const STORE_KEY = 'yn-chat';
  const CONTACT = 'info@yogeashnehra.com';
  const GREETING = "Hi, I'm Yogeash, or rather my AI assistant. Ask me about my work, my projects, or what I'm building right now.";
  // Quick starts, one per kind of visitor: [label, message sent]
  const STARTERS = [
    ['Hiring? Get the 30-second pitch', "I'm hiring. Give me your 30-second pitch."],
    ["I'm an engineer, talk tech", "I'm an engineer. What's the most technically interesting thing you've built?"],
    ['What are you working on now?', 'What are you working on right now?'],
    ['Just saying hi 👋', "Just browsing. Tell me a bit about yourself."],
  ];

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/chat.css';
  document.head.appendChild(css);

  document.body.insertAdjacentHTML('beforeend', `
<div class="chat-widget" id="chat-widget">
  <div class="chat-panel" id="chat-panel" role="dialog" aria-label="Chat with Yogeash's AI assistant">
    <div class="chat-header">
      <div class="chat-avatar" aria-hidden="true">YN</div>
      <div class="chat-header-info">
        <h4>Yogeash Nehra <span class="chat-badge">AI</span></h4>
        <p><span class="chat-online"></span>Online · ask about my work</p>
      </div>
      <div class="chat-header-actions">
        <button class="chat-reset" id="chat-reset" type="button" title="Clear this conversation and start fresh">New chat</button>
        <button class="chat-close" id="chat-close" type="button" aria-label="Close chat">✕</button>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages" aria-live="polite"></div>
    <div class="chat-suggestions" id="chat-suggestions">
      ${STARTERS.map(([label, msg]) => `<button class="chat-suggestion" type="button" data-msg="${msg.replace(/"/g, '&quot;')}">${label}</button>`).join('')}
    </div>
    <div class="chat-input-row">
      <input class="chat-input" id="chat-input" type="text" placeholder="Ask me anything…" maxlength="600" autocomplete="off" aria-label="Your message">
      <button class="chat-send" id="chat-send" type="button" aria-label="Send">→</button>
    </div>
    <p class="chat-footnote">AI-generated answers, so the odd one may be off. For anything important: <a href="mailto:${CONTACT}">${CONTACT}</a></p>
  </div>
  <button class="chat-btn" id="chat-btn" type="button" aria-label="Chat with Yogeash's AI assistant">
    <span class="chat-btn-icon" aria-hidden="true">✦</span><span class="chat-btn-label">Ask me anything</span>
  </button>
</div>`);

  const widget = document.getElementById('chat-widget');
  const panel = document.getElementById('chat-panel');
  const messagesEl = document.getElementById('chat-messages');
  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');
  const suggestions = document.getElementById('chat-suggestions');

  let history = [];
  let controller = null; // aborts an in-flight reply when starting a new chat
  try { history = JSON.parse(sessionStorage.getItem(STORE_KEY)) || []; } catch { history = []; }
  function save() {
    try {
      if (history.length) sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-30)));
      else sessionStorage.removeItem(STORE_KEY);
    } catch { /* storage unavailable */ }
  }

  // Escape, then allow **bold**, [text](url), site paths, profile URLs and emails as links.
  function render(text) {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[\w\-/]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])((?:https?:\/\/)?(?:[\w-]+\.)?yogeashnehra\.com[\w\-/]*|(?:https?:\/\/)?(?:www\.)?(?:github\.com|linkedin\.com\/in)\/[\w\-/]+)/g,
        (m, pre, url) => `${pre}<a href="${url.startsWith('http') ? url : 'https://' + url}" target="_blank" rel="noopener">${url}</a>`)
      .replace(/(^|[\s(])(\/(?:idea|ai-lab|capstone|projects|stack|live|resume))\b/g, '$1<a href="$2">$2</a>')
      .replace(/([\w.+-]+@[\w-]+\.[\w.]+\w)/g, '<a href="mailto:$1">$1</a>');
  }

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'chat-message ' + role;
    div.innerHTML = render(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function renderAll() {
    messagesEl.innerHTML = '';
    addMessage('assistant', GREETING);
    history.forEach(m => addMessage(m.role, m.content));
    suggestions.style.display = history.length ? 'none' : '';
  }

  function setLoading(loading) {
    send.disabled = loading;
    send.textContent = loading ? '…' : '→';
  }

  async function ask(question) {
    question = question.trim();
    if (!question || controller) return;
    suggestions.style.display = 'none';
    history.push({ role: 'user', content: question });
    addMessage('user', question);
    input.value = '';
    setLoading(true);

    const bubble = addMessage('assistant', '');
    bubble.innerHTML = '<span class="chat-typing"><span></span><span></span><span></span></span>';
    const mine = controller = new AbortController();
    let reply = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: mine.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        bubble.innerHTML = render(reply);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
      reply = reply.trim() || "Sorry, I didn't catch that. Could you try asking another way?";
      bubble.innerHTML = render(reply);
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      if (mine.signal.aborted) return; // "New chat" was pressed; that conversation is gone
      bubble.textContent = err.message && err.message !== 'Failed to fetch' ? err.message : 'Could not reach the server. Please try again.';
      history.pop(); // drop the unanswered question so it can be retried
    } finally {
      if (controller === mine) { controller = null; setLoading(false); }
    }
    save();
    input.focus();
  }

  function newChat() {
    if (controller) controller.abort();
    controller = null;
    setLoading(false);
    history = [];
    save();
    renderAll();
    input.value = '';
    input.focus();
  }

  function toggle(open) {
    panel.classList.toggle('open', open);
    widget.classList.toggle('is-open', open);
    if (open) input.focus();
  }

  document.getElementById('chat-btn').addEventListener('click', () => toggle(!panel.classList.contains('open')));
  document.getElementById('chat-close').addEventListener('click', () => toggle(false));
  document.getElementById('chat-reset').addEventListener('click', newChat);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
  send.addEventListener('click', () => ask(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') ask(input.value); });
  suggestions.querySelectorAll('.chat-suggestion').forEach(s => s.addEventListener('click', () => ask(s.dataset.msg)));

  renderAll();
})();

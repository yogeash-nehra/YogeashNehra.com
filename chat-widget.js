// ── "Ask AI Yogeash" chat widget ──
// Injects the floating chat bubble on any page that includes this script.
// Talks to /api/chat (streams plain text) and keeps the conversation in
// sessionStorage so it survives navigating between pages.

(function () {
  if (document.getElementById('chat-widget')) return;

  const STORE_KEY = 'ai-yogeash-chat';
  const GREETING = "Kia ora! I'm AI Yogeash — Yogi's digital twin. Ask me what I build, what I know, or what kind of work gets me out of bed. (The real me is just an email away.)";
  const SUGGESTIONS = [
    'What do you love building?',
    "What's your stack?",
    'Tell me about the rover',
    'What roles interest you?',
    'Tell me something fun',
  ];

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/chat.css';
  document.head.appendChild(css);

  document.body.insertAdjacentHTML('beforeend', `
<div class="chat-widget" id="chat-widget">
  <div class="chat-panel" id="chat-panel" role="dialog" aria-label="Chat with AI Yogeash">
    <div class="chat-header">
      <div class="chat-header-info">
        <h4>Ask AI Yogeash</h4>
        <p>My AI twin · a little witty, mostly accurate</p>
      </div>
      <div class="chat-header-actions">
        <button class="chat-reset" id="chat-reset" type="button" title="Start a new chat">New</button>
        <button class="chat-close" id="chat-close" type="button" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages" aria-live="polite"></div>
    <div class="chat-suggestions" id="chat-suggestions">
      ${SUGGESTIONS.map(s => `<button class="chat-suggestion" type="button">${s}</button>`).join('')}
    </div>
    <div class="chat-input-row">
      <input class="chat-input" id="chat-input" type="text" placeholder="Ask me anything…" maxlength="600" autocomplete="off">
      <button class="chat-send" id="chat-send" type="button" aria-label="Send">→</button>
    </div>
  </div>
  <button class="chat-btn" id="chat-btn" type="button" aria-label="Chat with AI Yogeash">✦</button>
</div>`);

  const btn = document.getElementById('chat-btn');
  const panel = document.getElementById('chat-panel');
  const messagesEl = document.getElementById('chat-messages');
  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');
  const suggestions = document.getElementById('chat-suggestions');

  let history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORE_KEY)) || []; } catch { history = []; }
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-30))); } catch { /* storage unavailable */ }
  }

  // Escape, then allow **bold**, [text](url) and bare site paths / URLs / emails as links.
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
    input.disabled = loading;
    send.textContent = loading ? '…' : '→';
  }

  async function ask(question) {
    question = question.trim();
    if (!question || send.disabled) return;
    suggestions.style.display = 'none';
    history.push({ role: 'user', content: question });
    addMessage('user', question);
    input.value = '';
    setLoading(true);

    const bubble = addMessage('assistant', '');
    bubble.innerHTML = '<span class="chat-typing"><span></span><span></span><span></span></span>';
    let reply = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong — try again.');
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
      reply = reply.trim() || 'Hmm, I drew a blank — try asking another way?';
      bubble.innerHTML = render(reply);
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      bubble.textContent = err.message && err.message !== 'Failed to fetch' ? err.message : 'Could not reach the server — try again.';
      history.pop(); // drop the unanswered question so it can be retried
    }
    save();
    setLoading(false);
    input.focus();
  }

  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) input.focus();
  });
  document.getElementById('chat-close').addEventListener('click', () => panel.classList.remove('open'));
  document.getElementById('chat-reset').addEventListener('click', () => {
    history = [];
    save();
    renderAll();
    input.focus();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.classList.remove('open'); });
  send.addEventListener('click', () => ask(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') ask(input.value); });
  suggestions.querySelectorAll('.chat-suggestion').forEach(s => s.addEventListener('click', () => ask(s.textContent)));

  renderAll();
})();

import Anthropic from '@anthropic-ai/sdk';
import { PERSONA } from './_persona.js';

// Haiku keeps a public chat bubble fast and cheap; override with CHAT_MODEL.
const MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';
const MAX_TURNS = 16;          // messages of history sent to the model
const MAX_MESSAGE_CHARS = 600; // per visitor message
const RATE_LIMIT = 30;         // requests per IP per window
const RATE_WINDOW_MS = 10 * 60 * 1000;

// Best-effort per-instance rate limit (serverless instances don't share memory).
const hits = new Map();
function rateLimited(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > RATE_LIMIT;
}

function cleanHistory(raw) {
    if (!Array.isArray(raw)) return null;
    const msgs = raw
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, m.role === 'user' ? MAX_MESSAGE_CHARS : 2000).trim() }))
        .filter(m => m.content)
        .slice(-MAX_TURNS);
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
    return msgs;
}

const client = new Anthropic();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Not configured' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (rateLimited(ip)) {
        return res.status(429).json({ error: "Easy there — I've had a lot of questions from you. Give me a few minutes to catch my breath." });
    }

    // Accept the new { messages: [...] } shape, or the old { message: "..." } one.
    const body = req.body || {};
    const messages = cleanHistory(body.messages || (typeof body.message === 'string' ? [{ role: 'user', content: body.message }] : null));
    if (!messages) return res.status(400).json({ error: 'Invalid message' });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    let wrote = false;
    try {
        const stream = client.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            output_config: { effort: 'low' },
            system: [{ type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } }],
            messages,
        });

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                res.write(event.delta.text);
                wrote = true;
            }
        }

        const final = await stream.finalMessage();
        if (!wrote) {
            res.write(final.stop_reason === 'refusal'
                ? "That's one I'll sit out. Ask me about my projects, stack, or what I'm building instead?"
                : 'Hmm, I drew a blank there — try asking another way?');
        }
    } catch (err) {
        console.error('chat error', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
        if (!wrote) {
            const busy = err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && err.status >= 500);
            res.write(busy
                ? "My brain's a bit busy right now — try again in a moment."
                : 'Something went sideways on my end — try again, or email the real me at yogi.nehra14@gmail.com.');
        }
    }
    res.end();
}

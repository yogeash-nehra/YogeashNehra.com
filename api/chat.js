import Anthropic from '@anthropic-ai/sdk';
import { PERSONA } from './_persona.js';

// Opus gives the sharpest, most convincing answers; set CHAT_MODEL=claude-sonnet-5-5
// (or claude-haiku-5-5) to trade some polish for lower cost.
const MODEL = process.env.CHAT_MODEL || 'claude-opus-5-5';
const MAX_TURNS = 16;           // messages of history sent to the model
const MAX_MESSAGE_CHARS = 4000; // per visitor message (room for a pasted job description)
const RATE_LIMIT = 30;          // requests per IP per window
const RATE_WINDOW_MS = 10 * 60 * 1000;
const GITHUB_USER = 'yogeash-nehra';
const PULSE_TTL_MS = 15 * 60 * 1000;

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

// Live public GitHub activity for the last 7 days, cached per instance so the
// unauthenticated API (60 req/hour) is hit at most every 15 minutes.
let pulse = { at: 0, text: null };
function relative(ms) {
    const h = Math.round(ms / 3600000);
    return h < 1 ? 'under an hour ago' : h < 48 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
}
export function summarisePulse(events, now = Date.now()) {
    const week = events.filter(e => now - new Date(e.created_at) < 7 * 86400000);
    const pushes = week.filter(e => e.type === 'PushEvent');
    if (!pushes.length) return null;
    const perRepo = new Map();
    let commits = 0, commitsKnown = true;
    for (const e of pushes) {
        const repo = e.repo.name.replace(`${GITHUB_USER}/`, '');
        // GitHub stopped including commit lists in push events in 2025; fall back to push counts.
        const n = Array.isArray(e.payload?.commits) ? e.payload.commits.length : e.payload?.size;
        if (typeof n === 'number') commits += n; else commitsKnown = false;
        perRepo.set(repo, (perRepo.get(repo) || 0) + 1);
    }
    const repos = [...perRepo].sort((a, b) => b[1] - a[1]).map(([r, c]) => `${r} (${c} push${c > 1 ? 'es' : ''})`);
    const created = week.filter(e => e.type === 'CreateEvent' && e.payload?.ref_type === 'repository').map(e => e.repo.name.replace(`${GITHUB_USER}/`, ''));
    return [
        'LIVE GITHUB ACTIVITY (public repositories only, last 7 days, fetched moments ago):',
        `- ${pushes.length} pushes${commitsKnown ? ` (${commits} commits)` : ''} across ${perRepo.size} repo${perRepo.size > 1 ? 's' : ''}: ${repos.slice(0, 6).join(', ')}.`,
        `- Most recent push: ${relative(now - new Date(pushes[0].created_at))}, to ${pushes[0].repo.name.replace(`${GITHUB_USER}/`, '')}.`,
        created.length ? `- New public repos this week: ${created.join(', ')}.` : '',
    ].filter(Boolean).join('\n');
}
async function githubPulse() {
    if (Date.now() - pulse.at < PULSE_TTL_MS) return pulse.text;
    pulse.at = Date.now(); // also throttles retries when GitHub is down
    try {
        const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/events/public?per_page=100`, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'yogeashnehra.com-chat' },
            signal: AbortSignal.timeout(1500),
        });
        if (res.ok) pulse.text = summarisePulse(await res.json());
    } catch { /* keep the last good value; the chat works without it */ }
    return pulse.text;
}

const client = new Anthropic();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Not configured' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (rateLimited(ip)) {
        return res.status(429).json({ error: "You've sent a lot of messages in a short time. Please try again in a few minutes." });
    }

    // Accept the new { messages: [...] } shape, or the old { message: "..." } one.
    const body = req.body || {};
    const messages = cleanHistory(body.messages || (typeof body.message === 'string' ? [{ role: 'user', content: body.message }] : null));
    if (!messages) return res.status(400).json({ error: 'Invalid message' });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    // Live data goes after the cached persona so the cached prefix never changes.
    const live = await githubPulse();
    const system = [{ type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } }];
    if (live) system.push({ type: 'text', text: live });

    let wrote = false;
    try {
        const stream = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            output_config: { effort: 'low' },
            // If a safety classifier declines a harmless question, retry on a fallback model.
            ...(MODEL.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
            system,
            messages,
        });
        // Visitor closed the tab or hit "New chat": stop generating tokens nobody will read.
        res.on('close', () => { if (!res.writableEnded) stream.abort(); });

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                res.write(event.delta.text);
                wrote = true;
            }
        }

        const final = await stream.finalMessage();
        if (!wrote) {
            res.write(final.stop_reason === 'refusal'
                ? "I can't help with that one, but I'm happy to talk about my work, projects or experience."
                : 'Sorry, I didn\'t catch that. Could you try asking another way?');
        }
    } catch (err) {
        // An abort means the visitor already left, so there's no one to tell.
        if (!(err instanceof Anthropic.APIUserAbortError)) {
            console.error('chat error', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
            if (!wrote) {
                const busy = err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && err.status >= 500);
                res.write(busy
                    ? "I'm getting a lot of questions right now. Please try again in a moment."
                    : 'Something went wrong on my end. Please try again, or reach me at info@yogeashnehra.com.');
            }
        }
    }
    res.end();
}

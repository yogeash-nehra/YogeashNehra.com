export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(500).json({ error: { message: 'Server API key not configured.' } });

    const { prompt, maxTokens } = req.body;
    if (!prompt || !maxTokens) return res.status(400).json({ error: { message: 'Missing prompt or maxTokens.' } });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    const data = await response.json();
    res.status(response.status).json(data);
}

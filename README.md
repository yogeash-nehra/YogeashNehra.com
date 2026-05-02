# YogeashNehra.com

Personal portfolio and AI work hub — built with vanilla HTML, CSS, and JavaScript. Deployed on Vercel.

**Live:** [yogeashnehra.com](https://yogeashnehra.com)  
**Innovation & AI Lab:** [dev.yogeashnehra.com](https://dev.yogeashnehra.com)

---

## Pages

| Page | File | Description |
|---|---|---|
| Home | `index.html` | Landing page with hero, about, and featured projects |
| Projects | `projects.html` | Full showcase of 19+ projects |
| Capstone | `capstone.html` | PiLot Autonomous Rover deep-dive |
| Idea Lab | `idea.html` | AI-powered idea analyser (Claude / GPT-4o) |

## Stack

- Vanilla HTML, CSS, JavaScript — no framework, no build step
- Shared navbar injected via `navbar.js`
- Single stylesheet `styles.css`
- Deployed on Vercel with clean URLs via `vercel.json`
- Vercel Web Analytics on all pages

## Running locally

```bash
# Any static file server works — e.g. with VS Code Live Server,
# or via npx:
npx serve .
```

Then open `http://localhost:3000`.

## Innovation & AI Lab

AI experiments, tools, and builds live at **[dev.yogeashnehra.com](https://dev.yogeashnehra.com)** — a dedicated space separate from the main portfolio for shipping new AI work.

### Idea Lab

The Idea Lab (`idea.html`) is a client-side AI tool. It supports:

- **Anthropic (Claude)** and **OpenAI (GPT-4o)** — bring your own API key
- API keys are stored in `localStorage` only — nothing is sent to any server other than the AI provider
- Three analysis phases: Feasibility score → Execution plan → Repo scaffold download

## Project structure

```
YogeashNehra.com/
├── index.html
├── projects.html
├── capstone.html
├── idea.html
├── styles.css
├── navbar.js
├── logo.png
├── rover.webp
├── ynfavicon.ico
└── vercel.json
```

## Deployment

Pushes to the `simple` branch auto-deploy to production via Vercel. The `vercel.json` strips `.html` extensions for clean URLs.

---

[LinkedIn](https://www.linkedin.com/in/yogeash-nehra/) · [Email](mailto:info@yogeashnehra.com)

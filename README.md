# ayushmanrocks

Personal site — plain HTML/CSS/JS, no build step.

## Run locally
    cd site && python3 -m http.server 5173
Open http://localhost:5173

## Edit content (all in index.html)
- **Projects** — the `<article class="proj">` blocks in the WORK section. The four projects are placeholders: replace them with your real ones.
- **Skills** — the `<article class="skill">` blocks.
- **Beyond** — the `<li>` items in `#beyondList`.
- **Stats** — the `data-count` numbers in the About section.
- **Links** — search for `https://github.com` and `https://linkedin.com` and swap in your profile URLs.
- **Photo** — the hero uses `assets/img/ayushman-cutout.webp` (background removed). `ayushman-md.jpg` is only the link-preview image.
- **Colours** — `--papaya` at the top of `css/style.css`.

## Contact form
By default it opens the visitor's mail app with the message pre-filled.
To receive messages directly: create a free form at formspree.io, then set
`FORM_ENDPOINT` in `js/main.js` to the URL it gives you.

## Deploy
Drag the `site` folder onto app.netlify.com/drop, or push it to GitHub and enable GitHub Pages / Vercel.

## GitHub contributions (Pit Wall section)
`data/contributions.json` is refreshed daily by `.github/workflows/contributions.yml`,
which runs `scripts/fetch-contributions.mjs` using the repo secret `CONTRIB_TOKEN`
(a fine-grained personal access token). To refresh manually: Actions tab →
"Update GitHub contributions" → Run workflow.

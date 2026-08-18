# Asia Pacific Language School — Website

A hand-built static website for Asia Pacific Language School (APLS), a Chinese &
Japanese preschool and language school in Bellevue, WA.

## What this is

Plain HTML + CSS. **No framework, no build step, no dependencies.** To view it,
just open `index.html` in any web browser.

## Structure

```
apls-website/
├── index.html        Homepage
├── css/styles.css    All site styling
└── images/           Illustrations and logo
```

## Editing

Content meant to be updated is marked in the HTML with `<!-- ✏️ EDIT: ... -->`
comments.

### Time-limited enrollment badges

Every **Now enrolling** badge for a program with fixed start/end dates must include
`data-enrollment-end="YYYY-MM-DD"`, using that program's final day. The shared
`js/enrollment-status.js` script keeps the badge visible through the final day and
removes it automatically the next day.

When dates are updated for a future year, update `data-enrollment-end` everywhere
that program's badge appears. Do not publish a fixed-date program badge without an
end date.

```html
<span class="badge-open" data-enrollment-end="2027-08-20">Now enrolling</span>
```

### Quick-answer chatbox

The site-wide **Ask APLS** widget is a client-side, rule-based FAQ chatbox. It
does not use an LLM, external API, database, or visitor tracking.

- Edit approved answers and matching phrases in `data/chat-knowledge.js`.
- Edit prices only in `data/tuition.js`; chat tuition answers read that file.
- Interface behavior lives in `js/chatbox.js` and styles live in `css/styles.css`.
- Questions without a reliable match direct visitors to the Contact page.

## Deploying

This folder is the complete, portable website. To publish, upload the contents
of `apls-website/` to the website host. No special server or software required.

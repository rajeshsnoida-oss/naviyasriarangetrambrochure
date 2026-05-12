# Project init interview

Recorded 2026-05-12. Source of truth for `/project-init --re-init`.

## 1. What we're building

A 12-section webpage for the Bharatanatyam Arangetram (debut performance) brochure of Kum. Swapna Ramachandran, presented by Shree Nrithya Niketan. The event is on July 26, 2025, 4 PM at Rasika Ranjani Sabha, Mylapore, Chennai. The page mirrors a printed brochure — static content with a predefined design skeleton the owner fills manually. An interactive feedback section at the end allows audience members to leave named feedback, which is persisted to a Google Sheets spreadsheet and displayed as clickable links.

Brochure sections (12 pages):
1. Cover — title, performer name, date, venue
2. School mission & Guru's message
3–9. 7 dance items (Maargam/program)
8. Artist biography (Shishya)
9. Guru biography
10–11. Orchestra musician bios
12. Gratitude / credits

All page content is template-based; the owner fills in actual text manually.

## 2. How we're building

**Stack:**
- Frontend: plain HTML / CSS / JavaScript (no build tools, no framework)
- Backend: Google Apps Script (Web App) — handles feedback POST (writes to Google Sheets) and feedback GET (returns rows as JSON)
- Hosting: GitHub Pages

**Module definition:**
Each logical feature area under `src/` is a module. MODULE.md lives at `src/<module>/MODULE.md`. Modules correspond to interactive/dynamic features and major content groupings, not individual HTML sections.

**Visibility mapping (JavaScript):**
- `export` / `export default` → pub
- non-exported functions/classes/variables → internal

**Visibility mapping (CSS):**
- Classes referenced from HTML outside the module's own template → pub
- Helper classes only used within the module's CSS → internal

## 3. Stakeholder map

Solo project. Owner is the sole contributor, directly edits files.

| Stakeholder / Role | Contributes | Interface | Feedback loop |
|---|---|---|---|
| Owner (sole developer) | All code, content, design decisions | Direct file edit | Self-review |

## 4. Domain constraints

- Fully responsive: mobile (≤ 480px), tablet (481–1024px), desktop (> 1024px)
- Print-to-PDF: browser print dialog triggered by an on-page button, supported by a `print.css` layer
- Accessibility: WCAG 2.1 AA target
- Bilingual: English (default) + Tamil (manual toggle, on-demand — no auto-detection)
- Tamil font: Noto Sans Tamil via Google Fonts (`font-display: swap`)
- No regulated data, no authentication required

## 5. LLM access model

Claude has direct browser access during development — can view the running site via a local server to verify layout, responsive behaviour, print output, and Tamil rendering.

## 6. Pain points

No specific pain points identified. Best-judgment watchlist:
- Google Apps Script CORS configuration and deployment (Web App must be "Anyone" access)
- Tamil font rendering inconsistencies across browsers
- Print CSS is frequently tricky — page breaks, margins, hidden interactive elements
- Feedback form has no authentication — spam/abuse risk at a public event (Open question)
- Google Sheets API rate limits (low risk for event brochure traffic)

## 7. Artifact preferences

No specific preference stated. Convention applied:
- Minimal inline HTML/JS comments for non-obvious choices only (no what-comments, only why-comments)
- Brief README.md at repo root
- No separate design docs beyond the COMPACT scaffold

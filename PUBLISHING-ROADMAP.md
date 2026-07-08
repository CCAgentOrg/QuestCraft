# QuestCraft — Publishing Roadmap

**Repo:** `CCAgentOrg/QuestCraft` (forked from `srikanthlogic/QuestCraft`)
**Current deployment:** `aipoly.vercel.app` / `quest-craft.vercel.app`
**Origin:** Generated from Google AI Studio repository template

This roadmap covers the gap between the current state (working prototype from AI Studio) and a **shippable open-source product** — published, documented, tested, and distributable under CCAgentOrg.

---

## Phase 0: Fork & Initialize ✅

- [x] Fork `srikanthlogic/QuestCraft` → `CCAgentOrg/QuestCraft`
- [x] Clone to `Projects/QuestCraft/` in workspace
- [ ] Set up GitHub branch protection + team access

---

## Phase 1: Repo Hygiene & Branding (4-6h)

Replace AI Studio boilerplate with a proper open-source project identity.

### 1.1 README Rewrite
- [ ] **Status badge row**: build, license, PRs welcome, last commit
- [ ] **Elevator pitch**: AI-powered educational board game engine — what, why, who
- [ ] **Screenshots/GIFs**: animated gameplay, quest maker wizard
- [ ] **Quick start**: clone → `npm install` → set API key → `npm run dev`
- [ ] **Built-in quests**: table of 8+ quests with descriptions
- [ ] **AI providers**: table with supported providers and capabilities
- [ ] **Localization**: 4 languages supported
- [ ] **Contributing**: link to CONTRIBUTING.md
- [ ] **License**: MIT or AGPL-3.0

### 1.2 Brand Assets
- [ ] **Favicon**: dice/quest-themed SVG (replace AI Studio default)
- [ ] **OG image**: 1200×630 social preview
- [ ] **`index.html`**: update title, meta description, OG tags
- [ ] **Custom 404 page** (Vercel SPA fallback)

### 1.3 Legal & Governance
- [ ] **`LICENSE`** file (MIT recommended)
- [ ] **`CONTRIBUTING.md`**: PR workflow, commit conventions, code review
- [ ] **`CODE_OF_CONDUCT.md`**: Contributor Covenant 2.1
- [ ] **`SECURITY.md**`: how to report vulnerabilities
- [ ] **Issue templates**: bug report + feature request + quest request

### 1.4 Clean AI Studio Residue
- [ ] Remove AI Studio app link from README
- [ ] Replace `.env.sample` → `.env.example` (cleaner convention)
- [ ] Remove duplicate `vite.config.js` (keep `vite.config.ts`)
- [ ] Remove bogus deps from `package.json`:
  - `"path": "^0.12.7"` — Node polyfill, not needed in browser
  - `"fs": "^0.0.1-security"` — Node polyfill, not needed in browser
  - `"vite": "^6.2.0"` in devDeps (already `"^7.1.2"` in deps)
- [ ] Fix `vite.config.ts`: replace `process.env` with Vite's `import.meta.env` pattern
- [ ] Verify no hardcoded API keys anywhere in source

### 1.5 Dependency Audit
- [ ] `npm audit` all packages
- [ ] Remove unused deps (`showdown`? `ai`? `openai`? `vite-plugin-static-copy`?)

---

## Phase 2: CI/CD & Quality Tooling (6-8h)

Automated build, lint, test, and deploy pipeline.

### 2.1 GitHub Actions CI
- [ ] **`.github/workflows/ci.yml`**: push to main + PR to main
  - Node setup → `npm ci` → lint → typecheck → test → build
  - Cache `node_modules` for speed

### 2.2 Linting & Formatting
- [ ] **ESLint** flat config: `@typescript-eslint`, `react-hooks`, `react`
- [ ] **Prettier** config: 4-space indent, no tabs, trailing commas multiline
- [ ] **`npm run lint`** with auto-fix
- [ ] **`npm run format`**

### 2.3 TypeScript Rigor
- [ ] **`npm run typecheck`** (`tsc --noEmit`)
- [ ] `tsconfig.json` → `strict: true`
- [ ] Fix existing type errors

### 2.4 Testing
- [ ] **Vitest** + React Testing Library
- [ ] Component smoke tests (App renders, GamePage renders)
- [ ] Service unit tests (gameStateService, settingsService, statsService)
- [ ] Integrate existing `test:prompts` into CI (non-blocking)

### 2.5 Vercel Deployment
- [ ] **`vercel.json`**: framework preset `vite`, SPA rewrites, security headers
- [ ] **Environment variables** in Vercel project: `GEMINI_API_KEY`
- [ ] **Preview deployments** for PR branches
- [ ] **`vercel.json`** with SPA fallback for client-side routing

### 2.6 Automated Publishing
- [ ] Auto-deploy to Vercel on merge to `main` (Vercel GitHub integration or GH Action)

---

## Phase 3: UX Hardening & Polish (8-12h)

A prototype works on happy paths. A published product handles failures gracefully.

### 3.1 Error Handling
- [ ] **React Error Boundary** — recoverable error screen, not white page
- [ ] **AI service errors**: specific message + retry, not console.error + blank UI
- [ ] **localStorage full**: catch `QuotaExceededError`, clear instructions
- [ ] **Network offline**: banner when browser goes offline
- [ ] **API key validation**: test on save, inline pass/fail feedback

### 3.2 Loading & Empty States
- [ ] **Skeleton loaders**: quest list, game board, stats dashboard
- [ ] **Empty states**: "No quests yet" with CTA
- [ ] **Progress indicators**: spinner with estimated time for AI generation
- [ ] **Page transitions**: smooth between home → game → results

### 3.3 Onboarding
- [ ] **First-visit flow**: select language → set AI provider → play tutorial quest
- [ ] **Tooltips**: hover key elements (resources, dice, jail, scenarios)
- [ ] **Guided quest creation**: step-by-step wizard tour

### 3.4 Mobile & Accessibility
- [ ] **Touch targets** ≥ 44×44px
- [ ] **Bottom sheet** instead of drawers on mobile
- [ ] **Screen reader labels**: `aria-label` on icon buttons
- [ ] **Keyboard nav**: Tab through board, Enter/Space to act, Escape close
- [ ] **Focus trap** in modals/drawers
- [ ] **`prefers-reduced-motion`** media query
- [ ] **WCAG AA** color contrast on dark theme

### 3.5 Data Persistence
- [ ] **IndexedDB** via `idb-keyval` for larger data (custom quests, game history)
- [ ] **Migration layer**: read localStorage, write IndexedDB, deprecate localStorage
- [ ] **Game resume**: detect incomplete game on load, offer to continue

---

## Phase 4: Content & Discovery (6-8h)

Make the app discoverable and usable without external guidance.

### 4.1 Home Page Redesign
- [ ] Hero: tagline + CTA + screenshot/GIF
- [ ] Quest showcase: card grid with title, description, difficulty, language badges
- [ ] AI providers section with supported models
- [ ] Features: multi-language, multiplayer, quest maker, web search
- [ ] Footer: GitHub, license, acknowledgments

### 4.2 Quest Library
- [ ] **Difficulty rating**: ⭐1-5 per quest
- [ ] **Category tags**: Education, Finance, Tech, Social, Environment
- [ ] **Search & filter**: category, language, difficulty, player count
- [ ] **Quest preview**: full details before starting

### 4.3 Documentation
- [ ] **In-app help**: "?" icon → contextual help popover
- [ ] **User guide**: game rules, quest creation, AI provider setup
- [ ] **FAQ**: common questions
- [ ] **60s demo video**: gameplay loop → publish to YouTube/zo.pub

### 4.4 SEO & Social
- [ ] **Meta tags** per route (Home, Game, Maker, Docs)
- [ ] **JSON-LD structured data**: `WebApplication`, `Game`
- [ ] **Sitemap.xml** for Vercel
- [ ] **OG images** for social sharing
- [ ] **Robots.txt**

---

## Phase 5: Launch Preparation (4-6h)

Go public across social, product directories, and developer communities.

### 5.1 GitHub Launch
- [ ] **Topics**: `educational-game`, `ai`, `board-game`, `react`, `typescript`, `gemini`, `openai`, `quest`, `localization`, `tamil`
- [ ] **Release v0.1.0** with changelog
- [ ] **GitHub Discussions**: Show and Tell, Q&A, Quest Submissions, Ideas

### 5.2 Distribution
- [ ] **Hacker News**: "Show HN: QuestCraft — AI-powered open-source board game engine"
- [ ] **Reddit**: r/reactjs, r/typescript, r/opensource
- [ ] **Product Hunt** submission
- [ ] **CashlessConsumer newsletter** feature
- [ ] **Tweet** from @Cashlessconsumerin with demo clip

### 5.3 Observability
- [ ] **Vercel Analytics**: page views, errors
- [ ] **Usage opt-in**: anonymized stats (games played, quests created)
- [ ] **Logger**: ensure DEBUG_LEVEL toggles cleanly in production

---

## Phase 6: Ecosystem & Sustainability (ongoing)

### 6.1 Community Quests
- [ ] **Quest submission PR template**
- [ ] **Community gallery** in-app (curated from GitHub)
- [ ] **Quest rating**: 👍/👎

### 6.2 Advanced Features (from existing ROADMAP.md)
- [ ] Visual quest builder (drag-drop board editor)
- [ ] Skill + XP system + leaderboards
- [ ] Real-time multiplayer (WebRTC / WebSocket)
- [ ] Multi-turn AI conversations

### 6.3 Sustainability
- [ ] **GitHub Sponsors** for hosting costs
- [ ] **Premium quest marketplace** (opt-in)
- [ ] **Institution licensing** (schools/universities)

---

## Immediate Next Steps (High-Leverage First)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Rewrite README + add LICENSE + remove AI Studio boilerplate | 1h | 🟢 First impression |
| 2 | Fix `vite.config.ts` + deduplicate deps | 30m | 🟢 Build reliability |
| 3 | Add `vercel.json` + configure Vercel project | 30m | 🟢 Deployment stability |
| 4 | Add ESLint + Prettier | 1h | 🟢 Code quality gate |
| 5 | Add GitHub Actions CI (build + typecheck) | 1h | 🟢 Prevent regressions |
| 6 | Error Boundary + loading states | 2h | 🟡 UX polish |
| 7 | Favicon + OG image | 1h | 🟡 Shareability |
| 8 | Issue templates + Discussions | 30m | 🟡 Community ready |
| 9 | CONTRIBUTING.md + CODE_OF_CONDUCT.md | 30m | 🟡 Governance |
| 10 | Release v0.1.0 with changelog | 15m | 🟡 Milestone marker |

---

*Last updated: 2026-07-08*

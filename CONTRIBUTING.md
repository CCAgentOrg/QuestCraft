# Contributing to QuestCraft

## 🐛 Report Bugs

Open a [GitHub Issue](https://github.com/CCAgentOrg/QuestCraft/issues/new) with:
- Browser + OS
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)

## 💡 Feature Requests

Open an issue with the `enhancement` label. Describe what you want, why, and (optionally) how you'd implement it.

## 🧑‍💻 Code Contributions

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make changes
4. Run `npm run build` to verify it compiles
5. Commit with clear messages
6. Push and open a PR against `main`

### Style

- TypeScript with types in `types.ts`
- Indent: 4 spaces
- Components in `components/`, services in `services/`
- Use `useCallback` + `useEffect` patterns from existing components

## ✅ PR Checklist

- [ ] Build passes (`npm run build`)
- [ ] No new TypeScript errors
- [ ] Tested on mobile + desktop viewport
- [ ] Added to locale files if introducing new UI strings

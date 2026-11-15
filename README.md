# Brian's Cookbook

Personal recipe site built on the NYLA design system. Browse and search recipes, scale
servings, tick off ingredients, and cook step by step.

- **brianscookbook.com** — this repo, deployed by Vercel on every push to `main`.
- **Claude page** — where Brian adds, edits and deletes recipes (owner-only form, with
  "Fill with Claude" for pasted text, photos and PDFs). An hourly sync copies changes here.

```
npm install
npm run dev     # local
npm run build   # dist/ (what Vercel serves)
```

See `CLAUDE.md` for how the pieces fit, how recipes sync, and how to republish the Claude page.

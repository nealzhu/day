# qians.day · M2 infrastructure starter

This repository contains the **M2 smoke-test scaffold**, not the final website UI.
The goal is a single publishing path: GitHub PR → merge to `main` → R2 upload → Astro build → Cloudflare Pages Direct Upload.

## Public infrastructure

- Website: <https://qians.day> (bind to Pages after initial deployment)
- Media CDN: <https://site-cdn.qians.day> (R2 custom domain)
- Cloudflare Pages project name in workflow: `qians-day` (create this exact project or edit the workflow)
- R2 bucket name is **not hardcoded**; set repository variable `R2_BUCKET`.

## Bootstrap locally

1. Extract into a NEW public GitHub repo (for example `qians-day`).
2. With Node.js 22 and corepack installed, run:

   ```bash
   corepack enable
   corepack pnpm install
   corepack pnpm run verify:media
   corepack pnpm run check
   corepack pnpm run build
   ```

3. Commit all files **including the generated `pnpm-lock.yaml`**, then push to `main`. The CI requires `--frozen-lockfile`.
4. Create Cloudflare Pages project in **Direct Upload** mode with project name `qians-day`, production branch `main`.
5. First push will **skip** the production deploy until `R2_BUCKET` is configured. On GitHub set **repository variable** `R2_BUCKET` to your existing R2 bucket name only after Pages and secrets are ready.
6. Create restricted Cloudflare credentials and add GitHub **Actions secrets** (never commit or send them in chat):

   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN` (Account / Cloudflare Pages / Edit, scoped to account)
   - `R2_ACCESS_KEY_ID` (R2 Object Read & Write, limited to one bucket)
   - `R2_SECRET_ACCESS_KEY` (same R2 token pair)

7. Push to `main` for first deploy (or manually dispatch Production Deploy **from `main` only**). Check Pages `*.pages.dev` then bind `qians.day` in Cloudflare Pages Custom domains.
8. Once PR Check has run at least once, activate a `main` ruleset: require PR, zero approvals, required check `validate`, forbid force-push/deletion, squash merge.

## Media contract, MVP

Each article has a stable directory name equal to its `articleId` and an `index.md`:

```
src/content/posts/<articleId>/
  index.md
  assets/photo-<sha256-first-12-hex>.webp
```

Markdown images always use `![alt](./assets/photo-...webp)`. During local dev Astro loads local files; during a production build our Remark transformer rewrites them to `https://site-cdn.qians.day/posts/<articleId>/<file>`. The production workflow uploads media to R2 **before** building and deploying the page.

**Important M2 test:** inspect `dist/_astro` and the built article HTML to confirm the production WebP isn't bundled into Pages. If Astro's Markdown pipeline changes, adjust the transformer before rollout. Cover derivation, rich UI and macOS editing are M3+ work.

## Security and testing caveats

- PR Check never receives production R2/Pages secrets.
- Deploy runs only on `main` or explicit manual dispatch.
- Only immutable, hash-named media is uploaded; no automatic deletion.
- The provided example WebP is a tiny generated test artifact, not a final brand image.
- First deploy isn't live until the project, secrets and bucket are configured.
- The scaffold was statically validated but has **not** passed dependency installation / Astro build in the artifact environment; run the local commands and CI before treating it as verified.
- GitHub repo contents are public, including unfinished PRs. Do not put private drafts or confidential images in the public repo.

**ig-curator**
A minimalist dashboard to plan an Instagram feed and the content behind it: arrange your grid on a phone preview, and schedule shoots, edits and posts in a planner beside it.

🌐 **Live site:** [https://ig-curator-public.vercel.app](https://ig-curator-public.vercel.app)

### 01 — INSTALL

```bash
git clone https://github.com/ciellamher/ig-curator.git
cd ig-curator
npm install
npm run dev
```

Then open `http://localhost:3000`.

### 02 — FEATURES

**Feed (left)**
- **Phone preview** of your profile with Posts, Reels and Stories.
- **Drag-and-drop grid** with multi-photo carousels, cropping and true-to-life Instagram previews.
- **Drafts & Inspo** sit beside the phone: plan draft boxes and collect inspiration boards, then transfer anything into the grid.

**Content planner (right)**
- **Content calendar** — Shoot (week and month), Edit and Post views. Press + or double-click a day to add; drag cards between days to reschedule.
- **Content tables** — To Shoot, To Edit, To Post and All, with inline editing, select-all and bulk delete.
- **Ready to Post** — everything waiting to be scheduled; drag a card onto the calendar to schedule it.
- **Automatic edit dates** — setting a post date sets the edit date 3 days before (stories) or a week before (posts and reels).
- **Quick Links** gallery.

**Feed ↔ planner**
- Every box in the Posts tab has exactly one planner row, and items added in the planner appear in the grid.
- Renaming or deleting on either side updates the other.
- Clicking a box opens its planner page; clicking a planner row highlights its box.

### 03 — STORAGE

- **Photos and videos** are stored in your browser (IndexedDB) on the device you added them from: free and limited only by disk space, but cleared if you clear the site's data. Use **Photos & backups → Download all photos** to save a ZIP organised by Posts, Reels, Stories, Drafts and Inspo.
- **Feed layout** (boxes, folders, captions, profile) is backed up to your account, and daily layout snapshots are kept in the browser.
- **Planner data** lives in Postgres.

### 04 — DATABASE

On Vercel, every deploy runs `prisma db push` (`scripts/db-sync.mjs`) to create any missing tables. It refuses changes that would lose data, so a risky schema change fails the deploy instead. Locally:

```bash
# .env needs POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING
npx prisma db push
```

No local Postgres? `npx prisma dev` starts a temporary one; point both variables at the URL it prints.

Dates are stored as Asia/Manila wall-clock strings (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`), so date-only values never shift a day.

### 05 — WHAT'S INSIDE

- `src/app/` — Next.js routes, server actions and API routes.
- `src/components/grid/` — The phone preview, grid, drafts, inspo boards and Instagram previews.
- `src/components/planner/` — The content planner.
- `src/lib/planner/` — Planner options, dates, view filters and scheduling rules (with tests).

### 06 — TESTS

```bash
npm test
```

### 07 — LICENSE

MIT

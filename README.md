**ig-curator**
A minimalist, drag-and-drop dashboard to visually curate and schedule Instagram grids, reels, and stories.

🌐 **Live Demo:** [https://ig-curator.vercel.app/](https://ig-curator.vercel.app/)

### 01 — INSTALL

**Local setup:**

```bash
git clone https://github.com/ciellamher/ig-curator.git
cd ig-curator
npm install
npm run dev
```

### 02 — USE

Call the application locally in your browser to plan your content:

> "Navigate to `http://localhost:3000` to arrange your grid, upload multiple photo variations to cycle through, and preview immersive story folders. We've added a manual sync button to ensure your curations are safely backed up to the cloud."

### 03 — WHAT'S INSIDE

- `src/app/` — Core Next.js routing, local storage persistence, and server-side actions.
- `src/components/grid/` — The primary visual interface, including the drag-and-drop planner, multi-photo cycling, and true-to-life Instagram preview modals.
- `src/lib/` — Configuration for authentication and database connections.
- `src/lib/planner/` — Planner options, date handling, view filters/sorts and the clothing timeline (with tests).
- `src/components/planner/` — Planner dashboard UI.

### 04 — FEATURES

- **Drag-and-Drop Grid**: Easily rearrange your feed with seamless animations.
- **Cloud Sync**: Auto-sync and manual sync ensure you never lose your progress.
- **True-to-Life Previews**: View your planned content exactly as it will appear on Instagram.
- **Stories & Reels**: Plan beyond the grid with dedicated views for stories and reels.

### 05 — CONTENT PLANNER (`/planner`)

A standalone recreation of the Notion content workflow. One `Content` table powers every view, so an edit shows up everywhere at once.

- **Content Calendar** — Shoot · Week, Shoot · Month, Edit (parent-focused), Post. Drag a card to another day to reschedule just that date.
- **Content tables** — To Shoot (all To-do statuses), To Edit (In progress, not edited), To Post (Ready to Post, Edited filter Any/Yes/No).
- **Ready to Post · Available Posts** — unscheduled In progress / Ready to Post items, grouped under their parent.
- **Outfits to Prep** — items with Buy Clothes / Ordered / Delivered, with SHEIN deadlines: order 7 days before the shoot; return reminder on day 11 of the 14-day window (the window starts the day an item is marked Ordered).
- **Quick Links** and configurable navigation (`src/config/dashboardNav.ts`).
- **Feed sync** — new posts, reels, stories and drafts in the feed create planner rows automatically; uploading a photo attaches it and moves the row from To Board/To Shoot to To Edit.

Dates are stored as Asia/Manila wall-clock strings (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`), so date-only values never shift a day.

**Database setup** — the schema lives in `prisma/schema.prisma` and is applied with `db push` (the repo has no migrations folder):

```bash
# .env needs POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING
npx prisma db push
```

No local Postgres? `npx prisma dev` starts a temporary one; point both variables at the URL it prints.

**Sample data** — on an empty planner, click **Load sample data** for fictional records (titles end in "(sample)").

**Tests**

```bash
npm test
```

### 06 — LICENSE

MIT

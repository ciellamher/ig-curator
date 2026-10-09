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

### 05 — CONTENT PLANNER

Sits beside the feed on the home page (feed on the left, planner on the right). A standalone recreation of the Notion content workflow: one `Content` table powers every view, so an edit shows up everywhere at once.

- **Content Calendar** — Shoot · Week, Shoot · Month, Edit, Post. Press + (or double-click a day) to add; drag cards between days to reschedule that date.
- **Content tables** — To Shoot (all To-do statuses), To Edit (In progress, not edited), To Post (Ready to Post, Edited filter Any/Yes/No), and All. Select rows (or select all) to delete in bulk.
- **Ready to Post** — everything in To Schedule. Drag a card onto the calendar to schedule it; it moves to To Edit.
- **Automatic edit dates** — setting Post Now sets Edit Date 3 days before (stories) or 1 week before (posts, reels), and follows whenever Post Now or the category changes.
- **Quick Links** gallery.
- **Feed ↔ planner sync** — boxes in the Posts tab (the main grid) get a planner row; drafts, stories and inspo stay in the feed only. Uploaded photos attach to the row, and renaming or deleting on either side updates the other.

Dates are stored as Asia/Manila wall-clock strings (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`), so date-only values never shift a day.

**Database setup** — on Vercel, every deploy runs `prisma db push` automatically (`scripts/db-sync.mjs`), creating any missing tables. It refuses changes that would lose data, so a risky schema change fails the deploy instead. Locally, run it yourself:

```bash
# .env needs POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING
npx prisma db push
```

No local Postgres? `npx prisma dev` starts a temporary one; point both variables at the URL it prints.

**Storage** — photos and videos are stored in your browser (IndexedDB) on the device you added them from: free, limited only by disk space, but cleared if you clear the site's data. The feed layout (boxes, folders, captions, profile) is also backed up to your account, so it appears on other devices (photos show there as placeholders).

**Sample data** — on an empty planner, click **Load sample data** for fictional records (titles end in "(sample)").

**Tests**

```bash
npm test
```

### 06 — LICENSE

MIT

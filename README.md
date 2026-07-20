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

### 04 — FEATURES

- **Drag-and-Drop Grid**: Easily rearrange your feed with seamless animations.
- **Cloud Sync**: Auto-sync and manual sync ensure you never lose your progress.
- **True-to-Life Previews**: View your planned content exactly as it will appear on Instagram.
- **Stories & Reels**: Plan beyond the grid with dedicated views for stories and reels.

### 05 — LICENSE

MIT

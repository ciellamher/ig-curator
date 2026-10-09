// On Vercel deploys, bring the database schema up to date (creates missing tables/columns).
// `prisma db push` refuses changes that would lose data, so a risky change fails the build instead of deleting anything.
// Locally this is skipped; run `npx prisma db push` yourself.
import { execSync } from "node:child_process"

if (!process.env.VERCEL) {
  console.log("db-sync: not on Vercel, skipping schema push")
  process.exit(0)
}
if (!process.env.POSTGRES_PRISMA_URL) {
  console.error("db-sync: POSTGRES_PRISMA_URL is not set in this Vercel environment")
  process.exit(1)
}
execSync("npx prisma db push --skip-generate", { stdio: "inherit" })

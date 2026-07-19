import { DashboardClient } from "./dashboard-client"

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-soft-50 min-h-screen">
      <DashboardClient />
    </main>
  )
}

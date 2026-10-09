import { DashboardClient } from "./dashboard-client"
import { PlannerClient } from "@/components/planner/PlannerClient"

export default function Home() {
  return (
    <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[440px_minmax(0,1fr)] xl:grid-cols-[480px_minmax(0,1fr)] lg:items-start">
      <section aria-label="Feed" className="lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:border-r border-zinc-200 bg-zinc-100/40">
        <DashboardClient />
      </section>
      <section aria-label="Content planner" className="min-w-0 border-t border-zinc-200 lg:border-t-0">
        <PlannerClient />
      </section>
    </main>
  )
}

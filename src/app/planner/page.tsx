import type { Metadata } from "next"
import { PlannerClient } from "@/components/planner/PlannerClient"

export const metadata: Metadata = {
  title: "Planner · IG Curator",
}

export default function PlannerPage() {
  return (
    <main className="flex-1 flex flex-col">
      <PlannerClient />
    </main>
  )
}

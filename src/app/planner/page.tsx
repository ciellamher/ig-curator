import { redirect } from "next/navigation"

// The planner now lives beside the feed on the home page.
export default function PlannerPage() {
  redirect("/")
}

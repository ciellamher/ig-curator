// Fictional sample records (clearly labelled) for trying out the dashboard. Dates are relative to today
// so the calendars and clothing alerts always have something to show.

import { addDaysISO, todayISO } from "./dates"
import type { ContentPatch, QuickLinkInput } from "./types"

export type SampleContent = ContentPatch & { key: string; parentKey?: string; markOrderedDaysAgo?: number }

export function sampleContent(today = todayISO()): SampleContent[] {
  const d = (days: number) => addDaysISO(today, days)
  const sched = (start: string | null, end: string | null = null) => ({ start, end })

  return [
    { key: "batch-a", title: "BATCH A (sample)", status: "To Shoot", categories: ["Post"], shoot: sched(d(6)), clothingStatus: "Buy Clothes" },
    { key: "a1", parentKey: "batch-a", title: "Cafe outfit set (sample)", status: "To Buy/Plan Clothes", categories: ["Post", "Story"], clothingStatus: "Buy Clothes", pinterestUrl: "https://www.pinterest.com/" },
    { key: "a2", parentKey: "batch-a", title: "Desk setup flatlay (sample)", status: "To Planner", categories: ["Post"], shoot: sched(`${d(6)}T09:00`, `${d(6)}T11:30`) },
    { key: "a3", parentKey: "batch-a", title: "Park picnic reel (sample)", status: "To Shoot", categories: ["Reels"], clothingStatus: "Ordered", markOrderedDaysAgo: 9 },

    { key: "batch-b", title: "batch b — weekend trip (sample)", status: "To Schedule", categories: ["Reels", "Story"], shoot: sched(d(-5), d(-3)) },
    { key: "b1", parentKey: "batch-b", title: "Beach sunset reel (sample)", status: "To Edit", categories: ["Reels"], edit: sched(d(1)), clothingStatus: "Delivered", markOrderedDaysAgo: 12 },
    { key: "b2", parentKey: "batch-b", title: "Hotel room tour (sample)", status: "To Schedule", categories: ["Story", "Highlights"], edit: sched(d(2)) },
    { key: "b3", parentKey: "batch-b", title: "Market haul (sample)", status: "To Edit", edited: true, categories: ["Facebook"], edit: sched(d(-1)) },

    { key: "c", title: "Morning routine (sample)", status: "To Board", categories: ["Locket"] },
    { key: "d", title: "Skincare carousel (sample)", status: "Ready to Post", edited: true, categories: ["Post"], post: sched(`${d(3)}T19:00`) },
    { key: "e", title: "Book review reel (sample)", status: "Ready to Post", edited: false, categories: ["Reels", "Facebook"] },
    { key: "f", title: "Throwback dump (sample)", status: "Posted", edited: true, categories: ["Post"], post: sched(d(-4)) },
    { key: "g", title: "Red dress (sample)", status: "Worn", categories: ["Story"], clothingStatus: "Refunded", shoot: sched(d(-20)) },
    {
      key: "h",
      title: "Rooftop golden hour (sample)",
      status: "To Shoot",
      categories: ["Post", "Reels"],
      shoot: sched(d(10)),
      clothingStatus: "Buy Clothes",
      location: { name: "Sample Rooftop", address: "123 Example St, Manila", latitude: 14.5995, longitude: 120.9842 },
      body: "Shot list:\n- wide establishing\n- outfit detail\n- walking transition",
    },
  ]
}

export const SAMPLE_QUICK_LINKS: QuickLinkInput[] = [
  { name: "Pinterest boards (sample)", url: "https://www.pinterest.com/", text: "Moodboards for upcoming shoots" },
  { name: "Canva (sample)", url: "https://www.canva.com/", text: "Story templates" },
  { name: "CapCut (sample)", url: "https://www.capcut.com/", text: "Reel editing" },
]

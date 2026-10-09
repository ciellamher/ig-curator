// Fictional sample records (clearly labelled) for trying out the dashboard. Dates are relative to today
// so the calendars and clothing alerts always have something to show.

import { addDaysISO, todayISO } from "./dates"
import type { ContentPatch, QuickLinkInput } from "./types"

export type SampleContent = ContentPatch & {
  key: string
  parentKey?: string
  orderKey?: string
  orderedDaysAgo?: number
  deliveredDaysAgo?: number
}

/** One SHEIN order covering BATCH A and batch b, delivered 12 days ago (inside the day-11 reminder). */
export const SAMPLE_ORDERS = [{ key: "order-1", name: "Order 1 (sample)", orderedDaysAgo: 16, deliveredDaysAgo: 12 }]

export function sampleContent(today = todayISO()): SampleContent[] {
  const d = (days: number) => addDaysISO(today, days)
  const sched = (start: string | null, end: string | null = null) => ({ start, end })

  return [
    { key: "batch-a", orderKey: "order-1", title: "BATCH A (sample)", status: "To Shoot", categories: ["Post"], shoot: sched(d(2)), clothingStatus: "Delivered", orderedDaysAgo: 16, deliveredDaysAgo: 12 },
    { key: "a1", parentKey: "batch-a", title: "Cafe outfit set (sample)", status: "To Buy/Plan Clothes", categories: ["Post", "Story"], clothingStatus: "Delivered", orderedDaysAgo: 16, deliveredDaysAgo: 12, pinterestUrl: "https://www.pinterest.com/" },
    { key: "a2", parentKey: "batch-a", title: "Desk setup flatlay (sample)", status: "To Planner", categories: ["Post"], shoot: sched(`${d(2)}T09:00`, `${d(2)}T11:30`) },
    { key: "a3", parentKey: "batch-a", title: "Park picnic reel (sample)", status: "To Shoot", categories: ["Reels"], clothingStatus: "Delivered", orderedDaysAgo: 16, deliveredDaysAgo: 12 },

    { key: "batch-b", orderKey: "order-1", title: "batch b — weekend trip (sample)", status: "To Schedule", categories: ["Reels", "Story"], shoot: sched(d(-5), d(-3)) },
    { key: "batch-c", title: "BATCH C (sample)", status: "To Board", categories: ["Post"], shoot: sched(d(12)), clothingStatus: "Buy Clothes" },
    { key: "batch-d", title: "BATCH D (sample)", status: "To Board", categories: ["Reels"], shoot: sched(d(14)) },
    { key: "b1", parentKey: "batch-b", title: "Beach sunset reel (sample)", status: "To Edit", categories: ["Reels"], edit: sched(d(1)), clothingStatus: "Delivered", orderedDaysAgo: 16, deliveredDaysAgo: 12 },
    { key: "b2", parentKey: "batch-b", title: "Hotel room tour (sample)", status: "To Schedule", categories: ["Story", "Highlights"] },
    { key: "b3", parentKey: "batch-b", title: "Market haul (sample)", status: "To Edit", edited: true, categories: ["Facebook"], edit: sched(d(-1)) },

    { key: "c", title: "Morning routine (sample)", status: "To Board", categories: ["Locket"] },
    { key: "d", title: "Skincare carousel (sample)", status: "Ready to Post", edited: true, categories: ["Post"], post: sched(`${d(3)}T19:00`) },
    { key: "e", title: "Book review reel (sample)", status: "To Schedule", edited: false, categories: ["Reels", "Facebook"] },
    { key: "e2", title: "Cafe latte story (sample)", status: "To Schedule", categories: ["Story"] },
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

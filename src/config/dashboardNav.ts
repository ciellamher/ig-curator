// Left-column navigation on the planner dashboard. These pages live outside the app's database;
// set `href` to wherever each resource lives (a Notion page, Google Doc, etc.). Empty hrefs render as disabled.

export type NavGroup = { label: string; links: { label: string; href: string }[] }

export const DASHBOARD_NAV: NavGroup[] = [
  {
    label: "Gear",
    links: [
      { label: "Canon G7X", href: "" },
      { label: "Canon EOS M10", href: "" },
    ],
  },
  {
    label: "Workflow",
    links: [
      { label: "Editing Process", href: "" },
      { label: "Prompt Library", href: "" },
      { label: "User Interaction", href: "" },
    ],
  },
  {
    label: "Growth",
    links: [
      { label: "Facebook Ratio", href: "" },
      { label: "Brands", href: "" },
    ],
  },
  {
    label: "Wardrobe",
    links: [{ label: "Clothings", href: "" }],
  },
]

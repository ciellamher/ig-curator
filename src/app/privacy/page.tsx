import type { Metadata } from "next"

export const metadata: Metadata = { title: "Privacy · IG Curator" }

export default function PrivacyPage() {
  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10 sm:py-14 flex flex-col gap-5 text-sm leading-relaxed text-zinc-700">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Privacy policy</h1>
      <p>IG Curator is a personal planning tool for an Instagram feed and the content behind it.</p>
      <h2 className="text-base font-semibold text-zinc-950">What is stored</h2>
      <ul className="list-disc pl-5 flex flex-col gap-1">
        <li>Your account (username and a hashed password).</li>
        <li>Your planner content: titles, dates, statuses, notes and links you enter.</li>
        <li>Your feed layout. Photos and videos stay in your own browser and are not uploaded.</li>
      </ul>
      <h2 className="text-base font-semibold text-zinc-950">Google Calendar</h2>
      <p>
        If you connect Google Calendar, IG Curator creates one calendar called “IG Curator” in your Google account and adds
        your shoot, edit and post dates to it, with reminders. It only accesses calendars it creates; it does not read or
        change your other calendars or events. You can disconnect at any time in the app, or remove access in your Google
        Account settings. Google user data is used only to provide this feature and is not shared or sold.
      </p>
      <h2 className="text-base font-semibold text-zinc-950">Deleting your data</h2>
      <p>Deleting items in the app removes them from the database. Disconnecting Google Calendar stops all further changes to it.</p>
    </main>
  )
}

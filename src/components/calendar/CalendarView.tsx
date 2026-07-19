"use client"

import { SlotItem } from "@/types"
import { ChevronLeft, ChevronRight, Image as ImageIcon, Plus } from "lucide-react"
import { useState } from "react"

export function CalendarView({ items }: { items: SlotItem[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  // Generate calendar days
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  
  const blanks = Array.from({ length: firstDayOfMonth }).map((_, i) => i)
  const days = Array.from({ length: daysInMonth }).map((_, i) => i + 1)

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))

  const [filter, setFilter] = useState<"All" | "Post" | "Story" | "Reel" | "Carousel">("All")

  const scheduledItems = items.filter(item => {
    if (!item.scheduledTime) return false;
    if (filter !== "All" && item.contentType !== filter) return false;
    return true;
  })

  return (
    <div className="w-full bg-white rounded-[2rem] shadow-diffused border border-soft-100 p-8 min-h-[600px] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Filters */}
          <div className="flex items-center gap-2 bg-soft-50 p-1 rounded-xl border border-soft-200">
            {["All", "Post", "Story", "Reel", "Carousel"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === f 
                    ? "bg-white shadow-sm text-pastel-600" 
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={prevMonth} className="p-2 border border-soft-200 rounded-full hover:bg-soft-50 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextMonth} className="p-2 border border-soft-200 rounded-full hover:bg-soft-50 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-soft-200 rounded-xl overflow-hidden border border-soft-200 flex-1">
        {/* Days Header */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="bg-soft-50 py-3 text-center text-sm font-medium text-foreground/70">
            {day}
          </div>
        ))}
        
        {/* Calendar Grid */}
        {blanks.map(b => <div key={`blank-${b}`} className="bg-white min-h-[120px]"></div>)}
        {days.map((day, i) => {
          const isToday = day === new Date().getDate() && 
                          currentDate.getMonth() === new Date().getMonth() && 
                          currentDate.getFullYear() === new Date().getFullYear()
          
          const dayItems = scheduledItems.filter(item => {
            const date = new Date(item.scheduledTime!)
            return date.getDate() === day && 
                   date.getMonth() === currentDate.getMonth() && 
                   date.getFullYear() === currentDate.getFullYear()
          })

          return (
            <div 
              key={i} 
              className={`bg-white min-h-[100px] p-2 border-r border-b border-soft-100 transition-colors hover:bg-soft-50/50 group`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-pastel-500 text-white' : 'text-foreground/70'}`}>
                  {day}
                </span>
                <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-soft-200 rounded text-foreground/50 hover:text-foreground transition-all">
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px] no-scrollbar">
                {dayItems.map(item => (
                  <div key={item.id} className="bg-pastel-50 rounded-lg p-1.5 flex items-center gap-2 border border-pastel-100 shadow-sm">
                    {item.type === "image" && item.urls.length > 0 ? (
                      <img src={item.urls[item.currentUrlIndex]} className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-soft-200 flex items-center justify-center text-foreground/30"><ImageIcon size={10} /></div>
                    )}
                    <span className="text-[10px] font-medium text-foreground/70 truncate">{item.caption || "Draft"}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

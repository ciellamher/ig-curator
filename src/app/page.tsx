import { Grid } from "@/components/grid/Grid"

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-soft-50 min-h-screen">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-start justify-center">
        
        {/* Left Side: Drag-and-Drop Grid */}
        <div className="flex-1 w-full flex justify-center lg:justify-end">
          <Grid />
        </div>
        
        {/* Right Side: Placeholders for next phases */}
        <div className="flex-1 w-full max-w-[500px] flex flex-col gap-6">
          <div className="bg-white rounded-[2rem] shadow-diffused p-8 h-80 flex flex-col items-center justify-center text-foreground/40 border border-soft-100">
            <p className="font-medium text-lg">Editor Panel</p>
            <p className="text-sm">Select a grid slot to edit</p>
          </div>
          <div className="bg-white rounded-[2rem] shadow-diffused p-8 h-48 flex flex-col items-center justify-center text-foreground/40 border border-soft-100">
            <p className="font-medium text-lg">Scheduling Timeline</p>
            <p className="text-sm">Assign dates to drafted content</p>
          </div>
        </div>
        
      </div>
    </main>
  )
}

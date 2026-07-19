import { useState } from "react";
import { signIn } from "next-auth/react";
import { Plus, ChevronDown, Undo2, Settings, Calendar as CalendarIcon, User } from "lucide-react";

interface ProfileHeaderProps {
  session: any;
  liveMediaCount?: number;
  onAddRow?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export function ProfileHeader({ session, liveMediaCount = 0, onAddRow, onUndo, canUndo }: ProfileHeaderProps) {
  const username = session?.user?.name || "your_username";
  const avatarUrl = session?.user?.image;

  return (
    <div className="w-full bg-white flex flex-col pt-10 pb-4 px-4">
      {/* Top Bar - Minimal Style */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onAddRow} title="Add Row" className="hover:text-pastel-500 transition-colors">
            <Plus size={24} className="text-foreground" strokeWidth={2.5} />
          </button>
          {!session?.user ? (
            <div className="flex gap-2">
              <button 
                onClick={() => signIn("instagram")}
                className="px-4 py-2 bg-gradient-to-r from-pastel-400 to-pastel-500 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Sign in with IG
              </button>
              <button 
                onClick={() => signIn("demo")}
                className="px-4 py-2 bg-foreground text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Demo Mode
              </button>
            </div>
          ) : (
            <>
              {canUndo && (
                <button onClick={onUndo} title="Undo" className="hover:text-pastel-500 transition-colors">
                  <Undo2 size={22} className="text-foreground" strokeWidth={2.5} />
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 cursor-pointer">
          <span className="font-bold text-[16px] text-foreground tracking-tight">{username}</span>
          <ChevronDown size={16} className="text-foreground opacity-60" strokeWidth={2.5} />
        </div>

        <div className="flex items-center gap-4">
          <Settings size={22} className="text-foreground" strokeWidth={2} />
          <CalendarIcon size={22} className="text-foreground" strokeWidth={2} />
        </div>
      </div>

      {/* Stats Row - Minimal Style */}
      <div className="flex items-center justify-between px-2">
        <div className="relative shrink-0">
          <div className="w-[72px] h-[72px] rounded-full p-[2px] bg-gradient-to-tr from-pastel-300 to-pastel-500 shadow-sm">
            <div className="w-full h-full bg-white rounded-full p-[2px]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full bg-soft-50 flex items-center justify-center">
                  <User size={30} className="text-foreground/20" strokeWidth={2} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-around ml-4">
          <div className="flex flex-col items-center">
            <span className="font-extrabold text-foreground text-[17px]">{liveMediaCount}</span>
            <span className="text-[13px] text-foreground/60 -mt-0.5 font-medium">posts</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-extrabold text-foreground text-[17px]">10.5k</span>
            <span className="text-[13px] text-foreground/60 -mt-0.5 font-medium">followers</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-extrabold text-foreground text-[17px]">500</span>
            <span className="text-[13px] text-foreground/60 -mt-0.5 font-medium">following</span>
          </div>
        </div>
      </div>
      
      {/* Bio - Minimal Style */}
      <div className="px-3 mt-4 mb-2">
        <div className="text-[14px] text-foreground/80 leading-[1.4] whitespace-pre-line tracking-tight font-medium">
          {"Your Name\nCreative Director ✨\nlinkin.bio/brand"}
        </div>
      </div>
    </div>
  );
}

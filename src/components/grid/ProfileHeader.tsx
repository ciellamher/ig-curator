import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Plus, ChevronDown, Undo2, Settings, Calendar as CalendarIcon, User, Edit3, Check } from "lucide-react";

interface ProfileHeaderProps {
  session: any;
  status?: string;
  liveMediaCount?: number;
  onAddRow?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export function ProfileHeader({ session, status, liveMediaCount = 0, onAddRow, onUndo, canUndo }: ProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    username: session?.user?.name || "your_username",
    followers: "10.5k",
    following: "500",
    bio: "Your Name\nCreative Director ✨\nlinkin.bio/brand",
    avatarUrl: ""
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      localStorage.removeItem("ig-curator-profile");
      setProfile({
        username: "your_username",
        followers: "10.5k",
        following: "500",
        bio: "Your Name\nCreative Director ✨\nlinkin.bio/brand",
        avatarUrl: ""
      });
      return;
    }

    const saved = localStorage.getItem("ig-curator-profile");
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch(e) {}
    } else {
      setProfile({
        username: session?.user?.name || "your_username",
        followers: "10.5k",
        following: "500",
        bio: "Your Name\nCreative Director ✨\nlinkin.bio/brand",
        avatarUrl: ""
      });
    }
  }, [session, status]);

  const saveProfile = () => {
    localStorage.setItem("ig-curator-profile", JSON.stringify(profile));
    setIsEditing(false);
  };

  const avatarUrl = profile.avatarUrl || session?.user?.image;

  return (
    <div className="w-full bg-white flex flex-col pt-8 pb-4 px-5 select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onAddRow} title="Add Row" className="p-1.5 rounded-full hover:bg-soft-100 transition-colors cursor-pointer text-slate-800">
            <Plus size={22} strokeWidth={2.2} />
          </button>
          {canUndo && (
            <button onClick={onUndo} title="Undo" className="p-1.5 rounded-full hover:bg-soft-100 transition-colors cursor-pointer text-slate-800">
              <Undo2 size={20} strokeWidth={2.2} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 cursor-pointer">
          {isEditing ? (
            <input 
              value={profile.username}
              onChange={(e) => setProfile({...profile, username: e.target.value})}
              className="font-bold text-sm text-slate-900 tracking-tight text-center outline-none bg-soft-100 border border-soft-200 focus:border-slate-800 focus:bg-white rounded-full px-3 py-1 w-36 transition-all shadow-xs"
            />
          ) : (
            <>
              <span className="font-extrabold text-[16px] text-slate-900 tracking-tight">{profile.username}</span>
              <ChevronDown size={15} className="text-slate-500" strokeWidth={2.5} />
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={isEditing ? saveProfile : () => setIsEditing(true)} 
            className="px-3 py-1 bg-soft-100 border border-soft-200 hover:bg-slate-900 hover:text-white rounded-full text-xs font-bold text-slate-800 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {isEditing ? (
              <>
                <Check size={14} strokeWidth={2.5} />
                <span>Save</span>
              </>
            ) : (
              <>
                <Edit3 size={13} strokeWidth={2} />
                <span>Edit</span>
              </>
            )}
          </button>
          <button className="p-1.5 rounded-full hover:bg-soft-100 transition-colors cursor-pointer text-slate-800" title="Settings">
            <Settings size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Stats & Avatar Row */}
      <div className="flex items-center justify-between px-1">
        <div className="relative shrink-0">
          <div 
            className={`w-20 h-20 rounded-full p-[2px] bg-gradient-to-tr from-slate-200 via-slate-400 to-slate-900 shadow-sm ${isEditing ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={() => {
              if (isEditing) document.getElementById('profile-upload')?.click();
            }}
          >
            <input 
              type="file" 
              id="profile-upload" 
              className="hidden" 
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_SIZE = 200;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                      if (width > MAX_SIZE) {
                        height = Math.round((height * MAX_SIZE) / width);
                        width = MAX_SIZE;
                      }
                    } else {
                      if (height > MAX_SIZE) {
                        width = Math.round((width * MAX_SIZE) / height);
                        height = MAX_SIZE;
                      }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx?.drawImage(img, 0, 0, width, height);
                    setProfile({ ...profile, avatarUrl: canvas.toDataURL("image/webp", 0.8) });
                  };
                  img.src = e.target?.result as string;
                };
                reader.readAsDataURL(file);
              }}
            />
            <div className="w-full h-full bg-white rounded-full p-[2px] relative overflow-hidden group">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full bg-soft-50 flex items-center justify-center">
                  <User size={30} className="text-slate-400" strokeWidth={2} />
                </div>
              )}
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit3 size={18} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-around ml-4">
          <div className="flex flex-col items-center">
            <span className="font-extrabold text-slate-900 text-[17px]">{liveMediaCount}</span>
            <span className="text-[12px] text-slate-500 font-medium">posts</span>
          </div>
          <div className="flex flex-col items-center">
            {isEditing ? (
              <input 
                value={profile.followers} 
                onChange={(e) => setProfile({...profile, followers: e.target.value})} 
                className="font-extrabold text-slate-900 text-sm text-center w-16 outline-none bg-soft-100 border border-soft-200 focus:border-slate-800 focus:bg-white rounded-lg px-1.5 py-0.5 transition-all shadow-xs" 
              />
            ) : (
              <span className="font-extrabold text-slate-900 text-[17px]">{profile.followers}</span>
            )}
            <span className="text-[12px] text-slate-500 font-medium">followers</span>
          </div>
          <div className="flex flex-col items-center">
            {isEditing ? (
              <input 
                value={profile.following} 
                onChange={(e) => setProfile({...profile, following: e.target.value})} 
                className="font-extrabold text-slate-900 text-sm text-center w-16 outline-none bg-soft-100 border border-soft-200 focus:border-slate-800 focus:bg-white rounded-lg px-1.5 py-0.5 transition-all shadow-xs" 
              />
            ) : (
              <span className="font-extrabold text-slate-900 text-[17px]">{profile.following}</span>
            )}
            <span className="text-[12px] text-slate-500 font-medium">following</span>
          </div>
        </div>
      </div>
      
      {/* Bio Block */}
      <div className="mt-4 mb-1">
        {isEditing ? (
          <textarea 
            value={profile.bio}
            onChange={(e) => setProfile({...profile, bio: e.target.value})}
            className="w-full text-[13px] text-slate-800 leading-snug tracking-tight font-medium outline-none border border-soft-200 focus:border-slate-800 focus:bg-white rounded-2xl p-3 resize-none h-20 bg-soft-50 transition-all shadow-xs"
          />
        ) : (
          <div className="text-[13px] text-slate-800 leading-snug whitespace-pre-line tracking-tight font-medium px-1">
            {profile.bio}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Plus, ChevronDown, Undo2, Settings, Calendar as CalendarIcon, User, Edit3, Check } from "lucide-react";

interface ProfileHeaderProps {
  session: any;
  liveMediaCount?: number;
  onAddRow?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export function ProfileHeader({ session, liveMediaCount = 0, onAddRow, onUndo, canUndo }: ProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    username: session?.user?.name || "your_username",
    followers: "10.5k",
    following: "500",
    bio: "Your Name\nCreative Director ✨\nlinkin.bio/brand",
    avatarUrl: ""
  });

  useEffect(() => {
    const saved = localStorage.getItem("ig-curator-profile");
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch(e) {}
    }
  }, []);

  const saveProfile = () => {
    localStorage.setItem("ig-curator-profile", JSON.stringify(profile));
    setIsEditing(false);
  };

  const avatarUrl = profile.avatarUrl || session?.user?.image;

  return (
    <div className="w-full bg-white flex flex-col pt-10 pb-4 px-4">
      {/* Top Bar - Minimal Style */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onAddRow} title="Add Row" className="hover:text-pastel-500 transition-colors">
            <Plus size={24} className="text-foreground" strokeWidth={2.5} />
          </button>
          {canUndo && (
            <button onClick={onUndo} title="Undo" className="hover:text-pastel-500 transition-colors">
              <Undo2 size={22} className="text-foreground" strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 cursor-pointer">
          {isEditing ? (
            <input 
              value={profile.username}
              onChange={(e) => setProfile({...profile, username: e.target.value})}
              className="font-bold text-[16px] text-foreground tracking-tight text-center outline-none border-b border-pastel-300 w-32"
            />
          ) : (
            <>
              <span className="font-bold text-[16px] text-foreground tracking-tight">{profile.username}</span>
              <ChevronDown size={16} className="text-foreground opacity-60" strokeWidth={2.5} />
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button onClick={isEditing ? saveProfile : () => setIsEditing(true)} className="hover:text-pastel-500 transition-colors">
            {isEditing ? <Check size={22} className="text-pastel-500" strokeWidth={2.5} /> : <Edit3 size={20} className="text-foreground" strokeWidth={2} />}
          </button>
          <Settings size={22} className="text-foreground" strokeWidth={2} />
        </div>
      </div>

      {/* Stats Row - Minimal Style */}
      <div className="flex items-center justify-between px-2">
        <div className="relative shrink-0">
          <div 
            className={`w-[72px] h-[72px] rounded-full p-[2px] bg-gradient-to-tr from-pastel-300 to-pastel-500 shadow-sm ${isEditing ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
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
                  <User size={30} className="text-foreground/20" strokeWidth={2} />
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
            <span className="font-extrabold text-foreground text-[17px]">{liveMediaCount}</span>
            <span className="text-[13px] text-foreground/60 -mt-0.5 font-medium">posts</span>
          </div>
          <div className="flex flex-col items-center">
            {isEditing ? (
              <input value={profile.followers} onChange={(e) => setProfile({...profile, followers: e.target.value})} className="font-extrabold text-foreground text-[17px] text-center w-14 outline-none border-b border-pastel-300" />
            ) : (
              <span className="font-extrabold text-foreground text-[17px]">{profile.followers}</span>
            )}
            <span className="text-[13px] text-foreground/60 -mt-0.5 font-medium">followers</span>
          </div>
          <div className="flex flex-col items-center">
            {isEditing ? (
              <input value={profile.following} onChange={(e) => setProfile({...profile, following: e.target.value})} className="font-extrabold text-foreground text-[17px] text-center w-14 outline-none border-b border-pastel-300" />
            ) : (
              <span className="font-extrabold text-foreground text-[17px]">{profile.following}</span>
            )}
            <span className="text-[13px] text-foreground/60 -mt-0.5 font-medium">following</span>
          </div>
        </div>
      </div>
      
      {/* Bio - Minimal Style */}
      <div className="px-3 mt-4 mb-2">
        {isEditing ? (
          <textarea 
            value={profile.bio}
            onChange={(e) => setProfile({...profile, bio: e.target.value})}
            className="w-full text-[14px] text-foreground/80 leading-[1.4] tracking-tight font-medium outline-none border border-pastel-300 rounded p-1 resize-none h-20"
          />
        ) : (
          <div className="text-[14px] text-foreground/80 leading-[1.4] whitespace-pre-line tracking-tight font-medium">
            {profile.bio}
          </div>
        )}
      </div>
    </div>
  );
}

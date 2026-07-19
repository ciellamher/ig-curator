import { SlotItem } from "@/types";
import { X, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";

interface InstagramPreviewModalProps {
  item: SlotItem;
  onClose: () => void;
}

export function InstagramPreviewModal({ item, onClose }: InstagramPreviewModalProps) {
  const imageUrl = item.urls[item.currentUrlIndex || 0];

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm" onClick={onClose}>
      
      {/* Click propagation stop inside container */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-white rounded-xl overflow-hidden flex flex-col shadow-2xl ${
          item.contentType === "Reel" ? "w-full max-w-[400px] h-[800px] max-h-[90vh] rounded-[2rem] bg-black" : "w-full max-w-[470px]"
        }`}
      >
        {item.contentType === "Reel" ? (
          // Reel Preview
          <>
            <div className="absolute inset-0 z-0 bg-neutral-900">
              {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
            </div>
            {/* Reel Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
               <span className="text-white font-bold text-lg">Reels</span>
               <button onClick={onClose}><X size={24} className="text-white drop-shadow-md hover:scale-110 transition-transform" /></button>
            </div>
            {/* Reel Footer/Sidebar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-end z-10 bg-gradient-to-t from-black/60 to-transparent pb-6">
               <div className="flex flex-col gap-2 max-w-[70%]">
                 <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pastel-300 to-pastel-500 p-[1px]">
                     <div className="w-full h-full bg-black rounded-full flex items-center justify-center text-[10px] text-white font-bold">IG</div>
                   </div>
                   <span className="text-white font-bold text-[14px]">your_username</span>
                   <button className="px-3 py-1 border border-white rounded-lg text-white text-[12px] font-bold">Follow</button>
                 </div>
                 {item.caption && <p className="text-white text-[13px] line-clamp-2">{item.caption}</p>}
                 {item.audioTrack && (
                   <div className="flex items-center gap-2 mt-1 bg-white/20 px-3 py-1 rounded-full w-fit backdrop-blur-sm">
                     <span className="text-white text-[12px]">🎵 {item.audioTrack}</span>
                   </div>
                 )}
               </div>
               <div className="flex flex-col items-center gap-5">
                 <div className="flex flex-col items-center gap-1"><Heart size={28} className="text-white drop-shadow-md" /><span className="text-white text-xs drop-shadow-md">12.4K</span></div>
                 <div className="flex flex-col items-center gap-1"><MessageCircle size={28} className="text-white drop-shadow-md" /><span className="text-white text-xs drop-shadow-md">105</span></div>
                 <div className="flex flex-col items-center gap-1"><Send size={28} className="text-white drop-shadow-md" /></div>
                 <div className="flex flex-col items-center gap-1"><MoreHorizontal size={28} className="text-white drop-shadow-md" /></div>
                 <div className="w-8 h-8 rounded-md bg-white border border-white/20 overflow-hidden mt-2 flex items-center justify-center text-[10px] font-bold text-black">Audio</div>
               </div>
            </div>
          </>
        ) : (
          // Post Preview
          <>
            {/* Post Header */}
            <div className="flex items-center justify-between p-3 border-b border-soft-100 bg-white z-10">
               <div className="flex items-center gap-2.5">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pastel-300 to-pastel-500 p-[1.5px]">
                    <div className="w-full h-full bg-black rounded-full text-[10px] text-white flex items-center justify-center font-bold">IG</div>
                 </div>
                 <span className="font-bold text-[14px] text-foreground tracking-tight">your_username</span>
               </div>
               <div className="flex items-center gap-3 text-foreground">
                 <MoreHorizontal size={20} />
               </div>
            </div>
            
            {/* Post Image */}
            <div className="w-full aspect-[4/5] bg-soft-50 relative flex items-center justify-center overflow-hidden">
               {imageUrl ? (
                 <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
               ) : (
                 <span className="text-foreground/40 font-medium">Empty Slot</span>
               )}
            </div>
            
            {/* Post Footer */}
            <div className="p-3 bg-white z-10">
              <div className="flex justify-between items-center mb-3">
                 <div className="flex gap-4">
                   <Heart size={24} className="text-foreground hover:text-foreground/70 cursor-pointer transition-colors" />
                   <MessageCircle size={24} className="text-foreground hover:text-foreground/70 cursor-pointer transition-colors" />
                   <Send size={24} className="text-foreground hover:text-foreground/70 cursor-pointer transition-colors" />
                 </div>
                 <Bookmark size={24} className="text-foreground hover:text-foreground/70 cursor-pointer transition-colors" />
              </div>
              <p className="font-bold text-[13px] text-foreground mb-1">1,024 likes</p>
              <p className="text-[14px] text-foreground whitespace-pre-wrap">
                <span className="font-bold mr-2">your_username</span>
                {item.caption || "Write a caption..."}
              </p>
            </div>
            
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-md transition-colors z-50 shadow-md hover:scale-110"
            >
              <X size={18} strokeWidth={3} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

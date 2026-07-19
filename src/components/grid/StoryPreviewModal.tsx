import { useState, useEffect } from "react";
import { SlotItem } from "@/types";
import { X } from "lucide-react";

interface StoryPreviewModalProps {
  stories: SlotItem[];
  initialIndex?: number;
  onClose: () => void;
}

export function StoryPreviewModal({ stories, initialIndex = 0, onClose }: StoryPreviewModalProps) {
  // Extract all valid image URLs in order
  const validStories = stories.filter(s => s.type === "image" && s.urls.length > 0);
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const STORY_DURATION = 4000; // 4 seconds per story

  useEffect(() => {
    if (validStories.length === 0) return;

    // Reset progress when index changes
    setProgress(0);
    
    const intervalTime = 50; // Update every 50ms
    const step = (intervalTime / STORY_DURATION) * 100;
    
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev + step >= 100) {
          // Time to advance
          if (currentIndex < validStories.length - 1) {
            setCurrentIndex(idx => idx + 1);
            return 0; // Reset for next story
          } else {
            // Reached the end
            clearInterval(timer);
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentIndex, validStories.length, onClose]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < validStories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (validStories.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
        <p className="text-white mb-6 font-medium text-lg">No images in this folder yet.</p>
        <button onClick={onClose} className="px-6 py-2.5 bg-white text-black rounded-full font-bold hover:bg-neutral-200 transition-colors">
          Go Back
        </button>
      </div>
    );
  }

  const currentItem = validStories[currentIndex];
  const imageUrl = currentItem.urls[currentItem.currentUrlIndex || 0];

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center sm:p-4 animate-in fade-in duration-200 backdrop-blur-sm">
      {/* Container simulating a phone screen on desktop, or full screen on mobile */}
      <div className="relative w-full h-full sm:max-w-[400px] sm:h-[800px] sm:max-h-[90vh] bg-neutral-900 sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl ring-1 ring-white/10">
        
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img src={imageUrl} alt="" className="w-full h-full object-cover select-none" />
          
          {/* Text Overlay if present */}
          {currentItem.text && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div 
                className="px-4 py-2 font-bold text-xl text-center rounded-lg backdrop-blur-sm shadow-xl"
                style={{ 
                  backgroundColor: currentItem.hexColor || 'rgba(0,0,0,0.5)',
                  color: 'white'
                }}
              >
                {currentItem.text}
              </div>
            </div>
          )}
        </div>

        {/* Top UI Overlay */}
        <div className="absolute top-0 left-0 right-0 z-20 pt-4 sm:pt-6 px-2 pb-12 bg-gradient-to-b from-black/60 to-transparent flex flex-col gap-3 pointer-events-none">
          
          {/* Progress Bars */}
          <div className="flex gap-[3px] w-full px-1">
            {validStories.map((_, idx) => (
              <div key={idx} className="h-[2px] flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-md">
                <div 
                  className="h-full bg-white rounded-full"
                  style={{
                    width: idx < currentIndex ? "100%" : idx === currentIndex ? `${progress}%` : "0%",
                    transition: idx === currentIndex ? "width 50ms linear" : "none"
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header (Username & Close) */}
          <div className="flex items-center justify-between px-2 pt-1 pointer-events-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pastel-300 to-pastel-500 p-[1.5px] shadow-sm">
                <div className="w-full h-full bg-black rounded-full border border-black overflow-hidden flex items-center justify-center">
                   <span className="text-[10px] text-white/50 font-bold">IG</span>
                </div>
              </div>
              <span className="text-white font-bold text-[14px] tracking-tight drop-shadow-md">
                your_username
              </span>
              <span className="text-white/60 text-[13px] drop-shadow-md font-medium">
                2h
              </span>
            </div>

            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors active:scale-90">
              <X size={26} className="text-white drop-shadow-md" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Tap Zones */}
        <div className="absolute inset-0 z-10 flex">
          {/* Left tap zone: 30% of width */}
          <div className="w-[30%] h-full cursor-pointer" onClick={handlePrev} />
          {/* Right tap zone: 70% of width */}
          <div className="w-[70%] h-full cursor-pointer" onClick={handleNext} />
        </div>
      </div>
    </div>
  );
}

export type ContentType = "Post" | "Reel" | "Carousel" | "Story" | "StoryFolder" | "TikTok";

export type SlotItem = {
  id: string;
  type: "image" | "placeholder";
  urls: string[];
  currentUrlIndex: number;
  hexColor: string;
  text: string;
  
  // Metadata for Editor Panel
  caption?: string;
  audioTrack?: string;
  contentType?: ContentType;
  scheduledTime?: string;
  folderId?: string; // Links a story item to its parent StoryFolder
  
  // Instagram Sync
  isLocked?: boolean;
  isHiddenFromGrid?: boolean;
};

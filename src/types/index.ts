export type ContentType = "Post" | "Reel" | "Carousel" | "Story";

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
  
  // Instagram Sync
  isLocked?: boolean;
};

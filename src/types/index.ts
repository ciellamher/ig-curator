export type ContentType = "Post" | "Reel" | "Carousel" | "Story" | "StoryFolder" | "PlaceholderFolder" | "InspoFolder" | "InspoPost" | "InspoStory" | "InspoHighlight" | "TikTok";

export type SlotItem = {
  id: string;
  type: "image" | "placeholder" | "video";
  urls: string[];
  currentUrlIndex: number;
  hexColor: string;
  text: string;
  imageSettings?: Record<number, { scale: number; x: number; y: number }>;
  fontSize?: number;
  
  // Metadata for Editor Panel
  caption?: string;
  audioTrack?: string;
  contentType?: ContentType;
  scheduledTime?: string;
  folderId?: string; // Links a story item to its parent StoryFolder
  
  // Instagram Sync
  isLocked?: boolean;
  /** Off the Posts grid (a reel still shows in Reels) — the page's "Hide from Posts grid" */
  isHiddenFromGrid?: boolean;
  /** Not on the phone at all (Posts and Reels) — Edit Slot's "Hide from phone" */
  isHiddenFromPhone?: boolean;
  /** A video's cover picture (picked frame or uploaded), shown in the grid instead of the playing video */
  coverUrl?: string;

  /** Which collection a board belongs to beside the phone (none = Inspo). */
  library?: "other" | "fits" | "highlights";
};

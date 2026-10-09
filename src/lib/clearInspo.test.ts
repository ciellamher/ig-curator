import { describe, expect, it } from "vitest"
import { splitInspo } from "./clearInspo"
import type { SlotItem } from "@/types"

const box = (id: string, extra: Partial<SlotItem> = {}): SlotItem => ({ id, type: "image", urls: [], currentUrlIndex: 0, hexColor: "#E4E4E7", text: "", ...extra })

describe("splitInspo", () => {
  it("removes inspo boards, sub-boards and their photos, keeping everything else", () => {
    const items = [
      box("post", { contentType: "Post", urls: ["local-media://p1"] }),
      box("draft", { contentType: "Post", folderId: "draft-pool", urls: ["local-media://shared"] }),
      box("story-folder", { contentType: "StoryFolder" }),
      box("story", { contentType: "Story", folderId: "story-folder", urls: ["local-media://s1"] }),
      box("board", { contentType: "InspoFolder" }),
      box("sub-board", { contentType: "InspoFolder", folderId: "board" }),
      box("inspo-1", { contentType: "InspoPost", folderId: "board", urls: ["local-media://i1"] }),
      box("inspo-2", { contentType: "InspoPost", folderId: "sub-board", urls: ["local-media://i2", "local-media://shared"] }),
      box("loose", { contentType: "Post", folderId: "sub-board", urls: ["local-media://i3"] }),
    ]
    const { keep, removed, mediaToDelete } = splitInspo(items)
    expect(keep.map((i) => i.id)).toEqual(["post", "draft", "story-folder", "story"])
    expect(removed.map((i) => i.id)).toEqual(["board", "sub-board", "inspo-1", "inspo-2", "loose"])
    expect(mediaToDelete.sort()).toEqual(["i1", "i2", "i3"]) // "shared" is still used by a draft
  })
})

import { describe, expect, it } from "vitest"
import type { SlotItem } from "@/types"
import { removeRepeatedPhotos } from "./feedRepair"

const box = (id: string, urls: string[], extra: Partial<SlotItem> = {}): SlotItem => ({
  id, type: "image", urls, currentUrlIndex: 0, hexColor: "#fff", text: "", ...extra,
})

describe("removeRepeatedPhotos", () => {
  it("removes photos appended to a box again", () => {
    const { items, changed } = removeRepeatedPhotos([box("slot-a", ["u1", "u2", "u1", "u2", "u1"], { currentUrlIndex: 4 })])
    expect(changed).toBe(true)
    expect(items[0].urls).toEqual(["u1", "u2"])
    expect(items[0].currentUrlIndex).toBe(1)
  })
  it("removes repeated stories in the same folder only", () => {
    const { items } = removeRepeatedPhotos([
      box("slot-f", [], { contentType: "StoryFolder" }),
      box("story-1", ["s1"], { folderId: "slot-f", contentType: "Story" }),
      box("story-2", ["s1"], { folderId: "slot-f", contentType: "Story" }),
      box("story-3", ["s1"], { folderId: "slot-g", contentType: "Story" }),
    ])
    expect(items.map((i) => i.id)).toEqual(["slot-f", "story-1", "story-3"])
  })
  it("drops the bogus box and leaves a clean feed untouched", () => {
    expect(removeRepeatedPhotos([box("true", [])]).items).toEqual([])
    const clean = [box("slot-a", ["u1"])]
    const res = removeRepeatedPhotos(clean)
    expect(res.changed).toBe(false)
    expect(res.items).toBe(clean)
  })
})

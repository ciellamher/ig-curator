import { describe, expect, it } from "vitest"
import { alreadyIn, withoutMoved } from "./photoDrag"

const items = [
  { id: "board", contentType: "InspoFolder" },
  { id: "pin", contentType: "InspoPost", folderId: "board" },
  { id: "folder", contentType: "StoryFolder" },
  { id: "story", contentType: "Story", folderId: "folder" },
  { id: "post", contentType: "Post" },
]

describe("moving dragged photos", () => {
  it("removes the photos and stories they came from, so nothing is left behind", () => {
    expect(withoutMoved(items, ["pin", "story"]).map((i) => i.id)).toEqual(["board", "folder", "post"])
  })
  it("never removes a board or folder", () => {
    expect(withoutMoved(items, ["board", "folder"])).toHaveLength(items.length)
  })
  it("keeps what is already in the folder it was dropped into", () => {
    expect(withoutMoved(items, ["story"], "folder")).toHaveLength(items.length)
    expect(alreadyIn(items, ["story"], "folder")).toBe(true)
    expect(alreadyIn(items, ["pin"], "folder")).toBe(false)
    expect(alreadyIn(items, [], "folder")).toBe(false)
  })
})

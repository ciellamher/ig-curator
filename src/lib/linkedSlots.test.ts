import { describe, expect, it } from "vitest"
import type { SlotItem } from "@/types"
import { mergeLinked, slotPhotos, syncLinked } from "./linkedSlots"

const box = (id: string, extra: Partial<SlotItem> = {}): SlotItem => ({ id, type: "image", urls: [], currentUrlIndex: 0, hexColor: "", text: "", ...extra })
const base: SlotItem[] = [
  box("post", { contentType: "Post", urls: ["a"] }),
  box("folder", { contentType: "StoryFolder", type: "placeholder" }),
  box("s1", { contentType: "Story", folderId: "folder", urls: ["a"], text: "hello" }),
  box("other", { contentType: "Post", urls: ["z"] }),
]
const groups = [["post", "folder"]]

describe("a page's story folder and post hold the same photos", () => {
  it("a story added to the folder shows in the post", () => {
    const next = [...base, box("s2", { contentType: "Story", folderId: "folder", urls: ["b"] })]
    expect(slotPhotos(syncLinked(base, next, groups), "post")).toEqual(["a", "b"])
  })
  it("a photo added to the post becomes a story, and existing stories are kept as they are", () => {
    const next = base.map((i) => (i.id === "post" ? { ...i, urls: ["a", "c"] } : i))
    const out = syncLinked(base, next, groups)
    expect(slotPhotos(out, "folder")).toEqual(["a", "c"])
    expect(out.find((i) => i.id === "s1")?.text).toBe("hello")
  })
  it("rearranging the post rearranges the stories", () => {
    const two = syncLinked(base, base.map((i) => (i.id === "post" ? { ...i, urls: ["a", "c"] } : i)), groups)
    const swapped = two.map((i) => (i.id === "post" ? { ...i, urls: ["c", "a"] } : i))
    expect(slotPhotos(syncLinked(two, swapped, groups), "folder")).toEqual(["c", "a"])
  })
  it("removing a story removes it from the post; other boxes are untouched", () => {
    const out = syncLinked(base, base.filter((i) => i.id !== "s1"), groups)
    expect(slotPhotos(out, "post")).toEqual([])
    expect(slotPhotos(out, "other")).toEqual(["z"])
  })
  it("when they first differ, both get every photo (nothing is lost)", () => {
    const differ = base.map((i) => (i.id === "post" ? { ...i, urls: ["x"] } : i))
    const out = mergeLinked(differ, groups)
    expect(slotPhotos(out, "folder")).toEqual(["a", "x"])
    expect(slotPhotos(out, "post")).toEqual(["a", "x"])
  })
})

import { describe, expect, it } from "vitest"
import { isHeicBlob, looksHeic } from "./heic"

describe("HEIC photos", () => {
  it("are recognised by type or by name", () => {
    expect(looksHeic({ type: "image/heic", name: "a.HEIC" })).toBe(true)
    expect(looksHeic({ type: "", name: "IMG_0001.heic" })).toBe(true)
    expect(looksHeic({ type: "image/jpeg", name: "a.jpg" })).toBe(false)
  })
  it("are recognised by their bytes when saved without a type", async () => {
    const heic = new Blob([new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic"), 0, 0])])
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])], { type: "image/jpeg" })
    expect(await isHeicBlob(heic)).toBe(true)
    expect(await isHeicBlob(jpeg)).toBe(false)
  })
})

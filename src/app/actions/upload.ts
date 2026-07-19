"use server"

import { put } from "@vercel/blob"

export async function uploadImage(formData: FormData) {
  const file = formData.get("file") as File
  if (!file) {
    throw new Error("No file provided")
  }
  
  // In a real app, you should check authentication before uploading
  
  const blob = await put(file.name, file, {
    access: "public",
  })
  
  return { url: blob.url }
}

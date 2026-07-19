export async function fetchInstagramMedia(accessToken: string) {
  try {
    const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Instagram API error: ${res.statusText}`);
    }
    const data = await res.json();
    return data.data; // Array of media objects
  } catch (error) {
    console.error("Failed to fetch Instagram media:", error);
    return null;
  }
}

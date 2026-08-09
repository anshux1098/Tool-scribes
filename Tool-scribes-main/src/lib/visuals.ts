
/**
 * Generates a deterministic fallback URL for a profile avatar or banner based on the username and interests.
 * 
 * Uses DiceBear for avatars (identicon or initials) and Unsplash for banners.
 */
export function getFallbackAvatarUrl(username: string): string {
  // DiceBear Identicon based on username for a "minimal" editorial feel
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(username)}`;
}

export function getFallbackBannerUrl(username: string, category: string = 'architecture'): string {
  // Use a more reliable source for deterministic editorial backgrounds
  // https://picsum.photos/seed/${seed}/1600/500
  const seed = encodeURIComponent(`${username}-${category}`);
  return `https://picsum.photos/seed/${seed}/1600/500`;
}

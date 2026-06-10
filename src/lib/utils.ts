import { ROLE_COLORS } from "./config";

export const getRoleColors = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('mod')) return ROLE_COLORS.mod;
  if (r.includes('radiant')) return ROLE_COLORS.radiant;
  if (r.includes('ritualist')) return ROLE_COLORS.ritualist;
  if (r.includes('ritty')) return ROLE_COLORS.ritty;
  if (r.includes('bitty')) return ROLE_COLORS.bitty;
  return ROLE_COLORS.seeker;
};

export function getHighResDiscordUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.includes("discordapp.com") || url.includes("discord.com")) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set("size", "1024");
      return urlObj.toString();
    } catch (_) {
      return url;
    }
  }
  return url;
}

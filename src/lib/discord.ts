import { DISCORD_CONFIG } from "./config";

export async function getUserRoles(discordId: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn("DISCORD_BOT_TOKEN not found. Skipping live Discord role lookup.");
    return null;
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_CONFIG.serverId}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const userRoles = data.roles as string[];
    
    // Map role IDs to our names
    const roleNames: string[] = [];
    const roleMap = DISCORD_CONFIG.roles as Record<string, string>;
    
    // Reverse the map to go from ID -> Name
    const idToName = Object.entries(roleMap).reduce((acc, [name, id]) => {
      acc[id] = name;
      return acc;
    }, {} as Record<string, string>);

    userRoles.forEach(roleId => {
      if (idToName[roleId]) {
        roleNames.push(idToName[roleId]);
      }
    });

    return roleNames.length > 0 ? roleNames : ["Seeker"];
  } catch (error) {
    console.error("Error fetching Discord roles:", error);
    return null;
  }
}

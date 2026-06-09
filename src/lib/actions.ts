"use server";

import { auth } from "@/auth";
import { DISCORD_CONFIG } from "@/lib/config";

type DiscordGuild = {
  id: string;
};

type DiscordGuildMember = {
  roles?: string[];
  user?: {
    username?: string;
  };
};

type RitualSession = {
  accessToken?: string;
  user?: {
    name?: string | null;
    image?: string | null;
  };
};

type DiscordRole = {
  id: string;
  type: string;
  name: string;
};

type DiscordStats = {
  messages: string;
  joins: string;
  activity: string;
};

type MockRole = DiscordRole & {
  stats: DiscordStats;
};

export async function getDiscordUserRoles() {
  const session = await auth() as RitualSession | null;
  
  if (!session || !session.accessToken) {
    return { error: "Not authenticated" };
  }

  try {
    // 1. Check only whether the user is in the Ritual server.
    const response = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch guilds");
    const guilds = await response.json() as DiscordGuild[];

    const isRitualMember = guilds.some((guild) => guild.id === DISCORD_CONFIG.serverId);
    guilds.length = 0;
    
    if (!isRitualMember) {
      return { 
        role: { id: "seeker", type: "seeker", name: "Seeker" },
        username: session.user?.name,
        trueUsername: session.user?.name,
        avatar: session.user?.image,
        stats: { messages: "0", joins: "New", activity: "None" }
      };
    }

    // 2. Get member roles for this guild
    // Note: This requires guilds.members.read scope
    const memberResponse = await fetch(
      `https://discord.com/api/users/@me/guilds/${DISCORD_CONFIG.serverId}/member`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!memberResponse.ok) {
      return { 
        role: { id: "seeker", type: "seeker", name: "Seeker" },
        username: session.user?.name,
        trueUsername: session.user?.name,
        avatar: session.user?.image,
        stats: { messages: "0", joins: "New", activity: "None" }
      };
    }

    const memberData = await memberResponse.json() as DiscordGuildMember;
    const roles = [...(memberData.roles || [])];
    const trueUsername = memberData.user?.username || session.user?.name;
    memberData.roles = [];
    memberData.user = undefined;

    // 3. Determine highest role
    const rolePriority = [
      { id: DISCORD_CONFIG.roles.mod, type: "mod", name: "Mod" },
      { id: DISCORD_CONFIG.roles.raiden, type: "raiden", name: "Radiant Ritualist" },
      { id: DISCORD_CONFIG.roles.ritualist, type: "ritualist", name: "Ritualist" },
      { id: DISCORD_CONFIG.roles.ritty, type: "ritty", name: "Ritty" },
      { id: DISCORD_CONFIG.roles.bitty, type: "bitty", name: "Bitty" },
    ];

    const highestRole = rolePriority.find(rp => roles.includes(rp.id));
    const resolvedRole = highestRole || { id: "seeker", type: "seeker", name: "Seeker" };
    roles.length = 0;

    const mockStats: Record<string, DiscordStats> = {
      mod: { messages: "5.4k", joins: "Jan 2024", activity: "Master" },
      raiden: { messages: "1.2k", joins: "Feb 2024", activity: "Legendary" },
      ritualist: { messages: "450", joins: "May 2024", activity: "High" },
      ritty: { messages: "120", joins: "Aug 2024", activity: "Medium" },
      bitty: { messages: "45", joins: "Oct 2024", activity: "Low" },
      seeker: { messages: "0", joins: "New", activity: "None" },
    };

    return { 
      role: resolvedRole,
      username: session.user?.name,
      trueUsername: trueUsername,
      avatar: session.user?.image,
      stats: mockStats[resolvedRole.type] || mockStats.seeker
    };
  } catch (err) {
    console.error(err);
    return { 
      role: { id: "seeker", type: "seeker", name: "Seeker" },
      username: session?.user?.name || "Explorer",
      trueUsername: session?.user?.name || "explorer",
      avatar: session?.user?.image,
      stats: { messages: "0", joins: "New", activity: "None" }
    };
  }
}

// Mock function for development
export async function getMockUserRoles(roleType: string = "ritualist") {
  const roleMap: Record<string, MockRole> = {
    mod: { id: DISCORD_CONFIG.roles.mod, type: "mod", name: "Mod", stats: { messages: "5.4k", joins: "Jan 2024", activity: "Master" } },
    raiden: { id: DISCORD_CONFIG.roles.raiden, type: "raiden", name: "Radiant Ritualist", stats: { messages: "1.2k", joins: "Feb 2024", activity: "Legendary" } },
    ritualist: { id: DISCORD_CONFIG.roles.ritualist, type: "ritualist", name: "Ritualist", stats: { messages: "450", joins: "May 2024", activity: "High" } },
    ritty: { id: DISCORD_CONFIG.roles.ritty, type: "ritty", name: "Ritty", stats: { messages: "120", joins: "Aug 2024", activity: "Medium" } },
    bitty: { id: DISCORD_CONFIG.roles.bitty, type: "bitty", name: "Bitty", stats: { messages: "45", joins: "Oct 2024", activity: "Low" } },
  };

  const role = roleMap[roleType] || roleMap.ritualist;

  return {
    role: role,
    username: "RitualExplorer",
    avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
    stats: role.stats
  };
}

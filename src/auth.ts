import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

const DISCORD_OAUTH_SCOPES = [
  "identify",
  "guilds",
  "guilds.members.read",
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60,
    updateAge: 15 * 60,
  },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        url: "https://discord.com/api/oauth2/authorize",
        params: {
          scope: DISCORD_OAUTH_SCOPES.join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.userId = profile.id;
        token.username = profile.username;
      }
      return token;
    },
    async session({ session, token }) {
      const ritualSession = session as typeof session & {
        accessToken?: string;
        user?: typeof session.user & {
          id?: string;
          username?: string;
        };
      };

      ritualSession.accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
      if (ritualSession.user) {
        if (typeof token.userId === "string") {
          ritualSession.user.id = token.userId;
        }
        if (typeof token.username === "string") {
          ritualSession.user.username = token.username;
        }
      }
      return ritualSession;
    },
  },
});

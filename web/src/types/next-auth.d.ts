import { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      providerUserId?: string;
      username: string;
      trustLevel: number | null;
      avatarUrl: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    localUserId?: string;
    providerUserId?: string;
    username?: string;
    trustLevel?: number | null;
    avatarUrl?: string | null;
  }
}

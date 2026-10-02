import { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      providerUserId?: string;
      identitySubject?: string;
      identityIssuer?: string;
      username: string;
      trustLevel: number | null;
      avatarUrl: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    localUserId?: string;
    identityProvider?: "rauthy";
    identityIssuer?: string;
    identityExpiresAt?: number;
    providerUserId?: string;
    username?: string;
    trustLevel?: number | null;
    avatarUrl?: string | null;
  }
}

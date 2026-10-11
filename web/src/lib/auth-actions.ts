"use server";

import { signIn, signOut } from "@/auth";
import { getIdentityProvider } from "@/lib/identity-provider";

export async function loginWithLinuxDo(): Promise<void> {
  await signIn("linuxdo", { redirectTo: "/?auth=success" });
}

export async function loginWithRauthy(): Promise<void> {
  if (getIdentityProvider() !== "rauthy") throw new Error("Rauthy login is disabled");
  await signIn("rauthy", { redirectTo: "/?auth=success" });
}

export async function loginWithLocalDev(): Promise<void> {
  await signIn("local-dev", { redirectTo: "/?auth=success", intent: "dev-bypass" });
}

export async function logoutWithLinuxDo(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

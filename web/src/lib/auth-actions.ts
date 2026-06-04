"use server";

import { signIn, signOut } from "@/auth";

export async function loginWithLinuxDo(): Promise<void> {
  await signIn("linuxdo", { redirectTo: "/?auth=success" });
}

export async function loginWithLocalDev(): Promise<void> {
  await signIn("local-dev", { redirectTo: "/?auth=success", intent: "dev-bypass" });
}

export async function logoutWithLinuxDo(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

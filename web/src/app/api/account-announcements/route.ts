import { accountAnnouncements, normalizeAccountAnnouncements } from "@/lib/account-announcements";
import { listPublishedAccountAnnouncements } from "@/lib/account-client";

export async function GET() {
  try {
    const announcements = normalizeAccountAnnouncements(await listPublishedAccountAnnouncements());
    return Response.json(
      {
        announcements,
        latestPublishedAt: announcements[0]?.publishedAt ?? null,
      },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch {
    // Fall back to the local bootstrap catalog so the terminal stays usable if account-api is unavailable.
  }

  return Response.json(
    {
      announcements: accountAnnouncements,
      latestPublishedAt: accountAnnouncements[0]?.publishedAt ?? null,
    },
    {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

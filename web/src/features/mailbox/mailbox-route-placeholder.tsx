import { Card } from "@/components/ui/card";

import { MAILBOX_ROUTE_NOTICE } from "./routes";

export function MailboxRoutePlaceholder() {
  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <Card className="app-stack">
          <h1 className="mg-title">{MAILBOX_ROUTE_NOTICE.title}</h1>
          <p className="mg-copy">{MAILBOX_ROUTE_NOTICE.description}</p>
        </Card>
      </div>
    </main>
  );
}

export function MailboxIcon() {
  return (
    <svg aria-hidden="true" className="app-mailbox-trigger__icon" viewBox="0 0 24 24">
      <path
        d="M4.5 7.5h15v9h-15z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m5.5 8.5 6.5 5 6.5-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-mailbox-close__icon" viewBox="0 0 24 24">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg aria-hidden="true" className="app-mailbox-star__icon" viewBox="0 0 24 24">
      <path
        d="m12 3.8 2.46 5 5.52.8-4 3.9.94 5.5L12 16.4 7.08 19l.94-5.5-4-3.9 5.52-.8Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg aria-hidden="true" className="app-mailbox-trash__icon" viewBox="0 0 24 24">
      <path
        d="M5.5 7.5h13m-9-3h5m-7.5 3 .9 11.4a1.2 1.2 0 0 0 1.2 1.1h5.8a1.2 1.2 0 0 0 1.2-1.1l.9-11.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M10 11v5.5M14 11v5.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ItemAttachmentIcon() {
  return (
    <svg aria-hidden="true" className="app-mailbox-attachment__generic-icon" viewBox="0 0 24 24">
      <path
        d="m12 3 8 4.5v9L12 21 4 16.5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m4 7.5 8 4.5 8-4.5M12 12v9"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

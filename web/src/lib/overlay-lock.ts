const BODY_LOCK_COUNT_KEY = "overlayLockCount";
const BODY_LOCK_OVERFLOW_KEY = "overlayLockOverflow";

export function acquireBodyOverlayLock() {
  if (typeof document === "undefined") {
    return () => {};
  }

  const body = document.body;
  const currentCount = Number(body.dataset[BODY_LOCK_COUNT_KEY] || "0");

  if (currentCount === 0) {
    body.dataset[BODY_LOCK_OVERFLOW_KEY] = body.style.overflow;
    body.style.overflow = "hidden";
  }

  body.dataset[BODY_LOCK_COUNT_KEY] = String(currentCount + 1);

  let released = false;

  return () => {
    if (released) {
      return;
    }
    released = true;

    const nextCount = Math.max(0, Number(body.dataset[BODY_LOCK_COUNT_KEY] || "1") - 1);
    if (nextCount === 0) {
      body.style.overflow = body.dataset[BODY_LOCK_OVERFLOW_KEY] || "";
      delete body.dataset[BODY_LOCK_COUNT_KEY];
      delete body.dataset[BODY_LOCK_OVERFLOW_KEY];
      return;
    }

    body.dataset[BODY_LOCK_COUNT_KEY] = String(nextCount);
  };
}

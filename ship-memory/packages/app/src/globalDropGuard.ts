const guardedDragEvents = ["dragenter", "dragover", "drop"] as const;

type DropGuardTarget = Pick<EventTarget, "addEventListener">;

const installedTargets = new WeakSet<object>();

export function handleGlobalDropNavigationGuard(event: DragEvent): void {
  event.preventDefault();

  if (event.type === "dragover" && event.dataTransfer) {
    try {
      event.dataTransfer.dropEffect = "copy";
    } catch {
      // Some WebKit drag sources expose a read-only dropEffect.
    }
  }
}

export function installGlobalDropNavigationGuard(
  target: DropGuardTarget = window,
): void {
  if (installedTargets.has(target)) return;

  for (const eventName of guardedDragEvents) {
    target.addEventListener(
      eventName,
      handleGlobalDropNavigationGuard as EventListener,
      true,
    );
  }

  installedTargets.add(target);
}

if (typeof window !== "undefined") {
  installGlobalDropNavigationGuard(window);
}

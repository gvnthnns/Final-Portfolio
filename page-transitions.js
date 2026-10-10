const pageOrder = new Map([
  ["index.html", 0],
  ["about.html", 1],
  ["projects.html", 2],
  ["senior-design.html", 3],
  ["resume.html", 4],
  ["reflections.html", 5],
  ["contact.html", 6],
]);
const transitionStorageKey = "page-transition-direction";
const transitionDeadlineKey = "page-transition-deadline";
const transitionMotionKey = "page-transition-motion";
const outgoingTransitionMs = {
  full: 520,
  reduced: 360,
};
const incomingTransitionMs = {
  full: 760,
  reduced: 600,
};
const navigationLockMs = {
  full: outgoingTransitionMs.full + incomingTransitionMs.full + 100,
  reduced: outgoingTransitionMs.reduced + incomingTransitionMs.reduced + 100,
};
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const currentIndex = pageOrder.get(currentPage);
const pendingDirection = sessionStorage.getItem(transitionStorageKey);
const pendingMotion = sessionStorage.getItem(transitionMotionKey);
const pendingDeadline = Number(sessionStorage.getItem(transitionDeadlineKey));
let navigationLocked = false;
let unlockTimer;

function setInternalLinksDisabled(locked) {
  document.querySelectorAll("a[href]").forEach((link) => {
    const destination = new URL(link.href, window.location.href);
    const targetPage = destination.pathname.split("/").pop() || "index.html";
    const isInternalPageLink =
      destination.origin === window.location.origin && pageOrder.has(targetPage);

    if (isInternalPageLink) {
      if (locked) {
        link.setAttribute("aria-disabled", "true");
      } else {
        link.removeAttribute("aria-disabled");
      }
    }
  });
}

if (pendingDirection === "left" || pendingDirection === "right") {
  document.documentElement.dataset.pageDirection = pendingDirection;
  document.documentElement.dataset.navigationTransition = "entering";
  if (pendingMotion === "reduced") {
    document.documentElement.dataset.navigationMotion = "reduced";
  }
  sessionStorage.removeItem(transitionStorageKey);
}
sessionStorage.removeItem(transitionMotionKey);

function setNavigationLocked(locked) {
  navigationLocked = locked;
  document.documentElement.toggleAttribute("data-navigation-locked", locked);
  if (document.readyState !== "loading") {
    setInternalLinksDisabled(locked);
  }
}

function lockNavigationUntil(deadline) {
  clearTimeout(unlockTimer);
  setNavigationLocked(true);
  unlockTimer = window.setTimeout(() => {
    sessionStorage.removeItem(transitionDeadlineKey);
    setNavigationLocked(false);
  }, Math.max(0, deadline - Date.now()));
}

if (Number.isFinite(pendingDeadline) && pendingDeadline > Date.now()) {
  lockNavigationUntil(pendingDeadline);
} else {
  sessionStorage.removeItem(transitionDeadlineKey);
}

document.addEventListener("DOMContentLoaded", () => {
  if (navigationLocked) {
    setInternalLinksDisabled(true);
  }

  if (document.documentElement.dataset.navigationTransition === "entering") {
    window.setTimeout(() => {
      delete document.documentElement.dataset.navigationTransition;
      delete document.documentElement.dataset.navigationMotion;
    }, incomingTransitionMs[pendingMotion === "reduced" ? "reduced" : "full"] + 100);
  }
});

document.addEventListener("click", (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  ) {
    return;
  }

  const link = event.target.closest("a[href]");

  if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) {
    return;
  }

  const destination = new URL(link.href, window.location.href);
  const targetPage = destination.pathname.split("/").pop() || "index.html";
  const targetIndex = pageOrder.get(targetPage);

  if (
    destination.origin !== window.location.origin ||
    destination.pathname === window.location.pathname ||
    currentIndex === undefined ||
    targetIndex === undefined
  ) {
    return;
  }

  if (navigationLocked) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = reducedMotion ? "reduced" : "full";
  const direction = targetIndex > currentIndex ? "right" : "left";
  document.documentElement.dataset.pageDirection = direction;
  if (reducedMotion) {
    document.documentElement.dataset.navigationMotion = "reduced";
  } else {
    delete document.documentElement.dataset.navigationMotion;
  }

  const deadline = Date.now() + navigationLockMs[motion];
  sessionStorage.setItem(transitionDeadlineKey, String(deadline));
  lockNavigationUntil(deadline);

  sessionStorage.setItem(transitionStorageKey, direction);
  sessionStorage.setItem(transitionMotionKey, motion);
  document.documentElement.dataset.navigationTransition = "leaving";
  event.preventDefault();
  window.setTimeout(() => {
    window.location.assign(destination.href);
  }, outgoingTransitionMs[motion]);
});

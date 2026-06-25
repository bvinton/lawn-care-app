/** @type {Array<() => boolean>} */
const handlers = [];

/**
 * Register a back handler (most recent wins). Return true if the event was handled.
 * @param {() => boolean} handler
 */
export function registerBackHandler(handler) {
  handlers.push(handler);
  return () => {
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

/** @returns {boolean} */
export function runBackHandlers() {
  for (let i = handlers.length - 1; i >= 0; i -= 1) {
    if (handlers[i]()) return true;
  }
  return false;
}

/** Push a history entry so the next hardware back fires popstate instead of closing the PWA. */
export function pushAppHistoryState(state = {}) {
  window.history.pushState({ lawnApp: true, ...state }, '', window.location.pathname);
}

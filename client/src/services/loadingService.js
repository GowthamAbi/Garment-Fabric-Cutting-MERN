let pendingRequests = 0;
const listeners = new Set();

function notifyListeners() {
  const isLoading = pendingRequests > 0;
  listeners.forEach((listener) => listener(isLoading));
}

export function beginLoading() {
  pendingRequests += 1;
  notifyListeners();
}

export function endLoading() {
  pendingRequests = Math.max(0, pendingRequests - 1);
  notifyListeners();
}

export function subscribeToLoading(listener) {
  listeners.add(listener);
  listener(pendingRequests > 0);
  return () => listeners.delete(listener);
}

export function installGlobalFetchLoader() {
  if (window.__accessoriesFlowFetchLoaderInstalled) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...argumentsList) => {
    beginLoading();

    try {
      return await originalFetch(...argumentsList);
    } finally {
      endLoading();
    }
  };

  window.__accessoriesFlowFetchLoaderInstalled = true;
}

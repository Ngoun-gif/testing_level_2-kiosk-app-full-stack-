window.Api = window.Api || {};

Api.call = async (method, ...args) => {
  if (!window.pywebview?.api) throw new Error("Python backend not ready");
  const fn = window.pywebview.api[method];
  if (typeof fn !== "function") throw new Error(`API method not found: ${method}`);
  return await fn(...args);
};

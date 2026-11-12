import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Guard against unhandled rejections / errors injected by browser extensions
// (e.g. MetaMask / Web3 inpage scripts). These are outside our control and must
// never crash the app or bubble up as fatal runtime errors.
function isExtensionError(value: unknown): boolean {
  try {
    const anyVal = value as
      | { message?: unknown; stack?: unknown; reason?: unknown }
      | string
      | null
      | undefined;
    const msg =
      typeof anyVal === "string"
        ? anyVal
        : anyVal && (anyVal.message ?? anyVal.reason) != null
          ? String(anyVal.message ?? anyVal.reason)
          : "";
    const stack = anyVal && typeof anyVal === "object" && anyVal.stack ? String(anyVal.stack) : "";
    const text = `${msg} ${stack}`;
    return /chrome-extension:\/\/|moz-extension:\/\/|safari-extension:\/\/|extension:\/\/|MetaMask|metamask|inpage\.js|web3|ethereum/i.test(
      text,
    );
  } catch {
    return false;
  }
}

window.addEventListener("unhandledrejection", (event) => {
  if (isExtensionError(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

window.addEventListener(
  "error",
  (event) => {
    const err = event.error ?? event.message ?? event.filename ?? "";
    if (isExtensionError(err) || isExtensionError(event.filename)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true,
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
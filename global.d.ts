import type { FocuslyApi } from "../../electron/preload";

declare global {
  interface Window {
    focusly: FocuslyApi;
  }
}

export {};

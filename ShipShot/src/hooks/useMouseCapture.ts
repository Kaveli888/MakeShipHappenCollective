import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { CaptureMode } from "../types";

export type MouseButton =
  | { kind: "Right" }
  | { kind: "Middle" }
  | { kind: "Other"; code: number };

export type MouseBinding = {
  action: CaptureMode;
  button: MouseButton;
};

export type MouseCaptureConfig = {
  enabled: boolean;
  swallow: boolean;
  bindings: MouseBinding[];
};

export type MouseCaptureStatus = {
  backend: "starting" | "grab" | "listen" | "failed";
  permissionOk: boolean;
};

export function mouseButtonLabel(button: MouseButton | undefined) {
  if (!button) return "Not bound";
  if (button.kind === "Right") return "Right click";
  if (button.kind === "Middle") return "Middle click";
  return `Side button ${button.code}`;
}

export function useMouseCapture() {
  const [config, setConfig] = useState<MouseCaptureConfig | null>(null);
  const [status, setStatus] = useState<MouseCaptureStatus | null>(null);
  const [bindingAction, setBindingAction] = useState<CaptureMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextConfig, nextStatus] = await Promise.all([
        invoke<MouseCaptureConfig>("mouse_capture_get_config"),
        invoke<MouseCaptureStatus>("mouse_capture_status"),
      ]);
      setConfig(nextConfig);
      setStatus(nextStatus);
      setError(null);
    } catch (nextError) {
      setError(String(nextError));
    }
  }, []);

  useEffect(() => {
    let stopBound: UnlistenFn | undefined;
    void refresh();
    void listen<{ action: CaptureMode; button: MouseButton }>(
      "shipshot://mouse-bound",
      () => {
        setBindingAction(null);
        void refresh();
      },
    ).then((unlisten) => {
      stopBound = unlisten;
    });
    const refreshOnFocus = () => void refresh();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      stopBound?.();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [refresh]);

  const beginBind = useCallback(async (action: CaptureMode) => {
    await invoke("mouse_capture_begin_bind", { action });
    setBindingAction(action);
  }, []);

  const cancelBind = useCallback(async () => {
    await invoke("mouse_capture_cancel_bind");
    setBindingAction(null);
  }, []);

  const removeBinding = useCallback(async (action: CaptureMode) => {
    await invoke("mouse_capture_remove_binding", { action });
    await refresh();
  }, [refresh]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    await invoke("mouse_capture_set_enabled", { enabled });
    setConfig((current) => current ? { ...current, enabled } : current);
  }, []);

  const requestPermission = useCallback(async () => {
    await invoke("mouse_capture_request_permission");
    await refresh();
  }, [refresh]);

  const openPermissionSettings = useCallback(async () => {
    await invoke("mouse_capture_open_permission_settings");
  }, []);

  return {
    config,
    status,
    bindingAction,
    error,
    beginBind,
    cancelBind,
    removeBinding,
    setEnabled,
    requestPermission,
    openPermissionSettings,
  };
}

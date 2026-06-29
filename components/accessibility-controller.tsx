"use client";

import { useEffect } from "react";
import { usePrefs } from "@/lib/store";

/** Syncs persisted accessibility prefs to <html> data attributes. */
export function AccessibilityController() {
    const fontScale = usePrefs((s) => s.fontScale);
    const uiScale = usePrefs((s) => s.uiScale);
    const contrast = usePrefs((s) => s.contrast);

    useEffect(() => {
        const el = document.documentElement;
        if (fontScale === "base") el.removeAttribute("data-font-scale");
        else el.setAttribute("data-font-scale", fontScale);
    }, [fontScale]);

    useEffect(() => {
        const el = document.documentElement;
        if (uiScale === "base") el.removeAttribute("data-ui-scale");
        else el.setAttribute("data-ui-scale", uiScale);
    }, [uiScale]);

    useEffect(() => {
        const el = document.documentElement;
        if (contrast) el.setAttribute("data-contrast", "high");
        else el.removeAttribute("data-contrast");
    }, [contrast]);

    return null;
}

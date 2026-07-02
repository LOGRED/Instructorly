/**
 * 접근성·화면 설정(글자 크기·UI 크기·고대비·모서리 둥글기)을 <html> data 속성에 동기화하는 컴포넌트.
 */
"use client";

import { useEffect } from "react";
import { usePrefs } from "@/lib/store";

// 저장된 환경설정 값이 바뀔 때마다 <html> data 속성을 갱신해 CSS에 반영한다.
export function AccessibilityController() {
    const fontScale = usePrefs((s) => s.fontScale);
    const uiScale = usePrefs((s) => s.uiScale);
    const contrast = usePrefs((s) => s.contrast);
    const cornerRadius = usePrefs((s) => s.cornerRadius);

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

    useEffect(() => {
        const el = document.documentElement;
        if (cornerRadius === "base") el.removeAttribute("data-corner-radius");
        else el.setAttribute("data-corner-radius", cornerRadius);
    }, [cornerRadius]);

    return null;
}

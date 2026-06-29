"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontScale = "base" | "lg" | "xl";
/** UI 크기(버튼·여백·아이콘) 배수 단계 — 글자 크기와 독립적으로 동작한다. */
export type UiScale = "base" | "lg" | "xl";
/** 강좌 콘텐츠 카드 모양 — 솔리드 타일·모노 미니멀·커버·콤팩트(촘촘한 한 줄) 네 가지. 내 정보에서 고른다. */
export type CardStyle = "minimal" | "tile" | "cover" | "compact";

interface PrefsState {
    fontScale: FontScale;
    uiScale: UiScale;
    contrast: boolean;
    cardStyle: CardStyle;
    groupByContent: boolean;
    setFontScale: (f: FontScale) => void;
    cycleFontScale: () => void;
    setUiScale: (u: UiScale) => void;
    cycleUiScale: () => void;
    toggleContrast: () => void;
    setCardStyle: (s: CardStyle) => void;
    setGroupByContent: (g: boolean) => void;
    toggleGroupByContent: () => void;
}

const ORDER: FontScale[] = ["base", "lg", "xl"];

export const usePrefs = create<PrefsState>()(
    persist(
        (set, get) => ({
            fontScale: "base",
            uiScale: "base",
            contrast: false,
            cardStyle: "tile",
            groupByContent: true,
            // 글자 크기를 지정한 값으로 설정한다.
            setFontScale: (fontScale) => set({ fontScale }),
            // 글자 크기를 보통→크게→아주 크게 순서로 순환한다.
            cycleFontScale: () => {
                const i = ORDER.indexOf(get().fontScale);
                set({ fontScale: ORDER[(i + 1) % ORDER.length] });
            },
            // UI 크기를 지정한 값으로 설정한다.
            setUiScale: (uiScale) => set({ uiScale }),
            // UI 크기를 보통→크게→아주 크게 순서로 순환한다.
            cycleUiScale: () => {
                const i = ORDER.indexOf(get().uiScale);
                set({ uiScale: ORDER[(i + 1) % ORDER.length] });
            },
            // 고대비 모드를 켜고 끈다.
            toggleContrast: () => set({ contrast: !get().contrast }),
            // 강좌 콘텐츠 카드 모양을 설정한다.
            setCardStyle: (cardStyle) => set({ cardStyle }),
            // 콘텐츠별 묶기(타입별 그룹) 표시 여부를 지정한 값으로 설정한다.
            setGroupByContent: (groupByContent) => set({ groupByContent }),
            // 콘텐츠별 묶기를 켜고 끈다.
            toggleGroupByContent: () => set({ groupByContent: !get().groupByContent }),
        }),
        { name: "maketor-prefs" },
    ),
);

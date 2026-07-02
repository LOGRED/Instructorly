/**
 * 섹션 아이콘 — 직접 생성한 모던 듀오톤 아이콘 이미지를 보여 준다.
 * 아이콘 이미지를 아직 못 불러오면(생성 전이거나 누락) 기존 라인 아이콘(lucide)으로 자연스럽게 대체한다.
 */
"use client";

import { useState } from "react";
import { guideIconSrc, type GuideSection } from "./guide-data";

interface GuideIconProps {
    section: GuideSection;
    /** 이미지 아이콘 크기 클래스. */
    imgClassName?: string;
    /** 대체용 라인 아이콘 크기 클래스. */
    iconClassName?: string;
}

// 섹션 아이콘을 그린다(이미지 우선, 실패 시 라인 아이콘).
export function GuideIcon({ section, imgClassName, iconClassName }: GuideIconProps) {
    const [ok, setOk] = useState(true);
    const Fallback = section.icon;

    if (!ok) {
        return <Fallback className={iconClassName} />;
    }

    return (
        <img
            src={guideIconSrc(section.id)}
            alt=""
            className={imgClassName}
            onError={() => setOk(false)}
        />
    );
}

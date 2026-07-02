/**
 * 기능별 사용 설명 페이지 — 주소(/guide/무엇)에 해당하는 한 가지 기능 설명만 보여 준다.
 * 상단바·왼쪽 목차는 GuideShell이, 실제 설명 내용은 GuideArticle이 그린다.
 * (역할에 맞는 설명을 골라 보여 주고, 권한 없는 항목은 GuideArticle이 막는다.)
 */
"use client";

import { GuideShell } from "../_components/guide-shell";
import { GuideArticle } from "../_components/guide-article";

// 기능별 설명 페이지를 그린다.
export default function GuideSectionPage() {
    return (
        <GuideShell>
            <GuideArticle />
        </GuideShell>
    );
}

/**
 * 마크다운 렌더러 — GFM(GitHub Flavored Markdown)을 지원하는 공용 마크다운 표시 컴포넌트.
 * maketor-prose 클래스로 프로젝트 전역 타이포그래피 스타일을 적용한다.
 */
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import { cn } from "@/lib/utils";

// 마크다운 문자열을 HTML로 변환해 렌더한다.
export function Markdown({
    children,
    className,
}: {
    children: string;
    className?: string;
}) {
    return (
        <div className={cn("maketor-prose", className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkCjkFriendly]}>{children || ""}</ReactMarkdown>
        </div>
    );
}

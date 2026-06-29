/**
 * 브랜드 로고 — 브랜드 마크(아이콘)와 워드마크(Instructorly 텍스트)를 조합한 로고 컴포넌트.
 * href 가 주어지면 링크로, null 이면 순수 표시용으로 렌더한다.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

// 브랜드 로고(마크 + 워드마크)를 렌더한다.
export function BrandLogo({
    href = "/",
    showWordmark = true,
    size = 28,
    className,
}: {
    href?: string | null;
    showWordmark?: boolean;
    size?: number;
    className?: string;
}) {
    const inner = (
        <span className={cn("flex items-center gap-2.5", className)}>
            <BrandMark
                className="shrink-0 text-foreground"
                style={{ width: size, height: size }}
            />
            {showWordmark && (
                <span className="text-xl font-bold leading-none tracking-tight">
                    Instructorly
                </span>
            )}
        </span>
    );
    if (!href) return inner;
    return (
        <Link href={href} aria-label="Instructorly 홈" className="inline-flex">
            {inner}
        </Link>
    );
}

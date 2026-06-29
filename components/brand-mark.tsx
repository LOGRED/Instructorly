/**
 * 브랜드 마크 — 검은 원 안에 흰색 대문자 "I"를 넣은 Instructorly 심볼 (Instructor + ly).
 * 원은 currentColor(=text-foreground), 글자는 --background 색을 써서
 * 라이트/다크/고대비 환경에서 자동으로 명암이 반전돼 항상 또렷하게 보인다.
 */

// 브랜드 마크 아이콘(검은 원 + 흰 "I")을 렌더한다.
export function BrandMark({
    className,
    style,
}: {
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <svg
            viewBox="0 0 32 32"
            className={className}
            style={style}
            role="img"
            aria-hidden="true"
        >
            <circle cx="16" cy="16" r="16" fill="currentColor" />
            <g fill="var(--background)">
                <rect x="10" y="8.5" width="12" height="3" rx="0.6" />
                <rect x="13.5" y="8.5" width="5" height="15" rx="0.6" />
                <rect x="10" y="20.5" width="12" height="3" rx="0.6" />
            </g>
        </svg>
    );
}

/**
 * 강의 본문 가로 폭(CourseMaxWidth) 한 곳 — 선택 옵션·Tailwind 클래스 매핑의 단일 출처.
 *
 * 빌더(설정), 플레이어(학생 보기), 미리보기가 모두 이 매핑을 쓴다. Tailwind JIT가
 * 클래스를 생성하려면 소스에 리터럴 문자열이 그대로 보여야 하므로, 동적 조합 대신
 * 아래처럼 완성된 클래스명을 박아 둔다. 8xl은 Tailwind 기본에 없어 globals.css의
 * @theme에 --container-8xl을 추가해 활성화했다.
 */

import type { CourseMaxWidth } from "./types";

/** 본문 폭의 기본값(미설정·기존 강의 호환). */
export const DEFAULT_COURSE_MAX_WIDTH: CourseMaxWidth = "3xl";

/** 선택 가능한 폭 값들(좁은 → 넓은 순). 빌더 셀렉트와 검증에 쓴다. */
export const COURSE_MAX_WIDTHS: readonly CourseMaxWidth[] = [
    "3xl",
    "4xl",
    "5xl",
    "6xl",
    "7xl",
    "8xl",
];

/** 셀렉트에 보여 줄 한국어 라벨(대략 폭 감각을 함께 표기). */
export const COURSE_MAX_WIDTH_LABEL: Record<CourseMaxWidth, string> = {
    "3xl": "좁게 (3xl · 기본)",
    "4xl": "조금 넓게 (4xl)",
    "5xl": "넓게 (5xl)",
    "6xl": "더 넓게 (6xl)",
    "7xl": "아주 넓게 (7xl)",
    "8xl": "최대 (8xl)",
};

/** 폭 값 → Tailwind max-w 클래스(리터럴이라 JIT가 인식). */
const COURSE_MAX_WIDTH_CLASS: Record<CourseMaxWidth, string> = {
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    "8xl": "max-w-8xl",
};

/** 강의 본문 폭에 해당하는 max-w 클래스를 돌려준다(미설정이면 기본 3xl). */
export function courseMaxWidthClass(width?: CourseMaxWidth): string {
    return COURSE_MAX_WIDTH_CLASS[width ?? DEFAULT_COURSE_MAX_WIDTH];
}

/** 임의 값이 유효한 CourseMaxWidth면 그대로, 아니면 undefined(=기본). 역직렬화 검증용. */
export function asCourseMaxWidth(v: unknown): CourseMaxWidth | undefined {
    return COURSE_MAX_WIDTHS.includes(v as CourseMaxWidth)
        ? (v as CourseMaxWidth)
        : undefined;
}

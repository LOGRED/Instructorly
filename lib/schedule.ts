/**
 * 강좌 수업 일정 계산 유틸 — 시작일/종료일 + 수업 요일로 실제 수업 날짜를 뽑는다.
 * 외부 날짜 라이브러리 없이 네이티브 Date만 쓰며, 날짜는 항상 "YYYY-MM-DD"
 * 문자열로 다뤄 타임존 오프셋으로 인한 하루 밀림을 피한다.
 */

/** 요일 라벨 (인덱스 = JS getDay 값, 0=일 … 6=토). */
export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 요일 토글 UI 표시 순서 — 한국 관례대로 월요일부터 일요일까지의 getDay 값. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** 단일 수업 날짜 한 건 — 날짜 문자열과 그 날의 요일 번호. */
export interface SessionDate {
    date: string; // "YYYY-MM-DD"
    weekday: number; // 0=일 … 6=토
}

/** "YYYY-MM-DD" 문자열을 로컬 자정 Date로 파싱한다. 형식이 틀리면 null. */
export function parseLocalDate(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const [, y, mo, d] = m;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    // 윤년/말일 등 비정상 값이 자동 보정되며 어긋나는지 검증.
    if (
        date.getFullYear() !== Number(y) ||
        date.getMonth() !== Number(mo) - 1 ||
        date.getDate() !== Number(d)
    ) {
        return null;
    }
    return date;
}

/** Date를 "YYYY-MM-DD" 문자열로 포맷한다(로컬 기준). */
export function formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
}

/** 기준 날짜에 n일을 더한 새 Date를 반환한다. */
function addDays(base: Date, n: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
}

/**
 * 1주차(시작일부터 7일 창: 시작일 ~ 시작일+6) 안에서 선택한 수업 요일에
 * 해당하는 날짜들을 날짜 오름차순으로 반환한다. endDate가 주어지면 그 이후
 * 날짜는 제외한다. 시작일이 비었거나 요일 선택이 없으면 빈 배열.
 */
export function firstWeekSessions(
    startDate: string | null,
    weekDays: number[],
    endDate?: string | null,
): SessionDate[] {
    if (!startDate || weekDays.length === 0) return [];
    const start = parseLocalDate(startDate);
    if (!start) return [];
    const end = endDate ? parseLocalDate(endDate) : null;
    const wanted = new Set(weekDays);
    const out: SessionDate[] = [];
    for (let i = 0; i < 7; i++) {
        const day = addDays(start, i);
        if (!wanted.has(day.getDay())) continue;
        if (end && day.getTime() > end.getTime()) continue;
        out.push({ date: formatLocalDate(day), weekday: day.getDay() });
    }
    return out;
}

/** "YYYY-MM-DD"를 "3월 4일 (수)" 형태의 한국어 표시 문자열로 바꾼다. */
export function formatKoreanDate(s: string): string {
    const d = parseLocalDate(s);
    if (!d) return s;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_LABELS[d.getDay()]})`;
}

/** Date를 "4월 7일"처럼 월·일만 한국어로 표시한다(요일 없음). */
function monthDayOf(d: Date): string {
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** "YYYY-MM-DD"를 "4월 7일"처럼 월·일만 표시한다(요일 없음). */
export function formatMonthDay(s: string): string {
    const d = parseLocalDate(s);
    if (!d) return s;
    return monthDayOf(d);
}

/**
 * 주차 번호(1부터)의 수업 기간을 "4월 7일 ~ 4월 13일"로 반환한다. 시작일 기준
 * (weekNo-1)*7일 뒤가 그 주차의 시작이고 +6일이 끝이다. endDate가 있고 그 주차
 * 안에서 강좌가 끝나면 끝 날짜를 종료일로 자른다. 시작일이 없으면 빈 문자열.
 */
export function weekDateRange(
    startDate: string | null,
    weekNo: number,
    endDate?: string | null,
): string {
    if (!startDate || weekNo < 1) return "";
    const start = parseLocalDate(startDate);
    if (!start) return "";
    const weekStart = addDays(start, (weekNo - 1) * 7);
    let weekEnd = addDays(weekStart, 6);
    const end = endDate ? parseLocalDate(endDate) : null;
    if (
        end &&
        weekStart.getTime() <= end.getTime() &&
        weekEnd.getTime() > end.getTime()
    ) {
        weekEnd = end;
    }
    return `${monthDayOf(weekStart)} ~ ${monthDayOf(weekEnd)}`;
}

/** 시작일/종료일을 "4월 7일 ~ 6월 30일"처럼 월·일 한국어 범위로 표시한다.
 *  한쪽만 있으면 그 부분만, 둘 다 없으면 빈 문자열을 반환한다. */
export function formatPeriodKorean(
    startDate: string | null,
    endDate: string | null,
): string {
    const s = startDate ? formatMonthDay(startDate) : "";
    const e = endDate ? formatMonthDay(endDate) : "";
    if (s && e) return `${s} ~ ${e}`;
    if (s) return `${s} ~`;
    if (e) return `~ ${e}`;
    return "";
}

/** 수업 요일 번호 배열을 "월·수·금" 처럼 월요일부터 정렬된 라벨 문자열로 바꾼다. */
export function formatWeekDays(weekDays: number[]): string {
    return WEEKDAY_ORDER.filter((d) => weekDays.includes(d))
        .map((d) => WEEKDAY_LABELS[d])
        .join("·");
}

/** 시작일/종료일을 "2026-03-04 ~ 2026-05-30" 형태로 표시한다. 한쪽만 있으면
 *  그 부분만, 둘 다 없으면 빈 문자열을 반환한다. */
export function formatPeriod(
    startDate: string | null,
    endDate: string | null,
): string {
    if (startDate && endDate) return `${startDate} ~ ${endDate}`;
    if (startDate) return `${startDate} ~`;
    if (endDate) return `~ ${endDate}`;
    return "";
}

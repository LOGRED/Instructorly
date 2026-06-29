/**
 * 강좌 일정 표시 — 수업 기간·요일과 1주차 수업 날짜를 읽기 전용으로 보여준다.
 * 강좌 상세 페이지(full)와 목록 카드(compact)에서 함께 쓴다. 일정이 전혀
 * 설정되지 않았으면 아무것도 렌더하지 않는다.
 */
"use client";

import { CalendarRange, CalendarCheck } from "lucide-react";

import {
    firstWeekSessions,
    formatKoreanDate,
    formatPeriod,
    formatWeekDays,
} from "@/lib/schedule";

interface ProgramScheduleProps {
    startDate: string | null;
    endDate: string | null;
    weekDays: number[];
    /** true면 카드용 축약(기간·요일 한 줄만), false면 상세용(1주차 날짜까지). */
    compact?: boolean;
}

export function ProgramSchedule({
    startDate,
    endDate,
    weekDays,
    compact = false,
}: ProgramScheduleProps) {
    const hasPeriod = Boolean(startDate || endDate);
    const hasDays = weekDays.length > 0;
    if (!hasPeriod && !hasDays) return null;

    const period = formatPeriod(startDate, endDate);
    const days = formatWeekDays(weekDays);
    const firstWeek = firstWeekSessions(startDate, weekDays, endDate);

    // 카드용 축약: 기간·요일만 한 줄로.
    if (compact) {
        return (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {period && (
                    <span className="inline-flex items-center gap-1">
                        <CalendarRange className="size-3" />
                        {period}
                    </span>
                )}
                {hasDays && (
                    <span className="inline-flex items-center gap-1">
                        <CalendarCheck className="size-3" />
                        매주 {days}
                    </span>
                )}
            </div>
        );
    }

    // 상세용: 기간·요일 + 1주차 수업 날짜 칩.
    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {period && (
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarRange className="size-4 text-muted-foreground" />
                        <span className="font-medium">수업 기간</span>
                        <span className="text-muted-foreground">{period}</span>
                    </span>
                )}
                {hasDays && (
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarCheck className="size-4 text-muted-foreground" />
                        <span className="font-medium">수업 요일</span>
                        <span className="text-muted-foreground">매주 {days}</span>
                    </span>
                )}
            </div>

            {firstWeek.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">1주차</span>
                    {firstWeek.map((s) => (
                        <span
                            key={s.date}
                            className="rounded-md bg-background px-2 py-1 text-sm shadow-sm"
                        >
                            {formatKoreanDate(s.date)}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

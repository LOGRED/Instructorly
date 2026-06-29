/**
 * 진행률 대시보드 — 학생용(본인 진행률)과 강사용(수강생 전체 요약)을 각각 내보낸다.
 */
"use client";

import type { LessonProgress, Enrollment } from "@/lib/types";
import {
    Progress,
    ProgressLabel,
    ProgressValue,
} from "@/components/ui/progress";

// ── 학생용 대시보드 ──────────────────────────────────────────
interface StudentProgressDashboardProps {
    progress: LessonProgress[];
    totalLessonCount: number;
}

export function StudentProgressDashboard({
    progress,
    totalLessonCount,
}: StudentProgressDashboardProps) {
    const completedCount = progress.filter((p) => p.completed).length;
    const overallPct =
        totalLessonCount > 0
            ? Math.round((completedCount / totalLessonCount) * 100)
            : 0;

    return (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <h3 className="font-semibold text-base">내 수강 현황</h3>

            {/* 전체 진행률 크게 */}
            <div className="flex flex-col gap-1.5">
                <Progress value={overallPct} className="gap-2">
                    <ProgressLabel className="text-sm font-medium">강좌 전체 진행률</ProgressLabel>
                    <ProgressValue className="text-sm tabular-nums">{() => `${overallPct}%`}</ProgressValue>
                </Progress>
                <p className="text-xs text-muted-foreground">
                    전체 {totalLessonCount}강의 중 {completedCount}강의 완료
                </p>
            </div>
        </div>
    );
}

// ── 강사용 대시보드 ──────────────────────────────────────────
interface InstructorProgressDashboardProps {
    enrollments: Enrollment[];
    progress: LessonProgress[];
    totalLessonCount: number;
}

export function InstructorProgressDashboard({
    enrollments,
    progress,
    totalLessonCount,
}: InstructorProgressDashboardProps) {
    const studentCount = enrollments.length;

    // 전체 완료 강의 합산 / (수강생 * 총 강의) → 전체 평균 진행률
    const totalCompleted = progress.filter((p) => p.completed).length;
    const maxPossible = studentCount * totalLessonCount;
    const overallPct =
        maxPossible > 0 ? Math.round((totalCompleted / maxPossible) * 100) : 0;

    // 수강생 전원이 최소 1강의라도 완료한 수
    const activeStudents = new Set(
        progress.filter((p) => p.completed).map((p) => p.userId)
    ).size;

    return (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <h3 className="font-semibold text-base">수강 현황 요약</h3>

            <div className="grid grid-cols-3 gap-4 text-center">
                <div className="flex flex-col gap-0.5">
                    <span className="text-2xl font-bold tabular-nums">{studentCount}</span>
                    <span className="text-xs text-muted-foreground">수강생</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-2xl font-bold tabular-nums">{activeStudents}</span>
                    <span className="text-xs text-muted-foreground">학습 중</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-2xl font-bold tabular-nums">{overallPct}%</span>
                    <span className="text-xs text-muted-foreground">평균 진행률</span>
                </div>
            </div>

            <Progress value={overallPct} className="gap-1.5">
                <ProgressLabel className="text-xs text-muted-foreground">
                    전체 평균 진행률
                </ProgressLabel>
                <ProgressValue className="text-xs">{() => `${overallPct}%`}</ProgressValue>
            </Progress>
        </div>
    );
}

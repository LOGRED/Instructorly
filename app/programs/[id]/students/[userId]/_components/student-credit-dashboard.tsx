/**
 * 수강생 크레딧 대시보드 — 이 강좌에서 수강생이 사용한 총 크레딧, 강의 진행 현황,
 * 강의별 AI 작품 목록을 한눈에 보여 주는 강사 전용 뷰.
 */
"use client";

import type { Enrollment, LessonProgress, StudentBlockWork } from "@/lib/types";
import { avatarSrc } from "@/lib/avatars";
import { formatCredits, formatKrw, creditsToKrw } from "@/lib/credits";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { workTotalCredits } from "./work-credit-card";
import { LessonCreditSection } from "./lesson-credit-section";

interface StudentCreditDashboardProps {
    enrollment: Enrollment;
    /** 이 강좌에 속한 강의 id 목록(프로그램 순서 기준). */
    programLessonIds: string[];
    /** lessonId → 강의 제목 맵. */
    lessonTitleMap: Map<string, string>;
    /** 이 수강생의 이 강좌 진행 기록 목록. */
    progress: LessonProgress[];
    /** 이 수강생의 이 강좌 내 작품 목록(lessonId 필터 완료). */
    works: StudentBlockWork[];
    /** 강좌 전체 강의 수(분모에 쓴다). */
    totalLessonCount: number;
}

// 수강생 크레딧 대시보드 컴포넌트 — 헤더(아바타·이름), 요약 통계, 강의별 섹션 목록을 렌더한다.
export function StudentCreditDashboard({
    enrollment,
    programLessonIds,
    lessonTitleMap,
    progress,
    works,
    totalLessonCount,
}: StudentCreditDashboardProps) {
    const firstChar = enrollment.name ? enrollment.name.charAt(0) : "?";

    // 총 크레딧
    const totalCredits = works.reduce((sum, w) => sum + workTotalCredits(w), 0);

    // 들은 강의 수: 진행 기록이 있거나 작품이 있는 강의
    const activeLessonIds = new Set([
        ...progress.map((p) => p.lessonId),
        ...works.map((w) => w.lessonId),
    ]);
    const activeLessonCount = activeLessonIds.size;

    // 만든 작품 수(결과 있는 것만)
    const workCount = works.filter((w) => w.current.result != null).length;

    return (
        <div className="flex flex-col gap-8">
            {/* 수강생 헤더 */}
            <div className="flex items-center gap-4">
                <Avatar size="lg">
                    {avatarSrc(enrollment.avatar) && (
                        <AvatarImage src={avatarSrc(enrollment.avatar)!} alt="" />
                    )}
                    <AvatarFallback>{firstChar}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xl font-bold">{enrollment.name}</span>
                        <Badge variant="outline" className="text-xs">이 강좌 기준</Badge>
                    </div>
                    <span className="mono text-sm text-muted-foreground">@{enrollment.userId}</span>
                </div>
            </div>

            {/* 요약 통계 */}
            <div className="grid grid-cols-3 gap-3 rounded-xl border bg-card p-5">
                <StatBlock
                    value={
                        <span>
                            {formatCredits(totalCredits)}
                            <span className="ml-1 text-base font-normal text-muted-foreground">
                                ({formatKrw(creditsToKrw(totalCredits))})
                            </span>
                        </span>
                    }
                    label="총 사용 크레딧"
                />
                <StatBlock
                    value={`${activeLessonCount} / ${totalLessonCount}`}
                    label="들은 강의"
                />
                <StatBlock
                    value={String(workCount)}
                    label="만든 작품"
                />
            </div>

            {/* 강의별 섹션 목록 */}
            <div className="flex flex-col gap-4">
                <span className="eyebrow text-xs">강의별 작품 · 크레딧</span>
                {programLessonIds.map((lessonId) => {
                    const lessonProgress = progress.find((p) => p.lessonId === lessonId);
                    const lessonWorks = works.filter((w) => w.lessonId === lessonId);
                    const title = lessonTitleMap.get(lessonId) ?? lessonId;
                    return (
                        <LessonCreditSection
                            key={lessonId}
                            lessonId={lessonId}
                            lessonTitle={title}
                            progress={lessonProgress}
                            works={lessonWorks}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// 요약 통계 블록 — 수치와 라벨을 세로로 쌓는다.
function StatBlock({
    value,
    label,
}: {
    value: React.ReactNode;
    label: string;
}) {
    return (
        <div className="flex flex-col items-center gap-0.5 text-center">
            <span className="text-2xl font-bold tabular-nums">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}

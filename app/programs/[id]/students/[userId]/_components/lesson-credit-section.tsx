/**
 * 강의별 크레딧 섹션 — 수강생의 한 강의 진행률, 크레딧 소계, 작품 목록을 묶어 보여 준다.
 */
"use client";

import type { LessonProgress, StudentBlockWork } from "@/lib/types";
import { formatCredits, formatKrw, creditsToKrw } from "@/lib/credits";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { WorkCreditCard, workTotalCredits } from "./work-credit-card";

interface LessonCreditSectionProps {
    lessonId: string;
    lessonTitle: string;
    progress: LessonProgress | undefined;
    works: StudentBlockWork[];
}

// 강의별 크레딧 섹션 컴포넌트 — 진행률, 크레딧 소계, 작품 카드 목록을 렌더한다.
export function LessonCreditSection({
    lessonId,
    lessonTitle,
    progress,
    works,
}: LessonCreditSectionProps) {
    // 진행률 계산
    const pct =
        progress && progress.totalPages > 0
            ? Math.round(((progress.maxPageReached + 1) / progress.totalPages) * 100)
            : 0;

    // 결과가 있는(실제로 만든) 작품만 — 프롬프트만 입력하고 생성 안 한 빈 작업은 제외
    const resultWorks = works.filter((w) => w.current.result != null || w.history.length > 0);

    // 이 강의의 크레딧 소계
    const subtotalCredits = resultWorks.reduce((sum, w) => sum + workTotalCredits(w), 0);

    // 결과 있는 작품 수
    const workCount = resultWorks.length;

    const hasAnyActivity = !!progress || resultWorks.length > 0;

    return (
        <div
            className={`flex flex-col gap-4 rounded-xl border p-5 ${
                hasAnyActivity ? "bg-card" : "bg-muted/30 opacity-60"
            }`}
        >
            {/* 강의 헤더 */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{lessonTitle}</span>
                    <span className="mono text-xs text-muted-foreground">{lessonId}</span>
                </div>
                <div className="flex items-center gap-4 text-sm shrink-0">
                    {subtotalCredits > 0 && (
                        <span className="tabular-nums font-medium">
                            {formatCredits(subtotalCredits)} 크레딧
                            <span className="text-muted-foreground ml-1">
                                ({formatKrw(creditsToKrw(subtotalCredits))})
                            </span>
                        </span>
                    )}
                    {workCount > 0 && (
                        <span className="text-muted-foreground">작품 {workCount}개</span>
                    )}
                </div>
            </div>

            {/* 진행률 */}
            {progress ? (
                <Progress value={pct}>
                    <ProgressLabel className="text-xs text-muted-foreground">
                        {progress.maxPageReached + 1} / {progress.totalPages} 페이지
                    </ProgressLabel>
                    <ProgressValue className="text-xs">{() => `${pct}%`}</ProgressValue>
                </Progress>
            ) : (
                <p className="text-sm text-muted-foreground">미참여</p>
            )}

            {/* 작품 목록 */}
            {resultWorks.length > 0 && (
                <>
                    <Separator />
                    <div className="flex flex-col gap-3">
                        {resultWorks.map((work) => (
                            <WorkCreditCard
                                key={`${work.userId}-${work.blockId}`}
                                work={work}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

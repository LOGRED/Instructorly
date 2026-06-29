/**
 * 수강생 작업 섹션 — 한 명의 수강생 아바타·진행률·AI 블럭 작업 목록을 카드 형태로 표시한다.
 */
"use client";

import { UserCircle } from "lucide-react";

import type { Enrollment, LessonProgress, StudentBlockWork } from "@/lib/types";
import { avatarSrc } from "@/lib/avatars";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Progress,
    ProgressLabel,
    ProgressValue,
} from "@/components/ui/progress";
import { BlockWorkCard } from "./block-work-card";

interface StudentWorkSectionProps {
    enrollment: Enrollment;
    progress: LessonProgress | undefined;
    works: StudentBlockWork[];
}

export function StudentWorkSection({
    enrollment,
    progress,
    works,
}: StudentWorkSectionProps) {
    const firstChar = enrollment.name ? enrollment.name.charAt(0) : "?";

    // 진행률 계산
    const pct =
        progress && progress.totalPages > 0
            ? Math.round(((progress.maxPageReached + 1) / progress.totalPages) * 100)
            : 0;

    return (
        <section className="flex flex-col gap-6 rounded-xl border bg-card p-6">
            {/* 학생 헤더 */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                    <Avatar size="lg">
                        {avatarSrc(enrollment.avatar) && (
                            <AvatarImage src={avatarSrc(enrollment.avatar)!} alt="" />
                        )}
                        <AvatarFallback>{firstChar}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-lg font-semibold">{enrollment.name}</span>
                        <span className="mono text-sm text-muted-foreground">
                            @{enrollment.userId}
                        </span>
                    </div>
                </div>

                {/* 완료 배지 */}
                {progress?.completed && (
                    <Badge variant="default" className="w-fit text-sm">
                        강의 완료
                    </Badge>
                )}
            </div>

            {/* 진행률 바 */}
            <div className="flex flex-col gap-1.5">
                <span className="eyebrow text-xs">강의 진행률</span>
                {progress ? (
                    <Progress value={pct}>
                        <ProgressLabel>
                            {progress.maxPageReached + 1} / {progress.totalPages} 페이지
                        </ProgressLabel>
                        <ProgressValue>{() => `${pct}%`}</ProgressValue>
                    </Progress>
                ) : (
                    <p className="text-sm text-muted-foreground">진행 기록 없음</p>
                )}
            </div>

            <Separator />

            {/* AI 블럭 작업 목록 */}
            <div className="flex flex-col gap-3">
                <span className="eyebrow text-xs">AI 블럭 작업</span>

                {works.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed p-6 text-muted-foreground">
                        <UserCircle className="size-5 shrink-0" />
                        <span className="text-base">아직 생성 기록 없음</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {works.map((work) => (
                            <BlockWorkCard key={`${work.userId}-${work.blockId}`} work={work} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

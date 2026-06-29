/**
 * 수강생 크레딧 대시보드 페이지 — 강사가 특정 수강생의 이 강좌 내 크레딧 사용,
 * 강의 진행, AI 작품을 한눈에 확인하는 강사 전용 페이지.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";

import type { Program, Enrollment, LessonProgress, StudentBlockWork } from "@/lib/types";
import type { CourseSummary } from "@/lib/types";
import { getProgram, getRoster, getAllMyWork, listCourses } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StudentCreditDashboard } from "./_components/student-credit-dashboard";

interface PageData {
    program: Program;
    enrollment: Enrollment;
    progress: LessonProgress[];
    works: StudentBlockWork[];
    programLessonIds: string[];
    lessonTitleMap: Map<string, string>;
}

// 수강생 크레딧 대시보드 페이지 컴포넌트 — 데이터 로드 및 강사 권한 가드.
export default function StudentCreditPage() {
    const params = useParams<{ id: string; userId: string }>();
    const programId = params.id;
    const userId = params.userId;

    const hydrated = useIdentity((s) => s.hydrated);
    const role = useIdentity((s) => s.role);

    const [data, setData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 페이지 데이터를 병렬로 불러온다.
    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [program, roster, allWorks, courses] = await Promise.all([
                getProgram(programId),
                getRoster(programId),
                getAllMyWork(userId),
                listCourses(),
            ]);

            // 강좌 순서대로 강의 id 목록 추출
            const programLessonIds = program.weeks.flatMap((w) =>
                w.items.filter((i) => i.type === "lesson").map((i) => i.id)
            );

            // lessonId → 제목 맵 구성
            const lessonTitleMap = new Map<string, string>(
                courses.map((c: CourseSummary) => [c.id, c.title])
            );

            // 이 수강생의 등록 정보
            const enrollment = roster.enrollments.find((e) => e.userId === userId);
            if (!enrollment) {
                throw new Error("이 강좌의 수강생이 아닙니다.");
            }

            // 이 수강생의 이 강좌 진행 기록
            const progress = roster.progress.filter((p) => p.userId === userId);

            // 이 수강생의 이 강좌 작품만 필터
            const programLessonSet = new Set(programLessonIds);
            const works = allWorks.filter((w) => programLessonSet.has(w.lessonId));

            setData({
                program,
                enrollment,
                progress,
                works,
                programLessonIds,
                lessonTitleMap,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [programId, userId]);

    useEffect(() => {
        if (!hydrated) return;
        load();
    }, [hydrated, load]);

    // hydration 대기
    if (!hydrated) {
        return (
            <>
                <SiteHeader />
                <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
                    <div className="flex flex-col gap-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-48 rounded-xl" />
                        ))}
                    </div>
                </main>
            </>
        );
    }

    // 강사 아닌 경우 접근 차단
    if (role !== "instructor") {
        return (
            <>
                <SiteHeader />
                <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
                    <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed py-24 text-center">
                        <Users className="size-12 text-muted-foreground" />
                        <div className="flex flex-col gap-2">
                            <p className="text-xl font-semibold">강사만 접근할 수 있습니다.</p>
                            <p className="text-base text-muted-foreground">
                                이 페이지는 강사 권한이 필요합니다.
                            </p>
                        </div>
                        <Button render={<Link href={`/programs/${programId}`} />} variant="outline">
                            강좌로 돌아가기
                        </Button>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <SiteHeader />

            <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
                {/* 상단: 뒤로가기 + 제목 */}
                <div className="mb-8 flex flex-col gap-4">
                    <Button
                        render={<Link href={`/programs/${programId}`} />}
                        variant="ghost"
                        className="w-fit -ml-2 gap-1.5 text-muted-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        강좌로 돌아가기
                    </Button>

                    <div className="flex flex-col gap-1">
                        <span className="eyebrow">수강생 크레딧</span>
                        <h1 className="text-3xl font-bold">
                            {data?.enrollment.name ?? (loading ? "" : "수강생")}
                        </h1>
                        {data?.program && (
                            <p className="text-base text-muted-foreground">{data.program.title}</p>
                        )}
                    </div>
                </div>

                {/* 로딩 스켈레톤 */}
                {loading && (
                    <div className="flex flex-col gap-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-48 rounded-xl" />
                        ))}
                    </div>
                )}

                {/* 에러 상태 */}
                {!loading && error && (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
                        <p className="text-lg text-muted-foreground">{error}</p>
                        <Button onClick={load} variant="outline">
                            다시 시도
                        </Button>
                    </div>
                )}

                {/* 대시보드 본문 */}
                {!loading && !error && data && (
                    <StudentCreditDashboard
                        enrollment={data.enrollment}
                        programLessonIds={data.programLessonIds}
                        lessonTitleMap={data.lessonTitleMap}
                        progress={data.progress}
                        works={data.works}
                        totalLessonCount={data.programLessonIds.length}
                    />
                )}
            </main>
        </>
    );
}

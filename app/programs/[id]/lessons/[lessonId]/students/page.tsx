/**
 * 수강생 작업·진행 페이지 — 강사가 특정 강의에서 각 수강생의 AI 블럭 작업과 진행률을 확인한다.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";

import type { Program, Course, Enrollment, LessonProgress, StudentBlockWork } from "@/lib/types";
import { getProgram, getCourse, getRoster, getLessonWork } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StudentWorkBrowser } from "./_components/student-work-browser";

interface PageData {
    program: Program;
    course: Course;
    enrollments: Enrollment[];
    progress: LessonProgress[];
    work: StudentBlockWork[];
}

export default function StudentWorkPage() {
    const params = useParams<{ id: string; lessonId: string }>();
    const programId = params.id;
    const lessonId = params.lessonId;

    const hydrated = useIdentity((s) => s.hydrated);
    const role = useIdentity((s) => s.role);

    const [data, setData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [program, course, roster, work] = await Promise.all([
                getProgram(programId),
                getCourse(lessonId),
                getRoster(programId),
                getLessonWork(lessonId),
            ]);
            setData({
                program,
                course,
                enrollments: roster.enrollments,
                progress: roster.progress,
                work,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [programId, lessonId]);

    useEffect(() => {
        if (!hydrated) return;
        load();
    }, [hydrated, load]);

    // hydration 대기
    if (!hydrated) {
        return (
            <>
                <SiteHeader />
                <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
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
                <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
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

            <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
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
                        <span className="eyebrow">수강생 작업·진행</span>
                        <h1 className="text-3xl font-bold">
                            {data?.course.title ?? (loading ? "" : "강의")}
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
                            <Skeleton key={i} className="h-64 rounded-xl" />
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

                {/* 수강생 없음 */}
                {!loading && !error && data && data.enrollments.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
                        <Users className="size-10 text-muted-foreground" />
                        <p className="text-lg text-muted-foreground">등록된 수강생이 없습니다.</p>
                    </div>
                )}

                {/* 수강생 작업 브라우저 (마스터-디테일 + 검색·정렬) */}
                {!loading && !error && data && data.enrollments.length > 0 && (
                    <StudentWorkBrowser
                        enrollments={data.enrollments}
                        progress={data.progress}
                        work={data.work}
                        lessonId={lessonId}
                    />
                )}
            </main>
        </>
    );
}

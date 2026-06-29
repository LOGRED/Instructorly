/**
 * 강좌 상세 페이지 — 주차별 강의 목록, 수강생 명단, 진행률 대시보드를 보여주는 클라이언트 컴포넌트.
 * 강사는 주차·항목을 관리하고 수강생을 등록할 수 있으며, 학생은 학습 링크와 본인 진행률을 확인한다.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, User } from "lucide-react";
import { toast } from "sonner";

import {
    getProgram,
    saveProgram,
    getRoster,
    getStudentProgress,
    getProgramProgress,
    getCourse,
    getPost,
    getAnnouncement,
    getDrill,
} from "@/lib/api";
import type { Program, Enrollment, LessonProgress, Week, WeekItem, WeekItemType, LlmProvider } from "@/lib/types";
import { useIdentity } from "@/lib/identity";
import { newId } from "@/lib/id";
import { copyText } from "@/lib/clipboard";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { WeekSection } from "./_components/week-section";
import { WeekJumpNav, weekAnchorId } from "./_components/week-jump-nav";
import { RosterPanel } from "./_components/roster-panel";
import { EnrollDialog } from "./_components/enroll-dialog";
import {
    StudentProgressDashboard,
    InstructorProgressDashboard,
} from "./_components/progress-dashboard";
import { EditProgramDialog } from "../_components/edit-program-dialog";
import { formatPeriodKorean, formatWeekDays } from "@/lib/schedule";

interface ItemMeta {
    id: string;
    type: WeekItemType;
    title: string;
    pageCount?: number;
    /** 시험·연습 전용 — 선택한 LLM(브랜드 로고 표시용). */
    provider?: LlmProvider;
}

export default function ProgramDetailPage() {
    const { id } = useParams<{ id: string }>();

    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);
    const role = useIdentity((s) => s.role);
    const hydrated = useIdentity((s) => s.hydrated);

    const [program, setProgram] = useState<Program | null>(null);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [allProgress, setAllProgress] = useState<LessonProgress[]>([]);
    const [studentProgress, setStudentProgress] = useState<LessonProgress[]>([]);
    const [lessonMetas, setLessonMetas] = useState<Map<string, ItemMeta>>(new Map());
    const [loading, setLoading] = useState(true);

    // 모든 아이템 수집
    function collectItems(weeks: Week[]): WeekItem[] {
        return weeks.flatMap((w) => w.items);
    }

    // 강의 ID만 수집 (진행률 집계용)
    function collectLessonIds(weeks: Week[]): string[] {
        return weeks.flatMap((w) => w.items.filter((i) => i.type === "lesson").map((i) => i.id));
    }

    // 아이템 메타 일괄 로드 (강의 + 게시물 + 공지사항)
    const loadLessonMetas = useCallback(async (items: WeekItem[]) => {
        const entries = await Promise.all(
            items.map(async (item): Promise<[string, ItemMeta]> => {
                try {
                    if (item.type === "lesson") {
                        const course = await getCourse(item.id);
                        return [item.id, { id: item.id, type: item.type, title: course.title, pageCount: course.pages.length }];
                    } else if (item.type === "post") {
                        const post = await getPost(item.id);
                        return [item.id, { id: item.id, type: item.type, title: post.title }];
                    } else if (item.type === "announcement") {
                        const announcement = await getAnnouncement(item.id);
                        return [item.id, { id: item.id, type: item.type, title: announcement.title }];
                    } else {
                        // 시험·연습(exam/practice)
                        const drill = await getDrill(item.id);
                        return [item.id, { id: item.id, type: item.type, title: drill.title, provider: drill.provider }];
                    }
                } catch {
                    return [item.id, { id: item.id, type: item.type, title: "제목 없음" }];
                }
            })
        );
        return new Map<string, ItemMeta>(entries);
    }, []);

    const load = useCallback(async () => {
        if (!hydrated || !userId || !role) return;
        setLoading(true);
        try {
            const [prog] = await Promise.all([getProgram(id)]);
            setProgram(prog);

            const items = collectItems(prog.weeks);
            const metas = await loadLessonMetas(items);
            setLessonMetas(metas);

            if (role === "instructor") {
                const [roster, progProgress] = await Promise.all([
                    getRoster(id),
                    getProgramProgress(id),
                ]);
                setEnrollments(roster.enrollments);
                setAllProgress(progProgress);
            } else {
                const myProg = await getStudentProgress(userId, id);
                setStudentProgress(myProg);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "강좌를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [hydrated, userId, role, id, loadLessonMetas]);

    useEffect(() => {
        load();
    }, [load]);

    function handleProgramSaved(updated: Program) {
        setProgram(updated);
        // 새로 추가된 아이템 메타도 로드 (강의 + 게시물 + 공지사항)
        const newItems = collectItems(updated.weeks).filter(
            (item) => !lessonMetas.has(item.id)
        );
        if (newItems.length > 0) {
            loadLessonMetas(newItems).then((newMetas) => {
                setLessonMetas((prev) => new Map([...prev, ...newMetas]));
            });
        }
    }

    async function handleAddWeek() {
        if (!program) return;
        const nextNo =
            program.weeks.reduce((max, w) => Math.max(max, w.weekNo), 0) + 1;
        const newWeek: Week = {
            id: newId(),
            weekNo: nextNo,
            title: `${nextNo}주차`,
            items: [],
            lessonIds: [],
        };
        try {
            const updated = await saveProgram({
                ...program,
                weeks: [...program.weeks, newWeek],
            });
            setProgram(updated);
            toast.success("주차가 추가되었습니다.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "주차 추가에 실패했습니다.");
        }
    }

    async function handleCopyInvite() {
        if (!program) return;
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const text = `${program.title}(${program.inviteCode})\n${origin}/join/${program.inviteCode}`;
        if (await copyText(text)) {
            toast.success("초대 링크가 복사되었습니다.");
        } else {
            toast.error("복사에 실패했습니다.");
        }
    }

    const totalLessonCount = program ? collectLessonIds(program.weeks).length : 0;

    // ── 로딩 ──────────────────────────────────────────────────
    if (loading || !hydrated) {
        return (
            <>
                <SiteHeader />
                <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col gap-6">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                </main>
            </>
        );
    }

    if (!program) {
        return (
            <>
                <SiteHeader />
                <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
                    <p className="text-muted-foreground">강좌를 찾을 수 없습니다.</p>
                </main>
            </>
        );
    }

    return (
        <>
            <SiteHeader />

            <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col gap-8">
                {/* 강좌 목록으로 — 브라우저 뒤로가기(router.back) 대신 명시적 경로로 이동 */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 self-start"
                    render={<Link href="/programs" />}
                >
                    <ArrowLeft />
                    강좌 목록
                </Button>

                {/* 헤더 */}
                <div className="flex flex-col gap-2">
                    <span className="eyebrow inline-flex items-center gap-1">
                        <User className="size-3" />
                        {program.ownerName}
                    </span>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold">{program.title}</h1>
                        {role === "instructor" && (
                            <EditProgramDialog
                                programId={program.id}
                                initialTitle={program.title}
                                initialDescription={program.description}
                                initialStartDate={program.startDate}
                                initialEndDate={program.endDate}
                                initialWeekDays={program.weekDays}
                                onSaved={handleProgramSaved}
                            />
                        )}
                    </div>
                    {program.description && (
                        <p className="text-muted-foreground text-base">{program.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="secondary">{program.weeks.length}주차</Badge>
                        <Badge variant="secondary">{totalLessonCount}강의</Badge>
                        {role === "instructor" && (
                            <Badge variant="secondary">{enrollments.length}명</Badge>
                        )}
                        {formatPeriodKorean(program.startDate, program.endDate) && (
                            <Badge variant="secondary">
                                {formatPeriodKorean(program.startDate, program.endDate)}
                            </Badge>
                        )}
                        {program.weekDays.length > 0 && (
                            <Badge variant="secondary">
                                매주 {formatWeekDays(program.weekDays)}
                            </Badge>
                        )}
                    </div>

                    {/* 초대 링크 복사 — 강사만 노출 */}
                    {role === "instructor" && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 self-start gap-1.5 font-normal"
                            onClick={handleCopyInvite}
                            aria-label="초대 링크 복사"
                        >
                            <Copy className="size-3.5" />
                            <span className="truncate max-w-[16rem]">
                                {program.title}
                                <span className="mono text-muted-foreground"> ({program.inviteCode})</span>
                            </span>
                        </Button>
                    )}
                </div>

                <Separator />

                {/* 진행률 대시보드 */}
                {role === "student" && (
                    <StudentProgressDashboard
                        progress={studentProgress}
                        totalLessonCount={totalLessonCount}
                    />
                )}
                {role === "instructor" && (
                    <InstructorProgressDashboard
                        enrollments={enrollments}
                        progress={allProgress}
                        totalLessonCount={totalLessonCount}
                    />
                )}

                {/* 탭: 강의 / 수강생(강사) */}
                <Tabs defaultValue="lessons">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <TabsList>
                            <TabsTrigger value="lessons">주차별 강의</TabsTrigger>
                            {role === "instructor" && (
                                <TabsTrigger value="roster">수강생 명단</TabsTrigger>
                            )}
                        </TabsList>

                        {role === "instructor" && (
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleAddWeek}>
                                    주차 추가
                                </Button>
                                <EnrollDialog
                                    programId={program.id}
                                    programTitle={program.title}
                                    inviteCode={program.inviteCode}
                                    onEnrolled={load}
                                />
                            </div>
                        )}
                    </div>

                    {/* 강의 탭 */}
                    <TabsContent value="lessons">
                        {program.weeks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
                                <p className="text-muted-foreground">아직 주차가 없습니다.</p>
                                {role === "instructor" && (
                                    <Button variant="outline" onClick={handleAddWeek}>
                                        첫 주차 추가
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-10">
                                {/* 주차 빠른 이동 칩 바 — 주차 목록 위에 고정되어 1·2주차로 바로 점프 */}
                                <WeekJumpNav weeks={program.weeks} />
                                {program.weeks.map((week) => (
                                    <div
                                        key={week.id}
                                        id={weekAnchorId(week.weekNo)}
                                        data-week-no={week.weekNo}
                                        className="scroll-mt-32"
                                    >
                                        <WeekSection
                                            week={week}
                                            lessonMetas={lessonMetas}
                                            program={program}
                                            programId={program.id}
                                            role={role}
                                            userId={userId}
                                            nickname={nickname}
                                            studentProgress={studentProgress}
                                            allProgress={allProgress}
                                            studentCount={enrollments.length}
                                            onProgramSaved={handleProgramSaved}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* 수강생 탭 — 강사 전용 */}
                    {role === "instructor" && (
                        <TabsContent value="roster">
                            <RosterPanel
                                programId={program.id}
                                enrollments={enrollments}
                                progress={allProgress}
                                totalLessonCount={totalLessonCount}
                                onChanged={load}
                            />
                        </TabsContent>
                    )}
                </Tabs>
            </main>
        </>
    );
}

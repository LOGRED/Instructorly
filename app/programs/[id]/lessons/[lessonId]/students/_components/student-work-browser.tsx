/**
 * 수강생 작업 브라우저 — 마스터-디테일 레이아웃으로 수강생 목록(검색·정렬)과 선택된 수강생의 작업 상세를 함께 표시한다.
 */
"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, CheckCircle2, Search, Users } from "lucide-react";

import type { Enrollment, LessonProgress, StudentBlockWork } from "@/lib/types";
import { cn } from "@/lib/utils";
import { avatarSrc } from "@/lib/avatars";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StudentWorkSection } from "./student-work-section";

type SortKey = "pct-desc" | "pct-asc" | "name" | "work-desc";

const SORT_LABELS: Record<SortKey, string> = {
    "pct-desc": "진행률 높은순",
    "pct-asc": "진행률 낮은순",
    name: "이름순",
    "work-desc": "작업 많은순",
};

interface StudentRow {
    enrollment: Enrollment;
    progress: LessonProgress | undefined;
    works: StudentBlockWork[];
    pct: number;
    started: boolean;
    completed: boolean;
}

interface StudentWorkBrowserProps {
    enrollments: Enrollment[];
    progress: LessonProgress[];
    work: StudentBlockWork[];
    lessonId: string;
}

export function StudentWorkBrowser({
    enrollments,
    progress,
    work,
    lessonId,
}: StudentWorkBrowserProps) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<SortKey>("pct-desc");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // 학생별 행 데이터 (진행률·작업 묶음)
    const rows = useMemo<StudentRow[]>(() => {
        return enrollments.map((enrollment) => {
            const p = progress.find(
                (pr) => pr.userId === enrollment.userId && pr.lessonId === lessonId
            );
            const works = work.filter((w) => w.userId === enrollment.userId);
            const pct =
                p && p.totalPages > 0
                    ? Math.round(((p.maxPageReached + 1) / p.totalPages) * 100)
                    : 0;
            return {
                enrollment,
                progress: p,
                works,
                pct,
                started: !!p,
                completed: !!p?.completed,
            };
        });
    }, [enrollments, progress, work, lessonId]);

    // 상단 요약 통계
    const summary = useMemo(() => {
        const total = rows.length;
        const learning = rows.filter((r) => r.started && !r.completed).length;
        const avg =
            total > 0
                ? Math.round(rows.reduce((acc, r) => acc + r.pct, 0) / total)
                : 0;
        return { total, learning, avg };
    }, [rows]);

    // 검색 + 정렬
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = q
            ? rows.filter(
                    (r) =>
                        r.enrollment.name.toLowerCase().includes(q) ||
                        r.enrollment.userId.toLowerCase().includes(q)
                )
            : rows.slice();

        const byName = (a: StudentRow, b: StudentRow) =>
            a.enrollment.name.localeCompare(b.enrollment.name, "ko");

        list.sort((a, b) => {
            switch (sort) {
                case "pct-asc":
                    return a.pct - b.pct || byName(a, b);
                case "name":
                    return byName(a, b);
                case "work-desc":
                    return b.works.length - a.works.length || b.pct - a.pct || byName(a, b);
                case "pct-desc":
                default:
                    return b.pct - a.pct || byName(a, b);
            }
        });
        return list;
    }, [rows, query, sort]);

    // 선택된 학생 — 명시 선택이 필터에서 빠지면 목록 첫 번째로 폴백
    const selected =
        filtered.find((r) => r.enrollment.userId === selectedId) ??
        filtered[0] ??
        null;

    return (
        <div className="flex flex-col gap-6">
            {/* 요약 통계 */}
            <div className="grid grid-cols-3 gap-3 rounded-xl border bg-card p-5">
                <Stat value={summary.total} label="수강생" />
                <Stat value={summary.learning} label="학습 중" />
                <Stat value={`${summary.avg}%`} label="평균 진행률" />
            </div>

            {/* 마스터-디테일 */}
            <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr] lg:items-start">
                {/* ── 마스터: 수강생 목록 ── */}
                <div className="flex flex-col gap-3 lg:sticky lg:top-20">
                    {/* 검색 + 정렬 */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="이름·아이디 검색"
                                aria-label="수강생 검색"
                                className="pl-8"
                            />
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 shrink-0 gap-1.5"
                                    >
                                        <ArrowDownUp className="size-3.5" />
                                        <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
                                    </Button>
                                }
                            />
                            <DropdownMenuContent align="end">
                                <DropdownMenuRadioGroup
                                    value={sort}
                                    onValueChange={(v) => setSort(v as SortKey)}
                                >
                                    {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                                        <DropdownMenuRadioItem key={key} value={key}>
                                            {SORT_LABELS[key]}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* 학생 행 목록 */}
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                            <Users className="size-6" />
                            검색 결과가 없습니다.
                        </div>
                    ) : (
                        <ScrollArea className="h-[22rem] lg:h-[calc(100dvh-13rem)]">
                            <div className="flex flex-col gap-1.5 pr-2.5">
                                {filtered.map((row) => (
                                    <StudentRowButton
                                        key={row.enrollment.userId}
                                        row={row}
                                        active={
                                            selected?.enrollment.userId === row.enrollment.userId
                                        }
                                        onSelect={() => setSelectedId(row.enrollment.userId)}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    )}

                    <p className="px-1 text-xs text-muted-foreground">
                        {filtered.length}명 표시
                        {query && ` (전체 ${rows.length}명)`}
                    </p>
                </div>

                {/* ── 디테일: 선택된 학생 작업 ── */}
                <div className="min-w-0">
                    {selected ? (
                        <StudentWorkSection
                            key={selected.enrollment.userId}
                            enrollment={selected.enrollment}
                            progress={selected.progress}
                            works={selected.works}
                        />
                    ) : (
                        <div className="flex items-center justify-center rounded-xl border border-dashed py-24 text-center text-muted-foreground">
                            수강생을 선택하세요.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ value, label }: { value: string | number; label: string }) {
    return (
        <div className="flex flex-col items-center gap-0.5 text-center">
            <span className="text-2xl font-bold tabular-nums">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}

interface StudentRowButtonProps {
    row: StudentRow;
    active: boolean;
    onSelect: () => void;
}

function StudentRowButton({ row, active, onSelect }: StudentRowButtonProps) {
    const { enrollment, pct, completed, started, works } = row;
    const firstChar = enrollment.name ? enrollment.name.charAt(0) : "?";

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={active}
            className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "bg-card hover:bg-muted/50"
            )}
        >
            <Avatar size="sm">
                {avatarSrc(enrollment.avatar) && (
                    <AvatarImage src={avatarSrc(enrollment.avatar)!} alt="" />
                )}
                <AvatarFallback>{firstChar}</AvatarFallback>
            </Avatar>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                {/* 이름 + 완료 + 진행률 % */}
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{enrollment.name}</span>
                    {completed && (
                        <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                    )}
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                        {started ? `${pct}%` : "미시작"}
                    </span>
                </div>

                {/* 진행률 바 */}
                <Progress value={pct} />

                {/* 아이디 + 작업 수 */}
                <div className="flex items-center gap-1.5">
                    <span className="mono truncate text-xs text-muted-foreground">
                        @{enrollment.userId}
                    </span>
                    {works.length > 0 && (
                        <Badge
                            variant="outline"
                            className="ml-auto shrink-0 px-1.5 py-0 text-[10px]"
                        >
                            작업 {works.length}
                        </Badge>
                    )}
                </div>
            </div>
        </button>
    );
}

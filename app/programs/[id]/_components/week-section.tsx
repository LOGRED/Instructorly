/**
 * 주차 섹션 — 한 주차의 항목(강의/게시물/공지/시험/연습) 목록을 렌더링한다.
 * 사용자 설정의 cardStyle(솔리드 타일·모노 미니멀·커버·콤팩트)에 따라 카드 모양을 바꿔 렌더한다.
 * - compact: 가로 한 줄 레이아웃(SortableWeekItem).
 * - minimal·tile·cover: 카드 그리드(한 줄에 여러 장) — 타입 색 신호만 다르게.
 * 강사는 모든 모양에서 드래그로 항목 순서를 바꿀 수 있다.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import {
    BookOpen,
    Eye,
    Users,
    CheckCircle2,
    Circle,
    FileText,
    Megaphone,
    GripVertical,
    GraduationCap,
    Dumbbell,
    Feather,
    ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    arrayMove,
    verticalListSortingStrategy,
    rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Week, LessonProgress, Role, WeekItem, WeekItemType, LlmProvider, AtelierGenre } from "@/lib/types";
import { genreMeta } from "@/lib/atelier-templates";
import { saveProgram } from "@/lib/api";
import { PROVIDERS } from "@/lib/llm-clones";
import { ProviderLogo } from "@/components/provider-logo";
import { weekDateRange } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Progress,
    ProgressLabel,
    ProgressValue,
} from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AddLessonDialog } from "./add-lesson-dialog";
import { AddPostDialog } from "./add-post-dialog";
import { AddAnnouncementDialog } from "./add-announcement-dialog";
import { AddDrillDialog } from "./add-drill-dialog";
import { AddAtelierDialog } from "./add-atelier-dialog";
import { WeekActions } from "./week-actions";
import { ItemActions } from "./item-actions";
import type { Program } from "@/lib/types";
import { usePrefs, type CardStyle } from "@/lib/store";

interface ItemMeta {
    id: string;
    type: WeekItemType;
    title: string;
    pageCount?: number;
    /** 시험·연습 전용 — 선택한 LLM(브랜드 로고 표시용). */
    provider?: LlmProvider;
    /** 실습(atelier) 전용 — 장르(배지 라벨 "시 실습" 등에 쓴다). */
    genre?: AtelierGenre;
    /** 실습(atelier) 전용 — 시작 템플릿 id. 있으면 배지에 장르를 표기하고, 없으면 그냥 "실습". */
    templateId?: string;
}

interface WeekSectionProps {
    week: Week;
    lessonMetas: Map<string, ItemMeta>;
    program: Program;
    programId: string;
    role: Role | null;
    userId: string | null;
    nickname: string | null;
    // 학생: 본인 진행
    studentProgress: LessonProgress[];
    // 강사: 전체 진행
    allProgress: LessonProgress[];
    studentCount: number;
    onProgramSaved: (updated: Program) => void;
}

// 항목 타입에 맞는 아이콘 컴포넌트를 반환한다.
function itemIcon(type: WeekItemType) {
    if (type === "lesson") return BookOpen;
    if (type === "post") return FileText;
    if (type === "announcement") return Megaphone;
    if (type === "exam") return GraduationCap;
    if (type === "atelier") return Feather;
    return Dumbbell; // practice
}

// 항목 타입을 사용자가 읽기 쉬운 한국어 라벨로 변환한다.
function itemTypeLabel(type: WeekItemType): string {
    if (type === "lesson") return "강의";
    if (type === "post") return "게시물";
    if (type === "announcement") return "공지";
    if (type === "exam") return "시험";
    if (type === "atelier") return "실습";
    return "연습"; // practice
}

// 항목 배지 라벨 — 실습(atelier)은 시작 템플릿으로 만들었으면 장르를 앞에 붙인다("시 실습"). 빈 작품에서 시작했으면 그냥 "실습".
function itemBadgeLabel(type: WeekItemType, meta: ItemMeta | undefined): string {
    if (type === "atelier" && meta?.templateId && meta.genre) {
        return `${genreMeta(meta.genre).label} 실습`;
    }
    return itemTypeLabel(type);
}

// 항목 타입별 색상 클래스(아이콘 블록 배경/글자, 타입 배지)를 반환한다 — 종류를 한눈에 구분하기 위함.
function itemTypeStyle(type: WeekItemType): { iconBg: string; iconText: string; badge: string } {
    switch (type) {
        case "lesson": // 강의 — 파랑
            return {
                iconBg: "bg-blue-100 dark:bg-blue-500/15",
                iconText: "text-blue-600 dark:text-blue-400",
                badge: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
            };
        case "post": // 게시물 — 청록
            return {
                iconBg: "bg-teal-100 dark:bg-teal-500/15",
                iconText: "text-teal-600 dark:text-teal-400",
                badge: "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
            };
        case "announcement": // 공지 — 주황(주의 환기)
            return {
                iconBg: "bg-amber-100 dark:bg-amber-500/15",
                iconText: "text-amber-600 dark:text-amber-400",
                badge: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
            };
        case "exam": // 시험 — 보라
            return {
                iconBg: "bg-violet-100 dark:bg-violet-500/15",
                iconText: "text-violet-600 dark:text-violet-400",
                badge: "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
            };
        case "atelier": // 실습(창작) — 로즈
            return {
                iconBg: "bg-rose-100 dark:bg-rose-500/15",
                iconText: "text-rose-600 dark:text-rose-400",
                badge: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
            };
        default: // 연습 — 초록
            return {
                iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
                iconText: "text-emerald-600 dark:text-emerald-400",
                badge: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
            };
    }
}

// 항목 타입별 카드 색 팔레트 — 솔리드 타일(solid)·연한 배경(tint)·강조 텍스트(text)·점(dot). 카드 모양별 색 신호에 쓴다.
function itemTypeColor(type: WeekItemType): { solid: string; tint: string; text: string; dot: string } {
    switch (type) {
        case "lesson":
            return { solid: "bg-blue-600", tint: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" };
        case "post":
            return { solid: "bg-teal-600", tint: "bg-teal-50 dark:bg-teal-500/10", text: "text-teal-700 dark:text-teal-300", dot: "bg-teal-500" };
        case "announcement":
            return { solid: "bg-amber-600", tint: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" };
        case "exam":
            return { solid: "bg-violet-600", tint: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" };
        case "atelier":
            return { solid: "bg-rose-600", tint: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" };
        default:
            return { solid: "bg-emerald-600", tint: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" };
    }
}

/** 테이블 모드 전용: 드래그로 순서를 바꿀 수 있는 주차 항목 래퍼 */
// 드래그로 순서를 바꿀 수 있는 주차 항목 래퍼 — 좌측에 잡는 막대(핸들)를 둔다.
function SortableWeekItem({
    id,
    dragEnabled,
    children,
}: {
    id: string;
    dragEnabled: boolean;
    children: React.ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, disabled: !dragEnabled });

    const style = {
        // 이동(translate)만 적용 — 행 높이 차이로 인한 찌그러짐(scale)을 막는다.
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-stretch gap-1 overflow-hidden rounded-lg border bg-card transition-shadow",
                isDragging && "shadow-lg ring-1 ring-ring/50",
            )}
        >
            {dragEnabled && (
                <button
                    type="button"
                    className="flex shrink-0 cursor-grab touch-none select-none items-center justify-center self-stretch bg-muted/40 px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
                    aria-label="드래그하여 순서 이동"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" />
                </button>
            )}
            <div
                className={cn(
                    "flex min-w-0 flex-1 flex-col gap-2 py-3 pr-4",
                    dragEnabled ? "pl-1" : "pl-4",
                )}
            >
                {children}
            </div>
        </div>
    );
}

/** 카드 모드 전용: 드래그 가능한 세로 카드 래퍼 */
// 카드 모드에서 드래그 정렬을 지원하는 카드 컨테이너 — 핸들은 카드 우측 상단에 배치한다.
function SortableCard({
    id,
    dragEnabled,
    cardStyle,
    children,
}: {
    id: string;
    dragEnabled: boolean;
    cardStyle: CardStyle;
    children: React.ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, disabled: !dragEnabled });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative h-full overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md",
                cardStyle !== "cover" && "p-5",
                isDragging && "shadow-lg ring-1 ring-ring/50",
            )}
        >
            {/* 강사 전용 드래그 핸들 — 카드 우측 상단에 절대 배치 */}
            {dragEnabled && (
                <button
                    type="button"
                    className="absolute right-3 top-3 z-10 flex cursor-grab touch-none select-none items-center justify-center rounded-md bg-background/70 p-1 text-muted-foreground backdrop-blur transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
                    aria-label="드래그하여 순서 이동"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" />
                </button>
            )}
            {children}
        </div>
    );
}

/** 카드 모드 전용(minimal·tile): 타입 신호 + 제목 + LLM 칩 헤더 블록 */
// 카드 상단에 타입 신호(모노 미니멀=점, 솔리드 타일=색 아이콘), 타입 라벨, 제목, LLM 칩을 렌더링한다.
function CardHeader({
    item,
    meta,
    itemTitle,
    canReorder,
    cardStyle,
}: {
    item: WeekItem;
    meta: ItemMeta | undefined;
    itemTitle: string;
    canReorder: boolean;
    cardStyle: CardStyle;
}) {
    const Icon = itemIcon(item.type);
    const typeLabel = itemBadgeLabel(item.type, meta);
    const color = itemTypeColor(item.type);

    // 시험·연습 LLM 칩(두 모양 공용).
    const llmChip =
        (item.type === "exam" || item.type === "practice") && meta?.provider ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                <ProviderLogo provider={meta.provider} className="size-3" />
                {PROVIDERS[meta.provider].name}
            </span>
        ) : null;

    // 모노 미니멀 — 색을 점 하나로 줄이고 라벨·제목은 무채색.
    if (cardStyle === "minimal") {
        return (
            <div className={cn("flex flex-col gap-1.5", canReorder && "pr-8")}>
                <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", color.dot)} />
                    <span className="eyebrow">{typeLabel}</span>
                </span>
                <span className="text-lg font-semibold leading-snug">{itemTitle}</span>
                {llmChip}
            </div>
        );
    }

    // 솔리드 타일 — 타입 색을 채운 사각 아이콘 블록 + 색 라벨.
    return (
        <div className={cn("flex items-start gap-4", canReorder && "pr-8")}>
            <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-white", color.solid)}>
                <Icon className="size-6" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
                <span className={cn("eyebrow", color.text)}>{typeLabel}</span>
                <span className="text-lg font-semibold leading-snug">{itemTitle}</span>
                {llmChip}
            </div>
        </div>
    );
}

/** 카드 모드 전용: 강의 진행 상태 표시 블록 */
// 카드 모드에서 강의 진행률(학생 본인 또는 강사 집계)을 렌더링한다.
function CardProgress({
    role,
    myProgress,
    myPct,
    completedCount,
    studentCount,
    avgPct,
}: {
    role: Role | null;
    myProgress: LessonProgress | undefined;
    myPct: number;
    completedCount: number;
    studentCount: number;
    avgPct: number;
}) {
    if (role === "student") {
        return (
            <div className="flex items-center gap-3">
                {myProgress?.completed ? (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-sm px-3 py-1">
                        <CheckCircle2 className="size-4" />
                        완료
                    </Badge>
                ) : (
                    <Badge variant="outline" className="shrink-0 gap-1 text-sm px-3 py-1">
                        <Circle className="size-4" />
                        미완료
                    </Badge>
                )}
                <Progress value={myPct} className="flex-1 flex-nowrap items-center gap-2 h-2.5">
                    <ProgressLabel className="sr-only">진행률</ProgressLabel>
                    <ProgressValue className="order-last ml-0 shrink-0 text-sm font-medium">{() => `${myPct}%`}</ProgressValue>
                </Progress>
            </div>
        );
    }

    if (role === "instructor") {
        return (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" />
                    {completedCount}/{studentCount}명 완료
                </span>
                <span>평균 {avgPct}%</span>
            </div>
        );
    }

    return null;
}

/** 카드 모드 전용: 학생용 꽉 찬 큰 액션 버튼 */
// 학생 카드 하단에 하나의 꽉 찬 큰 버튼을 렌더링한다.
function StudentCardAction({
    item,
    programId,
}: {
    item: WeekItem;
    programId: string;
}) {
    if (item.type === "lesson") {
        return (
            <Button
                size="lg"
                className="w-full h-12 text-base"
                render={<Link href={`/learn/${item.id}?program=${programId}`} />}
            >
                학습하기
            </Button>
        );
    }
    if (item.type === "post") {
        return (
            <Button
                size="lg"
                className="w-full h-12 text-base"
                render={<Link href={`/posts/${item.id}?program=${programId}`} />}
            >
                보기
            </Button>
        );
    }
    if (item.type === "announcement") {
        return (
            <Button
                size="lg"
                className="w-full h-12 text-base"
                render={<Link href={`/announcements/${item.id}?program=${programId}`} />}
            >
                보기
            </Button>
        );
    }
    if (item.type === "atelier") {
        return (
            <Button
                size="lg"
                className="w-full h-12 text-base"
                render={<Link href={`/atelier/${item.id}`} />}
            >
                만들기
            </Button>
        );
    }
    // exam | practice
    return (
        <Button
            size="lg"
            className="w-full h-12 text-base"
            render={<Link href={`/drill/${item.id}`} />}
        >
            {item.type === "exam" ? "시험보기" : "연습하기"}
        </Button>
    );
}

/** 카드 모드 전용: 강사용 액션 버튼 묶음 */
// 강사 카드 하단에 보기/수강생/미리보기 버튼과 ItemActions 메뉴를 렌더링한다.
function InstructorCardActions({
    item,
    program,
    weekId,
    itemTitle,
    programId,
    onProgramSaved,
}: {
    item: WeekItem;
    program: Program;
    weekId: string;
    itemTitle: string;
    programId: string;
    onProgramSaved: (updated: Program) => void;
}) {
    if (item.type === "lesson") {
        return (
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/learn/${item.id}?program=${programId}`} />}
                >
                    <Eye className="size-3.5" />
                    보기
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/programs/${programId}/lessons/${item.id}/students`} />}
                >
                    <Users className="size-3.5" />
                    수강생
                </Button>
                <ItemActions
                    program={program}
                    weekId={weekId}
                    item={item}
                    title={itemTitle}
                    editHref={`/build/${item.id}`}
                    onSaved={onProgramSaved}
                />
            </div>
        );
    }
    if (item.type === "post") {
        return (
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/posts/${item.id}?program=${programId}`} />}
                >
                    <Eye className="size-3.5" />
                    보기
                </Button>
                <ItemActions
                    program={program}
                    weekId={weekId}
                    item={item}
                    title={itemTitle}
                    editHref={`/posts/${item.id}/edit`}
                    onSaved={onProgramSaved}
                />
            </div>
        );
    }
    if (item.type === "announcement") {
        return (
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/announcements/${item.id}?program=${programId}`} />}
                >
                    <Eye className="size-3.5" />
                    보기
                </Button>
                <ItemActions
                    program={program}
                    weekId={weekId}
                    item={item}
                    title={itemTitle}
                    editHref={`/announcements/${item.id}/edit`}
                    onSaved={onProgramSaved}
                />
            </div>
        );
    }
    if (item.type === "atelier") {
        return (
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/atelier/${item.id}`} />}
                >
                    <Eye className="size-3.5" />
                    시범 편집
                </Button>
                <ItemActions
                    program={program}
                    weekId={weekId}
                    item={item}
                    title={itemTitle}
                    onSaved={onProgramSaved}
                />
            </div>
        );
    }
    // exam | practice
    return (
        <div className="flex flex-wrap gap-2">
            <Button
                variant="outline"
                size="sm"
                render={<Link href={`/drill/${item.id}`} />}
            >
                <Eye className="size-3.5" />
                미리보기
            </Button>
            <ItemActions
                program={program}
                weekId={weekId}
                item={item}
                title={itemTitle}
                onSaved={onProgramSaved}
            />
        </div>
    );
}

/** 타입 그룹 정렬 순서 — 공지를 맨 위(중요 알림)에 두고 강의·게시물·시험·연습 순. */
const GROUP_ORDER: WeekItemType[] = ["announcement", "lesson", "post", "exam", "practice", "atelier"];

// week.items를 타입별 그룹으로 묶어 GROUP_ORDER 순서로 반환한다(빈 그룹 제외).
function groupByType(items: WeekItem[]): { type: WeekItemType; items: WeekItem[] }[] {
    return GROUP_ORDER
        .map((type) => ({ type, items: items.filter((i) => i.type === type) }))
        .filter((g) => g.items.length > 0);
}

// 같은 타입 그룹 안에서만 순서를 바꾼 새 week.items 배열을 만든다(타입 간 이동 없음).
function reorderWithinType(
    items: WeekItem[],
    type: WeekItemType,
    activeId: string,
    overId: string,
): WeekItem[] | null {
    const group = items.filter((i) => i.type === type);
    const from = group.findIndex((i) => i.id === activeId);
    const to = group.findIndex((i) => i.id === overId);
    if (from < 0 || to < 0) return null;
    const newGroup = arrayMove(group, from, to);
    let qi = 0;
    // 원본 순서를 유지하면서 해당 타입 슬롯만 재정렬된 항목으로 채운다.
    return items.map((i) => (i.type === type ? newGroup[qi++] : i));
}

// 타입 구분 없이 주차 전체 항목의 순서를 바꾼 새 배열을 만든다(콘텐츠별 묶기 OFF용).
function reorderFlat(items: WeekItem[], activeId: string, overId: string): WeekItem[] | null {
    const from = items.findIndex((i) => i.id === activeId);
    const to = items.findIndex((i) => i.id === overId);
    if (from < 0 || to < 0) return null;
    return arrayMove(items, from, to);
}

// 강의 항목의 진행률 통계(학생 본인 진행 + 강사 집계)를 계산한다.
function lessonStats(
    item: WeekItem,
    studentProgress: LessonProgress[],
    allProgress: LessonProgress[],
    studentCount: number,
) {
    const myProgress = item.type === "lesson"
        ? studentProgress.find((p) => p.lessonId === item.id)
        : undefined;
    // 완료한 강의는 항상 100%, 진행 중이면 도달 페이지 기준 환산.
    const myPct = myProgress?.completed
        ? 100
        : myProgress && myProgress.totalPages > 0
            ? Math.round((myProgress.maxPageReached / myProgress.totalPages) * 100)
            : 0;
    const lessonAll = item.type === "lesson"
        ? allProgress.filter((p) => p.lessonId === item.id)
        : [];
    const completedCount = lessonAll.filter((p) => p.completed).length;
    const avgPct =
        studentCount > 0 && lessonAll.length > 0
            ? Math.round(
                    lessonAll.reduce((acc, p) =>
                        p.totalPages > 0
                            ? acc + (p.maxPageReached / p.totalPages) * 100
                            : acc,
                        0
                    ) / studentCount
                )
            : 0;
    return { myProgress, myPct, completedCount, avgPct };
}

interface ItemViewProps {
    item: WeekItem;
    lessonMetas: Map<string, ItemMeta>;
    role: Role | null;
    studentProgress: LessonProgress[];
    allProgress: LessonProgress[];
    studentCount: number;
    program: Program;
    programId: string;
    weekId: string;
    onProgramSaved: (updated: Program) => void;
    canReorder: boolean;
}

// 테이블 모드 한 줄 항목 — 타입별 색상 아이콘·배지, 진행률, 역할별 액션을 렌더링한다.
function TableItem({
    item,
    lessonMetas,
    role,
    studentProgress,
    allProgress,
    studentCount,
    program,
    programId,
    weekId,
    onProgramSaved,
    canReorder,
}: ItemViewProps) {
    const meta = lessonMetas.get(item.id);
    const itemTitle = meta?.title ?? "제목 없음";
    const Icon = itemIcon(item.type);
    const typeStyle = itemTypeStyle(item.type);
    const typeLabel = itemBadgeLabel(item.type, meta);
    const color = itemTypeColor(item.type);
    const { myProgress, myPct, completedCount, avgPct } = lessonStats(
        item, studentProgress, allProgress, studentCount,
    );

    return (
        <SortableWeekItem id={item.id} dragEnabled={canReorder}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", color.tint)}>
                        <Icon className={cn("size-4", color.text)} />
                    </div>
                    <Badge variant="secondary" className={cn("shrink-0 text-xs", typeStyle.badge)}>
                        {typeLabel}
                    </Badge>
                    <span className="min-w-0 truncate font-medium">{itemTitle}</span>
                    {/* 시험·연습: 선택한 LLM 브랜드를 한눈에 — 로고 + 이름 칩 */}
                    {(item.type === "exam" || item.type === "practice") && meta?.provider && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            <ProviderLogo provider={meta.provider} className="size-3" />
                            {PROVIDERS[meta.provider].name}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {/* 강의 액션 — 강사: 보기·수강생·더보기(편집/삭제) / 학생: 학습하기 */}
                    {item.type === "lesson" && (
                        role === "instructor" ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    render={<Link href={`/learn/${item.id}?program=${programId}`} />}
                                >
                                    <Eye className="size-3.5" />
                                    보기
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    render={<Link href={`/programs/${programId}/lessons/${item.id}/students`} />}
                                >
                                    <Users className="size-3.5" />
                                    수강생
                                </Button>
                                <ItemActions
                                    program={program}
                                    weekId={weekId}
                                    item={item}
                                    title={itemTitle}
                                    editHref={`/build/${item.id}`}
                                    onSaved={onProgramSaved}
                                />
                            </>
                        ) : (
                            <Button
                                size="lg"
                                className="min-w-24"
                                render={<Link href={`/learn/${item.id}?program=${programId}`} />}
                            >
                                학습하기
                            </Button>
                        )
                    )}

                    {/* 게시물 액션 — 강사: 보기(outline)·편집/삭제 / 학생: 보기(filled) */}
                    {item.type === "post" && (
                        role === "instructor" ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    render={<Link href={`/posts/${item.id}?program=${programId}`} />}
                                >
                                    <Eye className="size-3.5" />
                                    보기
                                </Button>
                                <ItemActions
                                    program={program}
                                    weekId={weekId}
                                    item={item}
                                    title={itemTitle}
                                    editHref={`/posts/${item.id}/edit`}
                                    onSaved={onProgramSaved}
                                />
                            </>
                        ) : (
                            <Button
                                size="lg"
                                className="min-w-24"
                                render={<Link href={`/posts/${item.id}?program=${programId}`} />}
                            >
                                보기
                            </Button>
                        )
                    )}

                    {/* 공지사항 액션 — 강사: 보기(outline)·편집/삭제 / 학생: 보기(filled) */}
                    {item.type === "announcement" && (
                        role === "instructor" ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    render={<Link href={`/announcements/${item.id}?program=${programId}`} />}
                                >
                                    <Eye className="size-3.5" />
                                    보기
                                </Button>
                                <ItemActions
                                    program={program}
                                    weekId={weekId}
                                    item={item}
                                    title={itemTitle}
                                    editHref={`/announcements/${item.id}/edit`}
                                    onSaved={onProgramSaved}
                                />
                            </>
                        ) : (
                            <Button
                                size="lg"
                                className="min-w-24"
                                render={<Link href={`/announcements/${item.id}?program=${programId}`} />}
                            >
                                보기
                            </Button>
                        )
                    )}

                    {/* 시험·연습 액션 — 강사: 미리보기+삭제 / 학생: 바로 시작 */}
                    {(item.type === "exam" || item.type === "practice") && (
                        role === "instructor" ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    render={<Link href={`/drill/${item.id}`} />}
                                >
                                    <Eye className="size-3.5" />
                                    미리보기
                                </Button>
                                <ItemActions
                                    program={program}
                                    weekId={weekId}
                                    item={item}
                                    title={itemTitle}
                                    onSaved={onProgramSaved}
                                />
                            </>
                        ) : (
                            <Button
                                size="lg"
                                className="min-w-24"
                                render={<Link href={`/drill/${item.id}`} />}
                            >
                                {item.type === "exam" ? "시험보기" : "연습하기"}
                            </Button>
                        )
                    )}

                    {/* 실습(창작) 액션 — 강사: 시범 편집+삭제 / 학생: 만들기 */}
                    {item.type === "atelier" && (
                        role === "instructor" ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    render={<Link href={`/atelier/${item.id}`} />}
                                >
                                    <Eye className="size-3.5" />
                                    시범 편집
                                </Button>
                                <ItemActions
                                    program={program}
                                    weekId={weekId}
                                    item={item}
                                    title={itemTitle}
                                    onSaved={onProgramSaved}
                                />
                            </>
                        ) : (
                            <Button
                                size="lg"
                                className="min-w-24"
                                render={<Link href={`/atelier/${item.id}`} />}
                            >
                                만들기
                            </Button>
                        )
                    )}
                </div>
            </div>

            {/* 강의 전용: 강사 집계 진행률 */}
            {item.type === "lesson" && role === "instructor" && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        {completedCount}/{studentCount}명 완료
                    </span>
                    <span>평균 {avgPct}%</span>
                </div>
            )}

            {/* 강의 전용: 학생 본인 진행 — 뱃지·막대·퍼센트를 한 줄에 세로 가운데 정렬한다. */}
            {item.type === "lesson" && role === "student" && (
                <div className="flex items-center gap-2">
                    {myProgress?.completed ? (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                            <CheckCircle2 className="size-3" />
                            완료
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="shrink-0 gap-1">
                            <Circle className="size-3" />
                            미완료
                        </Badge>
                    )}
                    <Progress value={myPct} className="flex-1 flex-nowrap items-center gap-2">
                        <ProgressLabel className="sr-only">진행률</ProgressLabel>
                        <ProgressValue className="order-last ml-0 shrink-0 text-xs">{() => `${myPct}%`}</ProgressValue>
                    </Progress>
                </div>
            )}
        </SortableWeekItem>
    );
}

// 카드 모드 한 장 항목 — cardStyle(minimal·tile·cover)에 맞춰 타입 색 신호·강의 진행률·역할별 액션을 렌더링한다.
function CardItem({
    item,
    lessonMetas,
    role,
    studentProgress,
    allProgress,
    studentCount,
    program,
    programId,
    weekId,
    onProgramSaved,
    canReorder,
    cardStyle,
}: ItemViewProps & { cardStyle: CardStyle }) {
    const meta = lessonMetas.get(item.id);
    const itemTitle = meta?.title ?? "제목 없음";
    const { myProgress, myPct, completedCount, avgPct } = lessonStats(
        item, studentProgress, allProgress, studentCount,
    );

    // 강의 전용 진행 상태(모든 모양 공용).
    const progress = item.type === "lesson" ? (
        <CardProgress
            role={role}
            myProgress={myProgress}
            myPct={myPct}
            completedCount={completedCount}
            studentCount={studentCount}
            avgPct={avgPct}
        />
    ) : null;

    // 카드 하단 액션(역할별, 모든 모양 공용).
    const actions = role === "student" ? (
        <StudentCardAction item={item} programId={programId} />
    ) : (
        <InstructorCardActions
            item={item}
            program={program}
            weekId={weekId}
            itemTitle={itemTitle}
            programId={programId}
            onProgramSaved={onProgramSaved}
        />
    );

    // 커버 — 상단 색 배너(타입 색 틴트 + 큰 흐린 아이콘 + 타입 알약) 아래로 제목·진행률·액션.
    if (cardStyle === "cover") {
        const Icon = itemIcon(item.type);
        const typeLabel = itemBadgeLabel(item.type, meta);
        const color = itemTypeColor(item.type);
        return (
            <SortableCard id={item.id} dragEnabled={canReorder} cardStyle={cardStyle}>
                <div className="flex h-full flex-col">
                    <div className={cn("relative h-20 shrink-0 overflow-hidden", color.tint)}>
                        <span className={cn("absolute left-4 top-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white", color.solid)}>
                            {typeLabel}
                        </span>
                        <Icon className={cn("absolute -bottom-3 right-3 size-20 opacity-15", color.text)} />
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5">
                        <div className="flex flex-col gap-1">
                            <span className="text-lg font-semibold leading-snug">{itemTitle}</span>
                            {(item.type === "exam" || item.type === "practice") && meta?.provider && (
                                <span className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                                    <ProviderLogo provider={meta.provider} className="size-3" />
                                    {PROVIDERS[meta.provider].name}
                                </span>
                            )}
                        </div>
                        {progress}
                        <div className="mt-auto">{actions}</div>
                    </div>
                </div>
            </SortableCard>
        );
    }

    // 모노 미니멀 · 솔리드 타일 — 헤더(점/색 타일) + 진행률 + 액션.
    return (
        <SortableCard id={item.id} dragEnabled={canReorder} cardStyle={cardStyle}>
            <div className="flex h-full flex-col gap-4">
                <CardHeader
                    item={item}
                    meta={meta}
                    itemTitle={itemTitle}
                    canReorder={canReorder}
                    cardStyle={cardStyle}
                />
                {progress}
                <div className="mt-auto">{actions}</div>
            </div>
        </SortableCard>
    );
}

// 한 타입 그룹의 색상 헤더(아이콘 + 라벨 + 개수 + 구분선) — 클릭 시 그룹을 접고 편다.
function GroupHeader({
    type,
    count,
    open,
    onToggle,
}: {
    type: WeekItemType;
    count: number;
    open: boolean;
    onToggle: () => void;
}) {
    const style = itemTypeStyle(type);
    const Icon = itemIcon(type);
    const label = itemTypeLabel(type);
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-2.5 text-left"
        >
            <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold", style.badge)}>
                <Icon className="size-4" />
                {label}
                <span className="opacity-70">{count}</span>
            </span>
            <Separator className="flex-1" />
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        </button>
    );
}

// 주차 섹션 컴포넌트 — cardStyle에 따라 카드 그리드(minimal·tile·cover) 또는 콤팩트 한 줄로 항목을 렌더링한다.
export function WeekSection({
    week,
    lessonMetas,
    program,
    programId,
    role,
    userId,
    nickname,
    studentProgress,
    allProgress,
    studentCount,
    onProgramSaved,
}: WeekSectionProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    const cardStyle = usePrefs((s) => s.cardStyle);
    // 콤팩트(시안5)는 가로 한 줄, 나머지(minimal·tile·cover)는 카드 그리드.
    const isCompact = cardStyle === "compact";
    // 콘텐츠별 묶기 — 켜면 타입별 그룹, 끄면 한 목록으로 평면 표시.
    const groupByContent = usePrefs((s) => s.groupByContent);

    // 주차 펼침 여부(기본 펼침). 헤더 클릭으로 토글.
    const [weekOpen, setWeekOpen] = useState(true);
    // 접힌 타입 그룹 집합 — 키가 들어 있으면 접힘(기본은 모두 펼침).
    const [collapsedGroups, setCollapsedGroups] = useState<Set<WeekItemType>>(new Set());

    // 한 타입 그룹의 접힘/펼침을 토글한다.
    function toggleGroup(type: WeekItemType) {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    }

    // 드래그가 끝나면 순서를 재배치하고 서버에 저장한다(낙관적 업데이트, 실패 시 롤백). type이 null이면 타입 구분 없이 전체에서 재배치.
    async function handleDragEnd(event: DragEndEvent, type: WeekItemType | null) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const reordered = type === null
            ? reorderFlat(week.items, String(active.id), String(over.id))
            : reorderWithinType(week.items, type, String(active.id), String(over.id));
        if (!reordered) return;

        const updatedWeeks = program.weeks.map((w) =>
            w.id === week.id ? { ...w, items: reordered } : w,
        );
        const optimistic = { ...program, weeks: updatedWeeks };

        // 즉시 화면 반영 — 놓은 자리에 바로 멈춘다.
        onProgramSaved(optimistic);

        try {
            const saved = await saveProgram(optimistic);
            onProgramSaved(saved);
        } catch (err) {
            // 저장 실패 시 원래 순서로 되돌린다.
            onProgramSaved(program);
            toast.error(err instanceof Error ? err.message : "순서 변경에 실패했습니다.");
        }
    }

    const canReorder = role === "instructor";

    // 주차 제목 옆에 표시할 수업 기간 "4월 7일 ~ 4월 13일"(시작일 미설정이면 빈 문자열).
    const range = weekDateRange(program.startDate, week.weekNo, program.endDate);

    // 화면에 그릴 그룹 목록 — 콘텐츠별 묶기 ON이면 타입별 그룹, OFF면 전체를 한 묶음(헤더 없음)으로.
    const renderGroups: { key: string; type: WeekItemType | null; items: WeekItem[]; showHeader: boolean }[] =
        groupByContent
            ? groupByType(week.items).map((g) => ({ key: g.type, type: g.type, items: g.items, showHeader: true }))
            : [{ key: "__all__", type: null, items: week.items, showHeader: false }];

    return (
        <div className="flex flex-col gap-3">
            {/* 주차 헤더 — 진한 필 배지 + 큰 제목 + 하단 굵은 구분선으로 주차 경계를 또렷하게. 클릭 시 주차 전체를 접고 편다. */}
            <div className="flex items-center justify-between gap-2 border-b-2 border-foreground/15 pb-2.5">
                <button
                    type="button"
                    onClick={() => setWeekOpen((o) => !o)}
                    aria-expanded={weekOpen}
                    className="flex min-w-0 items-center gap-3 text-left"
                >
                    <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", !weekOpen && "-rotate-90")} />
                    <span className="inline-flex shrink-0 items-center rounded-lg bg-foreground px-2.5 py-1 text-sm font-bold text-background">
                        {week.weekNo}주차
                    </span>
                    <h3 className="min-w-0 truncate text-xl font-bold">
                        {week.title}
                        {range && (
                            <span className="ml-1.5 text-base font-normal text-muted-foreground">
                                ({range})
                            </span>
                        )}
                    </h3>
                </button>
                {role === "instructor" && (
                    <div className="flex items-center gap-1">
                        {nickname && userId && (
                            <>
                                <AddLessonDialog
                                    program={program}
                                    weekId={week.id}
                                    nickname={nickname}
                                    onSaved={onProgramSaved}
                                />
                                <AddPostDialog
                                    program={program}
                                    weekId={week.id}
                                    userId={userId}
                                    nickname={nickname}
                                    onSaved={onProgramSaved}
                                />
                                <AddAnnouncementDialog
                                    program={program}
                                    weekId={week.id}
                                    userId={userId}
                                    nickname={nickname}
                                    onSaved={onProgramSaved}
                                />
                                <AddDrillDialog
                                    program={program}
                                    weekId={week.id}
                                    userId={userId}
                                    nickname={nickname}
                                    kind="exam"
                                    onSaved={onProgramSaved}
                                />
                                <AddDrillDialog
                                    program={program}
                                    weekId={week.id}
                                    userId={userId}
                                    nickname={nickname}
                                    kind="practice"
                                    onSaved={onProgramSaved}
                                />
                                <AddAtelierDialog
                                    program={program}
                                    weekId={week.id}
                                    userId={userId}
                                    nickname={nickname}
                                    onSaved={onProgramSaved}
                                />
                            </>
                        )}
                        <WeekActions
                            program={program}
                            week={week}
                            onSaved={onProgramSaved}
                        />
                    </div>
                )}
            </div>

            {!weekOpen ? null : week.items.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-1">이 주차에 항목이 없습니다.</p>
            ) : (
                /* ─── 콘텐츠별 묶기 ON: 타입별 색상 헤더로 구분 / OFF: 헤더 없이 한 목록 ─── */
                <div className="flex flex-col gap-6">
                    {renderGroups.map((group) => {
                        const groupOpen = group.showHeader ? !collapsedGroups.has(group.type!) : true;
                        return (
                        <div key={group.key} className="flex flex-col gap-3">
                            {/* 그룹 색상 헤더 + 구분선 — 클릭 시 그룹을 접고 편다 (묶기 OFF면 숨김) */}
                            {group.showHeader && (
                                <GroupHeader
                                    type={group.type!}
                                    count={group.items.length}
                                    open={groupOpen}
                                    onToggle={() => toggleGroup(group.type!)}
                                />
                            )}

                            {/* 그룹 내 드래그 정렬 — 묶기 ON이면 타입 간 이동 차단, OFF면 전체 재배치 */}
                            {groupOpen && (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(e) => handleDragEnd(e, group.type)}
                            >
                                <SortableContext
                                    items={group.items.map((i) => i.id)}
                                    strategy={isCompact ? verticalListSortingStrategy : rectSortingStrategy}
                                >
                                    {isCompact ? (
                                        /* ─── 콤팩트(시안5): 가로 한 줄 레이아웃 ─── */
                                        <div className="flex flex-col gap-2">
                                            {group.items.map((item: WeekItem) => (
                                                <TableItem
                                                    key={item.id}
                                                    item={item}
                                                    lessonMetas={lessonMetas}
                                                    role={role}
                                                    studentProgress={studentProgress}
                                                    allProgress={allProgress}
                                                    studentCount={studentCount}
                                                    program={program}
                                                    programId={programId}
                                                    weekId={week.id}
                                                    onProgramSaved={onProgramSaved}
                                                    canReorder={canReorder}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        /* ─── 카드 그리드(minimal·tile·cover): 한 줄에 여러 장 ─── */
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            {group.items.map((item: WeekItem) => (
                                                <CardItem
                                                    key={item.id}
                                                    item={item}
                                                    lessonMetas={lessonMetas}
                                                    role={role}
                                                    studentProgress={studentProgress}
                                                    allProgress={allProgress}
                                                    studentCount={studentCount}
                                                    program={program}
                                                    programId={programId}
                                                    weekId={week.id}
                                                    onProgramSaved={onProgramSaved}
                                                    canReorder={canReorder}
                                                    cardStyle={cardStyle}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </SortableContext>
                            </DndContext>
                            )}
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

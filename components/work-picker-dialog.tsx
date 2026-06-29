/**
 * 작품 가져오기 다이얼로그 — 자랑방(채팅)에서 📎(첨부)를 누르면 열린다.
 * 두 가지 방법으로 작품을 담는다: (1) 내가 강의에서 만든 AI 작품(그림·영상·음악·글)을
 * 골라서, (2) 내 기기의 파일을 직접 올려서. 고른 작품은 onPick으로 채팅 입력칸의
 * 첨부 목록에 담긴다.
 *
 * 노인 사용자를 위한 UX: 큰 글씨·큰 버튼, 무채색 단순 아이콘, 종류·강의(주차)·기간
 * 필터로 많은 자료에서도 쉽게 찾기, '전체 보기'로 글 전체(마크다운)·그림·영상을 크게 확인.
 */
"use client";

import * as React from "react";
import {
    ArrowLeft,
    Check,
    FileText,
    FolderOpen,
    Image as ImageIcon,
    LayoutGrid,
    Loader2,
    Music,
    Upload,
    Video,
} from "lucide-react";
import { toast } from "sonner";

import { WaveformPlayer } from "@/components/ui/waveform-player";

import { getAllMyWork, listCourses, listPrograms, getProgram } from "@/lib/api";
import {
    WORK_KIND_LABEL,
    workDisplayName,
    workHasResult,
    workToAttachment,
    type WorkKind,
} from "@/lib/works";
import type { ChatAttachment, Role, StudentBlockWork } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Markdown } from "@/components/markdown";

// 작품 종류별 무채색 라인 아이콘(currentColor 상속 — 색 없음).
const KIND_ICON: Record<WorkKind, React.ComponentType<{ className?: string }>> = {
    image: ImageIcon,
    video: Video,
    audio: Music,
    llm: FileText,
};

type TypeFilter = "all" | WorkKind;
const TYPE_FILTERS: { value: TypeFilter; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "all", label: "전체", Icon: LayoutGrid },
    { value: "image", label: "그림", Icon: ImageIcon },
    { value: "video", label: "영상", Icon: Video },
    { value: "audio", label: "음악", Icon: Music },
    { value: "llm", label: "글", Icon: FileText },
];

type DateFilter = "all" | "today" | "7d" | "30d";
const DATE_FILTERS: { value: DateFilter; label: string }[] = [
    { value: "all", label: "전체 기간" },
    { value: "today", label: "오늘" },
    { value: "7d", label: "최근 7일" },
    { value: "30d", label: "최근 30일" },
];

// 강의 메타: lessonId → 주차 번호·강의 제목.
type LessonMeta = { weekNo: number | null; title: string };

// 작품 하나를 유일하게 식별하는 키(강의id + 블럭id).
function workKey(w: StudentBlockWork): string {
    return `${w.lessonId}__${w.blockId}`;
}

// 작품이 만들어진(수정된) 시각.
function workTime(w: StudentBlockWork): number {
    return w.current?.at ?? w.updatedAt ?? 0;
}

// 작품을 사람이 읽기 좋은 날짜 문자열로.
function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

// 기간 필터에 맞는 작품인지 판단한다.
function matchesDate(ts: number, filter: DateFilter): boolean {
    if (filter === "all") return true;
    const day = 86_400_000;
    const now = Date.now();
    if (filter === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return ts >= start.getTime();
    }
    if (filter === "7d") return ts >= now - 7 * day;
    if (filter === "30d") return ts >= now - 30 * day;
    return true;
}

// 강의 표시 이름 — 주차가 있으면 "N주차 · 제목".
function lessonLabel(lessonId: string, meta: Record<string, LessonMeta>): string {
    const m = meta[lessonId];
    const title = m?.title || "강의";
    return m?.weekNo != null ? `${m.weekNo}주차 · ${title}` : title;
}

// 작품 한 칸(썸네일 + 이름 + 전체 보기) — 본문을 누르면 선택/해제, '전체 보기'로 크게 본다.
function WorkTile({
    work,
    selected,
    onToggle,
    onOpen,
    lessonText,
}: {
    work: StudentBlockWork;
    selected: boolean;
    onToggle: () => void;
    onOpen: () => void;
    lessonText: string;
}) {
    const kind = work.blockType as WorkKind;
    const Icon = KIND_ICON[kind];
    const name = workDisplayName(work);
    const result = work.current?.result ?? "";

    return (
        <div
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-card transition-all",
                selected
                    ? "border-primary ring-4 ring-primary/25"
                    : "border-border hover:border-primary/50",
            )}
        >
            {/* 썸네일(누르면 선택) */}
            <button
                type="button"
                onClick={onToggle}
                aria-pressed={selected}
                aria-label={`${WORK_KIND_LABEL[kind]} — ${name}${selected ? " (선택됨)" : ""}`}
                className="relative aspect-square w-full bg-muted text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
            >
                {kind === "image" && result ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result} alt={name} className="h-full w-full object-cover" />
                ) : kind === "video" && result ? (
                    <>
                        <video
                            src={result}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                        />
                        <span className="pointer-events-none absolute inset-0 grid place-items-center">
                            <span className="grid size-12 place-items-center rounded-full bg-foreground/55 text-background">
                                <Video className="size-6" />
                            </span>
                        </span>
                    </>
                ) : kind === "audio" ? (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                        <span className="grid size-16 place-items-center rounded-full bg-foreground/10 text-foreground/70">
                            <Music className="size-8" />
                        </span>
                    </div>
                ) : kind === "llm" ? (
                    <div className="flex h-full w-full flex-col gap-1.5 overflow-hidden bg-muted/60 p-3 text-left">
                        <FileText className="size-5 text-foreground/60" />
                        <p className="line-clamp-5 text-sm leading-snug text-foreground/80">
                            {result}
                        </p>
                    </div>
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-foreground/50">
                        <Icon className="size-10" />
                    </div>
                )}

                {/* 종류 배지(무채색) — 왼쪽 위 */}
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-sm font-medium text-foreground shadow-sm ring-1 ring-foreground/10">
                    <Icon className="size-4" />
                    {WORK_KIND_LABEL[kind]}
                </span>

                {/* 선택 표시 — 오른쪽 위 큰 동그라미 */}
                <span
                    className={cn(
                        "absolute right-2 top-2 grid size-9 place-items-center rounded-full border-2 transition-all",
                        selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-foreground/25 bg-background/80 text-transparent group-hover:border-primary/60",
                    )}
                >
                    <Check className="size-5" strokeWidth={3} />
                </span>
            </button>

            {/* 이름 + 강의 + 전체 보기 */}
            <div className="flex flex-col gap-2 px-3 py-2.5">
                <p className="line-clamp-2 text-base font-medium leading-snug">{name}</p>
                {lessonText && (
                    <p className="truncate text-xs text-muted-foreground">{lessonText}</p>
                )}
                <Button
                    type="button"
                    variant="outline"
                    onClick={onOpen}
                    className="h-10 w-full justify-center gap-1.5 text-sm"
                >
                    <LayoutGrid className="size-4" />
                    전체 보기
                </Button>
            </div>
        </div>
    );
}

// 작품 크게 보기(읽기) 화면 — 글은 마크다운 전체, 그림·영상·음악은 큰 미리보기.
function DetailView({
    work,
    selected,
    onToggle,
    onBack,
    lessonText,
}: {
    work: StudentBlockWork;
    selected: boolean;
    onToggle: () => void;
    onBack: () => void;
    lessonText: string;
}) {
    const kind = work.blockType as WorkKind;
    const Icon = KIND_ICON[kind];
    const name = workDisplayName(work);
    const result = work.current?.result ?? "";

    return (
        <div className="flex flex-col gap-4 py-2">
            <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                className="h-11 w-fit gap-1.5 px-3 text-base"
            >
                <ArrowLeft className="size-5" />
                목록으로
            </Button>

            {/* 제목 + 강의/날짜 */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Icon className="size-4" />
                    {WORK_KIND_LABEL[kind]}
                    {lessonText && <span>· {lessonText}</span>}
                    <span>· {formatDate(workTime(work))}</span>
                </div>
                <h3 className="text-xl font-bold leading-snug">{name}</h3>
            </div>

            {/* 본문(전체) */}
            <div className="rounded-xl border bg-card p-3">
                {kind === "image" && result ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result} alt={name} className="mx-auto max-h-[55vh] w-auto rounded-lg" />
                ) : kind === "video" && result ? (
                    <video src={result} controls className="mx-auto max-h-[55vh] w-full rounded-lg" />
                ) : kind === "audio" && result ? (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <span className="grid size-20 place-items-center rounded-full bg-foreground/10 text-foreground/70">
                            <Music className="size-10" />
                        </span>
                        <WaveformPlayer src={result} className="w-full max-w-md" />
                    </div>
                ) : kind === "llm" ? (
                    <Markdown className="max-h-[55vh] overflow-y-auto text-base leading-relaxed">
                        {result}
                    </Markdown>
                ) : null}
            </div>

            {/* 담기/빼기 큰 토글 */}
            <Button
                type="button"
                onClick={onToggle}
                variant={selected ? "outline" : "default"}
                className="h-14 w-full justify-center gap-2 text-lg font-semibold"
            >
                {selected ? (
                    <>빼기</>
                ) : (
                    <>
                        <Check className="size-6" />
                        이 작품 담기
                    </>
                )}
            </Button>
        </div>
    );
}

// 작품 가져오기 다이얼로그 본체.
export function WorkPickerDialog({
    open,
    onOpenChange,
    userId,
    role,
    onPick,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    userId: string | null;
    role?: Role | null;
    onPick: (attachments: ChatAttachment[]) => void;
}) {
    const [mode, setMode] = React.useState<"gallery" | "upload">("gallery");
    const [works, setWorks] = React.useState<StudentBlockWork[]>([]);
    const [lessonMeta, setLessonMeta] = React.useState<Record<string, LessonMeta>>({});
    const [loading, setLoading] = React.useState(false);
    const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
    const [lessonFilter, setLessonFilter] = React.useState<string>("all");
    const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [viewing, setViewing] = React.useState<StudentBlockWork | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // 다이얼로그가 열릴 때마다 초기화하고 내 작품 + 강의 제목을 불러온다.
    React.useEffect(() => {
        if (!open) return;
        setMode("gallery");
        setTypeFilter("all");
        setLessonFilter("all");
        setDateFilter("all");
        setSelected(new Set());
        setViewing(null);
        setLessonMeta({});
        if (!userId) {
            setWorks([]);
            return;
        }
        let active = true;
        setLoading(true);
        Promise.all([getAllMyWork(userId), listCourses()])
            .then(([list, courses]) => {
                if (!active) return;
                setWorks(list.filter(workHasResult));
                const meta: Record<string, LessonMeta> = {};
                for (const c of courses) meta[c.id] = { weekNo: null, title: c.title };
                setLessonMeta(meta);
            })
            .catch(() => {
                if (active) setWorks([]);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [open, userId]);

    // 주차 번호 보강(있으면 더 좋게) — 내 강좌의 주차 구성을 읽어 lessonId→주차를 채운다.
    React.useEffect(() => {
        if (!open || !userId) return;
        let active = true;
        listPrograms({ userId, role: role ?? "student" })
            .then((progs) => Promise.all(progs.map((p) => getProgram(p.id))))
            .then((fulls) => {
                if (!active) return;
                setLessonMeta((prev) => {
                    const next = { ...prev };
                    for (const prog of fulls) {
                        for (const week of prog.weeks) {
                            const ids = [
                                ...week.items.filter((it) => it.type === "lesson").map((it) => it.id),
                                ...(week.lessonIds ?? []),
                            ];
                            for (const id of ids) {
                                next[id] = {
                                    weekNo: week.weekNo,
                                    title: next[id]?.title || week.title || "강의",
                                };
                            }
                        }
                    }
                    return next;
                });
            })
            .catch(() => {
                /* 주차 보강 실패는 조용히 무시 — 강의 제목만으로도 충분하다 */
            });
        return () => {
            active = false;
        };
    }, [open, userId, role]);

    // 강의·기간에 맞는(종류 무시) 작품 — 종류 칩 개수 계산용.
    const byLessonDate = React.useMemo(
        () =>
            works.filter(
                (w) =>
                    (lessonFilter === "all" || w.lessonId === lessonFilter) &&
                    matchesDate(workTime(w), dateFilter),
            ),
        [works, lessonFilter, dateFilter],
    );

    // 화면에 보일 작품 — 종류까지 적용.
    const visible = React.useMemo(
        () => byLessonDate.filter((w) => typeFilter === "all" || w.blockType === typeFilter),
        [byLessonDate, typeFilter],
    );

    // 종류별 개수.
    const typeCounts = React.useMemo(() => {
        const c: Record<string, number> = { all: byLessonDate.length };
        for (const w of byLessonDate) c[w.blockType] = (c[w.blockType] ?? 0) + 1;
        return c;
    }, [byLessonDate]);

    // 강의 선택 목록 — 작품이 있는 강의만, 주차 순으로 정렬.
    const lessonOptions = React.useMemo(() => {
        const counts: Record<string, number> = {};
        for (const w of works) counts[w.lessonId] = (counts[w.lessonId] ?? 0) + 1;
        return Object.keys(counts)
            .map((id) => ({
                id,
                label: lessonLabel(id, lessonMeta),
                weekNo: lessonMeta[id]?.weekNo ?? 9999,
                count: counts[id],
            }))
            .sort((a, b) => a.weekNo - b.weekNo || a.label.localeCompare(b.label, "ko"));
    }, [works, lessonMeta]);

    // 한 작품의 선택 상태를 토글한다.
    function toggle(w: StudentBlockWork) {
        const key = workKey(w);
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    // 선택한 작품들을 첨부로 변환해 채팅 입력칸에 담는다.
    function confirmSelection() {
        const picked = works
            .filter((w) => selected.has(workKey(w)))
            .map(workToAttachment)
            .filter((a): a is ChatAttachment => a !== null);
        if (picked.length === 0) return;
        onPick(picked);
        toast.success(`작품 ${picked.length}개를 담았어요`);
        onOpenChange(false);
    }

    // 기기에서 고른 파일들을 올려서 첨부로 담는다.
    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length === 0) return;
        setUploading(true);
        const toastId = toast.loading(`파일 ${files.length}개 올리는 중...`);
        const { uploadFile } = await import("@/lib/api");
        const results: ChatAttachment[] = [];
        for (const file of files) {
            try {
                results.push(await uploadFile(file));
            } catch (err) {
                toast.error(
                    `"${file.name}" 올리기 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
                );
            }
        }
        toast.dismiss(toastId);
        setUploading(false);
        if (results.length > 0) {
            onPick(results);
            toast.success(`파일 ${results.length}개를 담았어요`);
            onOpenChange(false);
        }
    }

    const selectedCount = selected.size;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="grid max-h-[92vh] w-full grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
                {/* 헤더(아이콘 없음) + 큰 방법 선택 버튼 */}
                <DialogHeader className="px-5 pb-4 pt-5 text-left">
                    <DialogTitle className="text-xl font-bold">작품 가져오기</DialogTitle>
                    <DialogDescription className="text-base">
                        보낼 작품을 고르거나, 내 기기에서 파일을 올리세요.
                    </DialogDescription>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                            type="button"
                            variant={mode === "gallery" ? "default" : "outline"}
                            onClick={() => setMode("gallery")}
                            className="h-14 justify-center gap-2 text-base font-semibold"
                        >
                            <LayoutGrid className="size-5" />
                            내가 만든 작품
                        </Button>
                        <Button
                            type="button"
                            variant={mode === "upload" ? "default" : "outline"}
                            onClick={() => setMode("upload")}
                            className="h-14 justify-center gap-2 text-base font-semibold"
                        >
                            <FolderOpen className="size-5" />
                            기기에서 올리기
                        </Button>
                    </div>
                </DialogHeader>

                {/* 본문 — 스크롤 영역 */}
                <div className="min-h-0 overflow-y-auto px-5 py-1">
                    {mode === "gallery" ? (
                        viewing ? (
                            <DetailView
                                work={viewing}
                                selected={selected.has(workKey(viewing))}
                                onToggle={() => toggle(viewing)}
                                onBack={() => setViewing(null)}
                                lessonText={lessonLabel(viewing.lessonId, lessonMeta)}
                            />
                        ) : (
                            <GalleryBody
                                loading={loading}
                                hasUser={!!userId}
                                works={works}
                                visible={visible}
                                typeFilter={typeFilter}
                                setTypeFilter={setTypeFilter}
                                typeCounts={typeCounts}
                                lessonFilter={lessonFilter}
                                setLessonFilter={setLessonFilter}
                                lessonOptions={lessonOptions}
                                dateFilter={dateFilter}
                                setDateFilter={setDateFilter}
                                selected={selected}
                                onToggle={toggle}
                                onOpen={setViewing}
                                lessonMeta={lessonMeta}
                                onGoUpload={() => setMode("upload")}
                            />
                        )
                    ) : (
                        <UploadBody
                            uploading={uploading}
                            onPickFiles={() => fileInputRef.current?.click()}
                        />
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                    />
                </div>

                {/* 푸터 */}
                <div className="flex items-center gap-3 border-t bg-muted/40 px-5 py-4">
                    {mode === "gallery" ? (
                        <>
                            <span className="text-base font-medium" aria-live="polite">
                                {selectedCount > 0 ? (
                                    <span className="text-primary">{selectedCount}개 선택됨</span>
                                ) : (
                                    <span className="text-muted-foreground">작품을 눌러 고르세요</span>
                                )}
                            </span>
                            <div className="ml-auto flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    className="h-12 px-5 text-base"
                                >
                                    닫기
                                </Button>
                                <Button
                                    type="button"
                                    onClick={confirmSelection}
                                    disabled={selectedCount === 0}
                                    className="h-12 px-6 text-base font-semibold"
                                >
                                    <Check className="size-5" />
                                    이 작품 담기
                                </Button>
                            </div>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="ml-auto h-12 px-5 text-base"
                        >
                            닫기
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// 갤러리(내가 만든 작품) 본문 — 로딩·빈 상태·필터·작품 격자를 그린다.
function GalleryBody({
    loading,
    hasUser,
    works,
    visible,
    typeFilter,
    setTypeFilter,
    typeCounts,
    lessonFilter,
    setLessonFilter,
    lessonOptions,
    dateFilter,
    setDateFilter,
    selected,
    onToggle,
    onOpen,
    lessonMeta,
    onGoUpload,
}: {
    loading: boolean;
    hasUser: boolean;
    works: StudentBlockWork[];
    visible: StudentBlockWork[];
    typeFilter: TypeFilter;
    setTypeFilter: (f: TypeFilter) => void;
    typeCounts: Record<string, number>;
    lessonFilter: string;
    setLessonFilter: (id: string) => void;
    lessonOptions: { id: string; label: string; count: number }[];
    dateFilter: DateFilter;
    setDateFilter: (f: DateFilter) => void;
    selected: Set<string>;
    onToggle: (w: StudentBlockWork) => void;
    onOpen: (w: StudentBlockWork) => void;
    lessonMeta: Record<string, LessonMeta>;
    onGoUpload: () => void;
}) {
    if (!hasUser) {
        return (
            <EmptyState
                title="로그인하면 내 작품을 볼 수 있어요"
                desc="대신 '기기에서 올리기'로 파일을 보낼 수 있어요."
                actionLabel="기기에서 올리기"
                onAction={onGoUpload}
            />
        );
    }
    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
                ))}
            </div>
        );
    }
    if (works.length === 0) {
        return (
            <EmptyState
                title="아직 만든 작품이 없어요"
                desc="강의에서 그림·영상·음악·글을 만들면 여기에 모여요. 먼저 기기에서 파일을 올려 볼까요?"
                actionLabel="기기에서 올리기"
                onAction={onGoUpload}
            />
        );
    }

    return (
        <>
            {/* 필터 영역 — 종류 / 강의 / 기간 */}
            <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 border-b bg-popover/95 px-5 pb-3 pt-2 backdrop-blur">
                {/* 종류 */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">종류</span>
                    {TYPE_FILTERS.filter(
                        (f) => f.value === "all" || (typeCounts[f.value] ?? 0) > 0,
                    ).map((f) => {
                        const active = typeFilter === f.value;
                        return (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setTypeFilter(f.value)}
                                aria-pressed={active}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-base font-medium transition-colors",
                                    active
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background hover:border-primary/50",
                                )}
                            >
                                <f.Icon className="size-4" />
                                {f.label}
                                <span className={cn("tabular-nums", active ? "opacity-90" : "text-muted-foreground")}>
                                    {typeCounts[f.value] ?? 0}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* 강의(주차) — 많을 때 큰 드롭다운으로 고르기 */}
                {lessonOptions.length > 1 && (
                    <div className="flex items-center gap-2">
                        <label htmlFor="work-lesson-filter" className="text-sm font-semibold text-muted-foreground">
                            강의
                        </label>
                        <Select value={lessonFilter} onValueChange={(v) => setLessonFilter(v ?? "all")}>
                            <SelectTrigger
                                id="work-lesson-filter"
                                className="h-11 flex-1 border-2 text-base font-medium"
                            >
                                <SelectValue placeholder="강의 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 강의 ({works.length})</SelectItem>
                                {lessonOptions.map((o) => (
                                    <SelectItem key={o.id} value={o.id}>
                                        {o.label} ({o.count})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* 기간 */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">기간</span>
                    {DATE_FILTERS.map((f) => {
                        const active = dateFilter === f.value;
                        return (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setDateFilter(f.value)}
                                aria-pressed={active}
                                className={cn(
                                    "rounded-full border-2 px-3.5 py-1.5 text-base font-medium transition-colors",
                                    active
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background hover:border-primary/50",
                                )}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 작품 격자 */}
            {visible.length === 0 ? (
                <p className="py-10 text-center text-base text-muted-foreground">
                    조건에 맞는 작품이 없어요. 필터를 바꿔 보세요.
                </p>
            ) : (
                <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-3">
                    {visible.map((w) => (
                        <WorkTile
                            key={workKey(w)}
                            work={w}
                            selected={selected.has(workKey(w))}
                            onToggle={() => onToggle(w)}
                            onOpen={() => onOpen(w)}
                            lessonText={lessonLabel(w.lessonId, lessonMeta)}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

// 업로드 본문 — 큰 안내 영역과 '파일 고르기' 버튼.
function UploadBody({
    uploading,
    onPickFiles,
}: {
    uploading: boolean;
    onPickFiles: () => void;
}) {
    return (
        <div className="py-3">
            <button
                type="button"
                onClick={onPickFiles}
                disabled={uploading}
                className={cn(
                    "flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border px-6 py-12 text-center transition-colors",
                    "hover:border-primary/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 disabled:opacity-60",
                )}
            >
                {uploading ? (
                    <Loader2 className="size-14 animate-spin text-primary" />
                ) : (
                    <span className="grid size-20 place-items-center rounded-full bg-primary/10 text-primary">
                        <Upload className="size-10" />
                    </span>
                )}
                <span className="text-xl font-bold">
                    {uploading ? "올리는 중..." : "여기를 눌러 파일을 고르세요"}
                </span>
                <span className="text-base text-muted-foreground">
                    사진, 영상, 소리 파일을 올릴 수 있어요.
                </span>
            </button>
        </div>
    );
}

// 빈 상태 안내 — 제목 + 설명 + (선택) 버튼.
function EmptyState({
    title,
    desc,
    actionLabel,
    onAction,
}: {
    title: string;
    desc: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <p className="text-lg font-bold">{title}</p>
            <p className="max-w-sm text-base text-muted-foreground">{desc}</p>
            {actionLabel && onAction && (
                <Button
                    type="button"
                    onClick={onAction}
                    className="mt-2 h-12 px-5 text-base font-semibold"
                >
                    <FolderOpen className="size-5" />
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}

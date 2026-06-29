/**
 * 강의 빌더 — 페이지 목록, 캔버스(드래그&드롭 블럭 편집), 블럭 팔레트를 통합하는 편집 화면.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    pointerWithin,
    closestCenter,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
} from "@dnd-kit/sortable";

// 드래그 중 이웃 블럭을 흔들지 않는 정렬 전략(transform 미적용). 높이가 제각각인
// 세로 블럭에서 rectSortingStrategy가 이웃을 엉뚱하게 밀어 "자리 못 찾는" 현상을
// 막고, 대신 드롭 위치는 별도의 삽입선(파란 줄)으로만 보여준다.
const noShiftStrategy = () => null;
import {
    ArrowLeft,
    Save,
    Eye,
    Pencil,
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    Download,
    Upload,
    GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import type { Block, BlockType, Course, CourseMaxWidth, Page } from "@/lib/types";
import { createBlock, blockMeta, type BlockMode } from "@/lib/blocks";
import { groupBlocksIntoRows, blockFlexStyle } from "@/lib/block-layout";
import {
    COURSE_MAX_WIDTHS,
    COURSE_MAX_WIDTH_LABEL,
    DEFAULT_COURSE_MAX_WIDTH,
} from "@/lib/course-width";
import { newId } from "@/lib/id";
import { saveCourse } from "@/lib/api";
import { downloadCourseJson, readCourseFile } from "@/lib/course-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import { AccessibilityToolbar } from "@/components/accessibility-toolbar";
import { MetaIcon } from "@/components/blocks/block-icon";
import { SortableBlock } from "./sortable-block";
import { BlockPalette } from "./block-palette";
import { SlashAdd } from "./slash-add";
import { AiCourseChat } from "./ai-course-chat";
import { BuilderPreview } from "./builder-preview";

/**
 * 캔버스보다 블럭을 우선하는 충돌 감지 — 캔버스 droppable이 블럭 전체를 감싸 항상
 * 충돌하므로, 포인터 아래 블럭이 있으면 그 블럭을 타겟으로 삼는다. 블럭 사이 빈 공간은
 * 가장 가까운 블럭으로, 블럭이 하나도 없을 때만 캔버스(맨 끝 추가)로 떨어뜨린다.
 */
const canvasAwareCollision: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args).filter((c) => c.id !== "canvas");
    if (pointerHits.length > 0) return pointerHits;
    const closest = closestCenter(args).filter((c) => c.id !== "canvas");
    if (closest.length > 0) return closest;
    return pointerWithin(args);
};

function DroppableCanvas({ children }: { children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
    return (
        <div
            ref={setNodeRef}
            className={cn(
                "rounded-xl transition-all",
                isOver && "outline-2 outline-dashed outline-ring/40",
            )}
        >
            {children}
        </div>
    );
}

export function Builder({ initial }: { initial: Course }) {
    const [course, setCourse] = useState<Course>(initial);
    const [pageIdx, setPageIdx] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activePalette, setActivePalette] = useState<{ type: BlockType; mode?: BlockMode } | null>(null);
    // 순서 변경으로 끌고 있는 기존 블럭 — DragOverlay에 커서를 따라다니는 카드로 그린다.
    const [activeBlock, setActiveBlock] = useState<Block | null>(null);
    // 드롭 위치 표시 — 어느 블럭의 앞/뒤에 놓일지. 해당 위치에 파란 삽입선을 그린다.
    const [dropAt, setDropAt] = useState<{ id: string; before: boolean } | null>(null);
    // AI 생성 반영 되돌리기 — 페이지 id별로 반영 직전 페이지들을 쌓아 페이지마다 되돌린다.
    const [genUndo, setGenUndo] = useState<Record<string, Page[]>>({});
    // 미리보기 모드 — 켜면 편집 블럭이 오른쪽으로 밀려나며 사라지고 학습자 화면으로 전환된다.
    const [previewing, setPreviewing] = useState(false);

    const page = course.pages[pageIdx] ?? course.pages[0];

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    // --- block mutations on the current page ---
    const mutateBlocks = useCallback(
        (fn: (blocks: Block[]) => Block[]) => {
            setCourse((prev) => ({
                ...prev,
                pages: prev.pages.map((p, i) =>
                    i === pageIdx ? { ...p, blocks: fn(p.blocks) } : p,
                ),
            }));
            setDirty(true);
        },
        [pageIdx],
    );

    const updateBlock = (id: string, nb: Block) =>
        mutateBlocks((bs) => bs.map((b) => (b.id === id ? nb : b)));
    const deleteBlock = (id: string) =>
        mutateBlocks((bs) => bs.filter((b) => b.id !== id));
    const appendBlock = (type: BlockType, mode?: BlockMode) =>
        mutateBlocks((bs) => [...bs, createBlock(type, mode)]);
    const addTextBlock = (text: string) =>
        mutateBlocks((bs) => [
            ...bs,
            { id: newId(), type: "text", markdown: text },
        ]);
    const moveBlock = (id: string, dir: -1 | 1) =>
        mutateBlocks((bs) => {
            const i = bs.findIndex((b) => b.id === id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= bs.length) return bs;
            return arrayMove(bs, i, j);
        });

    // 본문 가로 폭을 바꾼다(학생이 보게 될 폭). 강사 설정값으로 강의에 저장된다.
    function setMaxWidth(width: CourseMaxWidth) {
        setCourse((prev) => ({ ...prev, maxWidth: width }));
        setDirty(true);
    }

    // --- page mutations ---
    function addPage() {
        const newIndex = course.pages.length;
        setCourse((prev) => ({
            ...prev,
            pages: [
                ...prev.pages,
                { id: newId(), title: `${prev.pages.length + 1}페이지`, blocks: [] },
            ],
        }));
        setPageIdx(newIndex);
        setDirty(true);
    }
    function deletePage(i: number) {
        if (course.pages.length <= 1) {
            toast.error("최소 한 페이지는 있어야 해요.");
            return;
        }
        if (!window.confirm("이 페이지를 삭제할까요?")) return;
        setCourse((prev) => ({
            ...prev,
            pages: prev.pages.filter((_, idx) => idx !== i),
        }));
        setPageIdx((p) => Math.max(0, p >= i ? p - 1 : p));
        setDirty(true);
    }
    function renamePage(i: number, title: string) {
        setCourse((prev) => ({
            ...prev,
            pages: prev.pages.map((p, idx) => (idx === i ? { ...p, title } : p)),
        }));
        setDirty(true);
    }
    function movePage(i: number, dir: -1 | 1) {
        const j = i + dir;
        if (j < 0 || j >= course.pages.length) return;
        setCourse((prev) => ({ ...prev, pages: arrayMove(prev.pages, i, j) }));
        setPageIdx(j);
        setDirty(true);
    }

    // --- drag & drop ---
    function onDragStart(e: DragStartEvent) {
        const d = e.active.data.current as { source?: string; type?: BlockType; mode?: BlockMode } | undefined;
        if (d?.source === "palette" && d.type) {
            setActivePalette({ type: d.type, mode: d.mode });
            return;
        }
        // 기존 블럭 순서 변경: 끌고 있는 블럭을 찾아 오버레이용으로 저장한다.
        setActiveBlock(page.blocks.find((b) => b.id === String(e.active.id)) ?? null);
    }
    // 드래그가 취소되면(ESC 등) 오버레이/삽입선 상태를 정리한다.
    function onDragCancel() {
        setActivePalette(null);
        setActiveBlock(null);
        setDropAt(null);
    }
    // 드래그 중 포인터가 가리키는 블럭의 앞/뒤를 계산해 삽입선 위치를 갱신한다.
    function onDragOver(e: DragOverEvent) {
        const { active, over } = e;
        if (!over || over.id === "canvas" || over.id === active.id) {
            setDropAt(null);
            return;
        }
        const a = active.rect.current.translated;
        const before = a
            ? a.top + a.height / 2 < over.rect.top + over.rect.height / 2
            : false;
        setDropAt({ id: String(over.id), before });
    }
    function onDragEnd(e: DragEndEvent) {
        setActivePalette(null);
        setActiveBlock(null);
        setDropAt(null);
        const { active, over } = e;
        if (!over) return;
        const d = active.data.current as { source?: string; type?: BlockType; mode?: BlockMode } | undefined;
        // 드래그 중인 요소의 세로 중심이 타겟 블럭 중심보다 위면 앞에, 아래면 뒤에 넣는다.
        const dropBefore = () => {
            const a = active.rect.current.translated;
            if (!a) return false;
            return a.top + a.height / 2 < over.rect.top + over.rect.height / 2;
        };
        if (d?.source === "palette" && d.type) {
            const overId = String(over.id);
            mutateBlocks((bs) => {
                const idx = bs.findIndex((b) => b.id === overId);
                const nb = createBlock(d.type!, d.mode);
                if (idx === -1) return [...bs, nb];
                const at = dropBefore() ? idx : idx + 1;
                const copy = [...bs];
                copy.splice(at, 0, nb);
                return copy;
            });
            return;
        }
        if (active.id !== over.id) {
            const before = dropBefore();
            mutateBlocks((bs) => {
                const from = bs.findIndex((b) => b.id === active.id);
                const overIdx = bs.findIndex((b) => b.id === over.id);
                if (from < 0 || overIdx < 0) return bs;
                // 삽입선(onDragOver)과 똑같은 before/after로 타겟 블럭의 앞/뒤에 꽂는다.
                // arrayMove는 방향(from<to)에 따라 결과 위치가 달라져 선과 어긋났다.
                const moved = bs[from];
                const copy = [...bs];
                copy.splice(from, 1);
                let insertAt = before ? overIdx : overIdx + 1;
                // 원본을 먼저 빼면서 삽입 지점 앞쪽이 한 칸 당겨졌으면 보정한다.
                if (from < insertAt) insertAt -= 1;
                copy.splice(insertAt, 0, moved);
                return copy;
            });
        }
    }

    // --- save ---
    const save = useCallback(async () => {
        setSaving(true);
        try {
            const saved = await saveCourse(course);
            setCourse(saved);
            setDirty(false);
            toast.success("강의를 저장했어요.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    }, [course]);

    // --- AI 생성 반영 / 되돌리기 (현재 페이지 단위) ---
    // AI가 만든 페이지로 해당 페이지만 교체하고, 직전 페이지를 그 페이지의 되돌리기 스택에 쌓는다.
    const applyGeneratedPage = useCallback(
        (pageId: string, next: Page) => {
            const prevPage = course.pages.find((p) => p.id === pageId);
            if (prevPage) {
                setGenUndo((u) => ({ ...u, [pageId]: [...(u[pageId] ?? []), prevPage] }));
            }
            setCourse((prev) => ({
                ...prev,
                pages: prev.pages.map((p) => (p.id === pageId ? { ...next, id: pageId } : p)),
            }));
            setDirty(true);
        },
        [course],
    );

    // 현재 페이지의 마지막 AI 반영을 취소하고 직전 상태로 되돌린다.
    const undoGeneratedPage = useCallback(() => {
        const stack = genUndo[page.id] ?? [];
        if (stack.length === 0) return;
        const prev = stack[stack.length - 1];
        setGenUndo((u) => ({ ...u, [page.id]: stack.slice(0, -1) }));
        setCourse((c) => ({
            ...c,
            pages: c.pages.map((p) => (p.id === page.id ? prev : p)),
        }));
        setDirty(true);
        toast.success("이 페이지를 이전 상태로 되돌렸어요.");
    }, [genUndo, page.id]);

    // --- JSON 내보내기 / 불러오기 ---
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 현재 강의를 포터블 JSON 파일로 내려받는다.
    const exportCourse = useCallback(() => {
        try {
            downloadCourseJson(course);
            toast.success("강의 JSON을 내보냈어요.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "내보내기에 실패했어요.");
        }
    }, [course]);

    // 숨김 파일 입력을 열어 불러오기를 시작한다.
    const pickImportFile = () => fileInputRef.current?.click();

    // 선택한 JSON을 읽어 현재 강의 내용을 교체한다(id·생성시각은 그대로 유지).
    async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = ""; // 같은 파일을 다시 고를 수 있게 비운다.
        if (!file) return;
        if (
            dirty &&
            !window.confirm("저장하지 않은 변경이 있어요. 불러온 강의로 덮어쓸까요?")
        ) {
            return;
        }
        try {
            const imported = await readCourseFile(file, {
                id: course.id,
                createdAt: course.createdAt,
            });
            setCourse(imported);
            setPageIdx(0);
            setDirty(true);
            toast.success("강의를 불러왔어요. 저장하면 반영돼요.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "불러오기에 실패했어요.");
        }
    }

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                void save();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [save]);

    useEffect(() => {
        function onBeforeUnload(e: BeforeUnloadEvent) {
            if (dirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        }
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty]);

    return (
        <div className="flex h-screen flex-col overflow-hidden">
            <header className="z-40 shrink-0 border-b bg-background/90 backdrop-blur">
                <div className="flex h-16 items-center gap-3 px-4">
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    render={<Link href="/programs" aria-label="강좌 목록으로" />}
                                />
                            }
                        >
                            <ArrowLeft className="size-5" />
                        </TooltipTrigger>
                        <TooltipContent>강좌 목록으로</TooltipContent>
                    </Tooltip>
                    <Input
                        value={course.title}
                        onChange={(e) => {
                            setCourse((p) => ({ ...p, title: e.target.value }));
                            setDirty(true);
                        }}
                        className="h-9 max-w-xs border-transparent bg-transparent text-lg font-bold hover:border-input focus-visible:border-ring"
                        aria-label="강의 제목"
                    />
                    {dirty && <span className="eyebrow text-warning">● 변경됨</span>}
                    <div className="ml-auto flex items-center gap-2">
                        <AccessibilityToolbar className="hidden xl:flex" />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={onImportFile}
                        />
                        {/* 본문 가로 폭 — 강사가 강의 생성 시 고른다. 학생은 이 폭 그대로 본다. */}
                        <Select
                            value={course.maxWidth ?? DEFAULT_COURSE_MAX_WIDTH}
                            onValueChange={(v) => setMaxWidth(v as CourseMaxWidth)}
                        >
                            <SelectTrigger
                                className="hidden w-[9.5rem] sm:flex"
                                aria-label="본문 가로 폭 (학생이 보는 폭)"
                                title="본문 가로 폭 (학생이 보는 폭)"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COURSE_MAX_WIDTHS.map((w) => (
                                    <SelectItem key={w} value={w}>
                                        {COURSE_MAX_WIDTH_LABEL[w]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={pickImportFile}>
                            <Upload className="size-4" /> 불러오기
                        </Button>
                        <Button variant="outline" onClick={exportCourse}>
                            <Download className="size-4" /> 내보내기
                        </Button>
                        <Button
                            variant={previewing ? "default" : "outline"}
                            onClick={() => setPreviewing((v) => !v)}
                            aria-pressed={previewing}
                        >
                            {previewing ? (
                                <>
                                    <Pencil className="size-4" /> 편집으로
                                </>
                            ) : (
                                <>
                                    <Eye className="size-4" /> 미리보기
                                </>
                            )}
                        </Button>
                        <Button onClick={save} disabled={saving}>
                            <Save className="size-4" /> {saving ? "저장 중..." : "저장"}
                        </Button>
                    </div>
                </div>
            </header>

            <div className="relative min-h-0 flex-1 overflow-hidden">
            <DndContext
                sensors={sensors}
                collisionDetection={canvasAwareCollision}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
            >
                <div
                    className={cn(
                        "mx-auto flex h-full w-full max-w-7xl gap-6 p-4 sm:p-6",
                        "transition-all duration-300 ease-in-out motion-reduce:transition-none",
                        previewing
                            ? "pointer-events-none translate-x-12 opacity-0"
                            : "translate-x-0 opacity-100",
                    )}
                    aria-hidden={previewing}
                >
                    {/* pages list */}
                    <aside className="hidden w-56 shrink-0 overflow-y-auto pb-8 md:block">
                        <div className="space-y-2">
                            <p className="eyebrow px-1">페이지</p>
                            <ol className="space-y-1">
                                {course.pages.map((p, i) => (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onClick={() => setPageIdx(i)}
                                            className={cn(
                                                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                                i === pageIdx
                                                    ? "border-primary bg-muted font-medium"
                                                    : "border-transparent hover:bg-muted",
                                            )}
                                        >
                                            <span className="mono text-xs text-muted-foreground">
                                                {String(i + 1).padStart(2, "0")}
                                            </span>
                                            <span className="line-clamp-1">{p.title || "제목 없음"}</span>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                            <Button variant="outline" className="w-full" onClick={addPage}>
                                <Plus className="size-4" /> 페이지 추가
                            </Button>
                        </div>
                    </aside>

                    {/* canvas */}
                    <main className="min-w-0 flex-1 overflow-y-auto pb-8">
                        <div className="mb-4 flex items-center gap-2">
                            <Input
                                value={page.title}
                                onChange={(e) => renamePage(pageIdx, e.target.value)}
                                className="h-11 flex-1 border-transparent bg-transparent text-2xl font-bold hover:border-input focus-visible:border-ring"
                                aria-label="페이지 제목"
                            />
                            <span className="mono shrink-0 text-sm text-muted-foreground">
                                {pageIdx + 1} / {course.pages.length}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                                <Button size="icon-sm" variant="ghost" onClick={() => movePage(pageIdx, -1)} aria-label="페이지 위로">
                                    <ChevronUp className="size-4" />
                                </Button>
                                <Button size="icon-sm" variant="ghost" onClick={() => movePage(pageIdx, 1)} aria-label="페이지 아래로">
                                    <ChevronDown className="size-4" />
                                </Button>
                                <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    className="text-destructive hover:bg-destructive/10"
                                    onClick={() => deletePage(pageIdx)}
                                    aria-label="페이지 삭제"
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        </div>

                        <DroppableCanvas>
                            <div className="space-y-3">
                                {page.blocks.length === 0 && (
                                    <div className="grid place-items-center rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                                        오른쪽 블럭을 끌어오거나 아래에서 <span className="mono mx-1">/</span> 를
                                        눌러 강의를 시작하세요
                                    </div>
                                )}
                                {/* 블럭 전체를 한 SortableContext로 감싸 dnd 순서를 유지하고, 줄 단위로 렌더한다. */}
                                <SortableContext
                                    items={page.blocks.map((b) => b.id)}
                                    strategy={noShiftStrategy}
                                >
                                    {groupBlocksIntoRows(page.blocks).map((row) => (
                                        <div
                                            key={row[0].id}
                                            className="space-y-3 md:flex md:space-y-0 md:gap-3 md:items-start"
                                        >
                                            {row.map((b) => (
                                                <div
                                                    key={b.id}
                                                    style={blockFlexStyle(b.width)}
                                                    className="relative"
                                                >
                                                    {/* 드롭 위치 삽입선 — 이 블럭 앞/뒤에 놓일 때 파란 줄 표시 */}
                                                    {dropAt?.id === b.id && dropAt.before && (
                                                        <div className="pointer-events-none absolute inset-x-0 -top-2 z-10 h-0.5 rounded-full bg-primary" />
                                                    )}
                                                    {dropAt?.id === b.id && !dropAt.before && (
                                                        <div className="pointer-events-none absolute inset-x-0 -bottom-2 z-10 h-0.5 rounded-full bg-primary" />
                                                    )}
                                                    <SortableBlock
                                                        block={b}
                                                        onChange={(nb) => updateBlock(b.id, nb)}
                                                        onDelete={() => deleteBlock(b.id)}
                                                        onMoveUp={() => moveBlock(b.id, -1)}
                                                        onMoveDown={() => moveBlock(b.id, 1)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </SortableContext>
                                <SlashAdd onAdd={appendBlock} onAddText={addTextBlock} />
                            </div>
                        </DroppableCanvas>

                        <div className="mt-6 lg:hidden">
                            <BlockPalette onAdd={appendBlock} />
                        </div>
                    </main>

                    {/* palette */}
                    <aside className="hidden w-64 shrink-0 overflow-y-auto pb-8 lg:block">
                        <BlockPalette onAdd={appendBlock} />
                    </aside>
                </div>

                <DragOverlay dropAnimation={null}>
                    {activePalette ? (
                        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
                            <MetaIcon name={blockMeta(activePalette.type, activePalette.mode).icon} className="size-4" />
                            <span className="text-sm font-medium">
                                {blockMeta(activePalette.type, activePalette.mode).label}
                            </span>
                        </div>
                    ) : activeBlock ? (
                        // 순서 변경 중인 기존 블럭 — 커서를 따라다니는 깨끗한 카드(원본은 숨김).
                        <div className="flex cursor-grabbing items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-lg ring-2 ring-ring/40">
                            <GripVertical className="size-4 text-muted-foreground" />
                            <MetaIcon
                                name={blockMeta(activeBlock.type, "mode" in activeBlock ? activeBlock.mode : undefined).icon}
                                className="size-4"
                            />
                            <span className="text-sm font-medium">
                                {blockMeta(activeBlock.type, "mode" in activeBlock ? activeBlock.mode : undefined).label}
                            </span>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

                {/* 미리보기 레이어 — 편집 블럭이 오른쪽으로 빠져나간 자리에 학습자 화면이 들어온다. */}
                <div
                    className={cn(
                        "absolute inset-0 z-10 bg-background",
                        "transition-all duration-300 ease-in-out motion-reduce:transition-none",
                        previewing
                            ? "translate-x-0 opacity-100"
                            : "pointer-events-none translate-x-12 opacity-0",
                    )}
                    aria-hidden={!previewing}
                >
                    <BuilderPreview
                        course={course}
                        open={previewing}
                        startPage={pageIdx}
                        onExit={() => setPreviewing(false)}
                    />
                </div>
            </div>

            {!previewing && (
                <AiCourseChat
                    page={page}
                    pageIndex={pageIdx}
                    courseTitle={course.title}
                    onApplyPage={applyGeneratedPage}
                    canUndo={(genUndo[page.id]?.length ?? 0) > 0}
                    onUndo={undoGeneratedPage}
                />
            )}
        </div>
    );
}

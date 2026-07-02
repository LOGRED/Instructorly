/**
 * 창작 실습 에디터 — 표지·블럭으로 작품(시·동화책·에세이)을 구성하고, 오른쪽에서 책처럼
 * 미리보며, PDF로 내려받는다. 강사는 시범본(sample)을, 학생은 자기 작품(work)을 편집한다.
 * 본문 블럭 편집은 기존 빌더의 BlockEdit를 그대로 재사용한다.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    BookOpen,
    Bot,
    ChevronDown,
    ChevronUp,
    Download,
    Eye,
    Feather,
    ImagePlus,
    Loader2,
    Lock,
    MousePointerClick,
    PenLine,
    Plus,
    Save,
    Sparkles,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { toast } from "sonner";

import type {
    Atelier,
    AtelierDoc,
    AtelierFont,
    AtelierGenre,
    Block,
    BlockWidth,
    Page,
    Role,
} from "@/lib/types";
import { createBlock, blockMeta, type BlockMode } from "@/lib/blocks";
import { BLOCK_WIDTH_OPTIONS } from "@/lib/block-layout";
import { genreMeta, ATELIER_THEMES, RATIO_OPTIONS, effectiveRatio, FONT_OPTIONS, effectiveFont, type PageRatio } from "@/lib/atelier-templates";
import { exportAtelierPdf, pdfFileName } from "@/lib/atelier-pdf";
import { docToPage } from "@/lib/course-format";
import { newId } from "@/lib/id";
import {
    saveAtelier,
    saveAtelierWork,
    generateImage,
    studioGenerate,
    uploadFile,
    generatePage,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/credits";
import { useStudioCatalog } from "@/lib/use-studio-catalog";
import { formatModelPrice } from "@/components/blocks/block-model-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { BlockEdit } from "@/components/blocks/block-edit";
import { BookPreview, BookExportLayer, pagePx, fontStack } from "@/components/atelier/book";
import { TemplatePicker } from "./template-picker";

/** 표지 그림 무료 모델(Pollinations FLUX) 선택 항목의 sentinel id. */
const FREE_COVER_ID = "free-flux";

/** 블럭 추가 메뉴에 노출할 블럭들(문학 작업에 맞춘 선별). */
const ADD_BLOCKS: { label: string; type: Block["type"]; mode?: BlockMode }[] = [
    { label: "텍스트", type: "text" },
    { label: "제목", type: "heading" },
    { label: "인용", type: "quote" },
    { label: "강조 박스", type: "callout" },
    { label: "이미지 (AI 생성)", type: "image", mode: "gen" },
    { label: "이미지 (업로드)", type: "image", mode: "upload" },
    { label: "구분선", type: "divider" },
    { label: "표", type: "table" },
];

/** 배열에서 한 칸 이동시킨 새 배열을 만든다(위/아래 정렬용). */
function moveInArray<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = arr.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
}

/** 새 빈 쪽을 만든다(텍스트 블럭 하나로 시작). */
function newPage(): Page {
    return { id: newId(), title: "새 쪽", blocks: [createBlock("text")] };
}

/** 작품 문서를 깊은 복사한다(학생이 강사 스캐폴드를 받아 자기 작품으로 시작할 때). */
function cloneAtelierDoc(d: AtelierDoc): AtelierDoc {
    return JSON.parse(JSON.stringify(d)) as AtelierDoc;
}

/** 장르별 AI 페이지 생성 지시문을 만든다. */
function genrePrompt(genre: AtelierGenre, title: string, brief: string): string {
    const label = genreMeta(genre).label;
    const topic = [title, brief].filter(Boolean).join(" — ");
    return `다음 주제로 ${label} 작품의 한 쪽(페이지)을 만들어 줘: ${topic || label}. 제목 블럭과 본문 텍스트 블럭으로 구성하고, 동화책이면 장면 묘사를 곁들여 줘.`;
}

/** 장르 아이콘. */
function GenreIcon({ genre, className }: { genre: AtelierGenre; className?: string }) {
    const icon = genreMeta(genre).icon;
    if (icon === "BookOpen") return <BookOpen className={className} />;
    if (icon === "PenLine") return <PenLine className={className} />;
    return <Feather className={className} />;
}

export function AtelierEditor({
    atelier,
    role,
    userId,
    userName,
    initialDoc,
}: {
    atelier: Atelier;
    role: Role;
    userId: string;
    userName: string;
    initialDoc: AtelierDoc | null;
}) {
    const isInstructor = role === "instructor";
    const meta = genreMeta(atelier.genre);
    const canSave = isInstructor || !!userId;

    // 강사는 시범본을, 학생은 자기 작품을 편집한다. 학생이 아직 작품이 없으면 강사 스캐폴드를
    // 복사해 시작한다(강사가 블럭으로 만든 구조 위에 학생이 미리보기에서 내용을 채우는 흐름).
    const [doc, setDoc] = useState<AtelierDoc | null>(
        () => initialDoc ?? (role === "student" ? cloneAtelierDoc(atelier.sample) : null),
    );
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedOnce, setSavedOnce] = useState(false);
    const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
    const [exporting, setExporting] = useState(false);
    const [aiBusy, setAiBusy] = useState(false);
    const [sampleOpen, setSampleOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    // ---- 문서 변경 헬퍼 ----
    function mutate(updater: (d: AtelierDoc) => AtelierDoc) {
        setDoc((prev) => (prev ? updater(prev) : prev));
        setDirty(true);
    }
    function updateBlocks(pageId: string, fn: (blocks: Block[]) => Block[]) {
        mutate((d) => ({
            ...d,
            pages: d.pages.map((p) => (p.id === pageId ? { ...p, blocks: fn(p.blocks) } : p)),
        }));
    }

    // ---- 저장(수동/자동) ----
    async function save(manual: boolean) {
        if (!doc || !canSave) return;
        setSaving(true);
        try {
            if (isInstructor) {
                await saveAtelier({ ...atelier, sample: doc });
            } else {
                await saveAtelierWork({ atelierId: atelier.id, userId, userName, doc });
            }
            setDirty(false);
            setSavedOnce(true);
            if (manual) toast.success("저장했습니다.");
        } catch (e) {
            if (manual) toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    }

    // 변경 후 1.8초 멈추면 자동 저장한다.
    useEffect(() => {
        if (!doc || !dirty || !canSave) return;
        const t = setTimeout(() => void save(false), 1800);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc, dirty]);

    // 저장 안 된 변경이 있으면 새로고침/이탈 시 경고한다.
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

    // ---- PDF 내보내기 ----
    async function handleExport() {
        if (!doc) return;
        setExporting(true);
        try {
            // 숨김 레이어의 이미지가 준비될 시간을 잠깐 준다.
            await new Promise((r) => setTimeout(r, 350));
            const root = exportRef.current;
            if (!root) throw new Error("내보내기 영역을 찾을 수 없습니다.");
            const pages = Array.from(root.querySelectorAll<HTMLElement>(".atelier-page"));
            if (!pages.length) throw new Error("내보낼 페이지가 없습니다.");
            await exportAtelierPdf({
                pages,
                fileName: pdfFileName(doc.cover.title || atelier.title),
                ratio: effectiveRatio(doc),
            });
            toast.success("PDF를 내려받았습니다.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "PDF 내보내기에 실패했습니다.");
        } finally {
            setExporting(false);
        }
    }

    // ---- AI로 한 쪽 만들기 ----
    async function handleAiPage() {
        if (!doc) return;
        setAiBusy(true);
        try {
            const res = await generatePage({
                messages: [{ role: "user", content: genrePrompt(atelier.genre, atelier.title, atelier.brief) }],
                courseTitle: atelier.title,
                userId,
                userName,
            });
            if (res.page) {
                const p = docToPage(res.page);
                mutate((d) => ({ ...d, pages: [...d.pages, p] }));
                toast.success("AI가 새 쪽을 만들었어요.");
            } else {
                toast.message(res.reply || "결과가 없습니다.");
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "AI 생성에 실패했습니다.");
        } finally {
            setAiBusy(false);
        }
    }

    const saveStatus = saving
        ? "저장 중…"
        : dirty
          ? "저장 안 됨"
          : savedOnce
            ? "저장됨"
            : null;

    return (
        <div className="flex h-screen flex-col">
            {/* 상단 바 */}
            <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-4">
                <Button variant="ghost" size="sm" render={<Link href={`/programs/${atelier.programId}`} />}>
                    <ArrowLeft />
                    <span className="hidden sm:inline">강좌</span>
                </Button>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <GenreIcon genre={atelier.genre} className="size-4 shrink-0 text-brand" />
                    <h1 className="truncate font-semibold">{atelier.title}</h1>
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                        {meta.label}
                    </Badge>
                    <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground md:inline">
                        {isInstructor ? "강사 시범본" : "내 작품"}
                    </span>
                </div>
                {saveStatus && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">{saveStatus}</span>
                )}
                {!isInstructor && (
                    <Button variant="outline" size="sm" onClick={() => setSampleOpen(true)}>
                        <Eye />
                        <span className="hidden sm:inline">강사 예시</span>
                    </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || !doc}>
                    {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                    <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button size="sm" onClick={() => save(true)} disabled={saving || !canSave || !doc}>
                    <Save />
                    <span className="hidden sm:inline">저장</span>
                </Button>
            </header>

            {/* 본문 */}
            {!doc ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <TemplatePicker
                        genre={atelier.genre}
                        sampleDoc={isInstructor ? null : atelier.sample}
                        onPick={(d) => {
                            setDoc(d);
                            setDirty(true);
                        }}
                    />
                </div>
            ) : isInstructor ? (
                <>
                    {/* 모바일 편집/미리보기 전환 */}
                    <div className="flex shrink-0 gap-1 border-b bg-muted/30 p-1 lg:hidden">
                        {(["edit", "preview"] as const).map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setMobileView(v)}
                                className={cn(
                                    "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
                                    mobileView === v ? "bg-background shadow-sm" : "text-muted-foreground",
                                )}
                            >
                                {v === "edit" ? "편집" : "미리보기"}
                            </button>
                        ))}
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                        {/* 편집 영역 */}
                        <section
                            className={cn(
                                "min-h-0 flex-1 overflow-y-auto lg:border-r",
                                mobileView === "preview" && "hidden lg:block",
                            )}
                        >
                            <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
                                {!canSave && (
                                    <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                        로그인하면 작품을 저장할 수 있어요. 지금은 미리 만들어 볼 수 있습니다.
                                    </p>
                                )}
                                {atelier.brief && (
                                    <div className="flex gap-3 rounded-xl border bg-muted/40 p-4">
                                        <span className="text-xl leading-none">📝</span>
                                        <div className="text-sm leading-relaxed">{atelier.brief}</div>
                                    </div>
                                )}

                                <SettingsPanel
                                    doc={doc}
                                    onRatio={(r) => mutate((d) => ({ ...d, ratio: r }))}
                                    onTheme={(theme) => mutate((d) => ({ ...d, theme }))}
                                    onFont={(font) => mutate((d) => ({ ...d, font }))}
                                />

                                <CoverPanel
                                    doc={doc}
                                    isInstructor={isInstructor}
                                    userId={userId}
                                    userName={userName}
                                    onCover={(patch) => mutate((d) => ({ ...d, cover: { ...d.cover, ...patch } }))}
                                />

                                <div className="space-y-4">
                                    {doc.pages.map((page, i) => (
                                        <PageCard
                                            key={page.id}
                                            page={page}
                                            index={i}
                                            total={doc.pages.length}
                                            onTitle={(title) =>
                                                mutate((d) => ({
                                                    ...d,
                                                    pages: d.pages.map((p) => (p.id === page.id ? { ...p, title } : p)),
                                                }))
                                            }
                                            onMovePage={(dir) =>
                                                mutate((d) => ({ ...d, pages: moveInArray(d.pages, i, dir) }))
                                            }
                                            onDeletePage={() =>
                                                mutate((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== page.id) }))
                                            }
                                            onAddBlock={(type, mode) =>
                                                updateBlocks(page.id, (bs) => [...bs, createBlock(type, mode)])
                                            }
                                            onBlockChange={(block) =>
                                                updateBlocks(page.id, (bs) => bs.map((b) => (b.id === block.id ? block : b)))
                                            }
                                            onBlockMove={(blockId, dir) =>
                                                updateBlocks(page.id, (bs) => {
                                                    const idx = bs.findIndex((b) => b.id === blockId);
                                                    return idx < 0 ? bs : moveInArray(bs, idx, dir);
                                                })
                                            }
                                            onBlockDelete={(blockId) =>
                                                updateBlocks(page.id, (bs) => bs.filter((b) => b.id !== blockId))
                                            }
                                            onBlockWidth={(blockId, width) =>
                                                updateBlocks(page.id, (bs) =>
                                                    bs.map((b) => (b.id === blockId ? { ...b, width } : b)),
                                                )
                                            }
                                        />
                                    ))}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => mutate((d) => ({ ...d, pages: [...d.pages, newPage()] }))}
                                    >
                                        <Plus />쪽 추가
                                    </Button>
                                    <Button variant="outline" onClick={handleAiPage} disabled={aiBusy}>
                                        {aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                                        AI로 한 쪽 만들기
                                    </Button>
                                </div>
                            </div>
                        </section>

                        {/* 미리보기 영역 */}
                        <section
                            className={cn(
                                "min-h-0 flex-1 bg-muted/20 lg:flex-[0_0_46%] lg:max-w-[640px]",
                                mobileView === "edit" && "hidden lg:block",
                            )}
                        >
                            <div className="h-full p-3 sm:p-4">
                                <BookPreview doc={doc} className="h-full" />
                            </div>
                        </section>
                    </div>
                </>
            ) : (
                /* 학생 — 미리보기(책) 위에서 글자·그림을 바로 편집한다. */
                <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
                    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 p-4 sm:p-6">
                        {!canSave && (
                            <p className="shrink-0 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                로그인하면 작품을 저장할 수 있어요. 지금은 미리 만들어 볼 수 있습니다.
                            </p>
                        )}
                        {atelier.brief && (
                            <div className="flex shrink-0 gap-3 rounded-xl border bg-card p-4">
                                <span className="text-xl leading-none">📝</span>
                                <div className="text-sm leading-relaxed">{atelier.brief}</div>
                            </div>
                        )}
                        <div className="mx-auto flex shrink-0 flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 rounded-full border border-brand/20 bg-brand/[0.06] px-4 py-2 text-sm">
                            <MousePointerClick className="size-4 shrink-0 text-brand" />
                            <span className="text-muted-foreground">
                                <b className="font-semibold text-foreground">번호 칸</b>을 누르면 크게 떠서 쉽게 고쳐요
                            </span>
                            <span className="hidden text-border sm:inline">|</span>
                            <span className="inline-flex items-center gap-1">
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">제목</span>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">글</span>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">그림</span>
                            </span>
                        </div>
                        <div className="min-h-0 flex-1">
                            <BookPreview
                                doc={doc}
                                editable
                                onChange={(next) => {
                                    setDoc(next);
                                    setDirty(true);
                                }}
                                className="h-full"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* PDF 캡처용 숨김 레이어(항상 화면 밖에 원본 크기로 렌더) */}
            {doc && <BookExportLayer ref={exportRef} doc={doc} />}

            {/* 강사 예시 미리보기(학생용) */}
            <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>강사 예시</DialogTitle>
                        <DialogDescription>선생님이 만든 시범 작품이에요. 참고해서 내 작품을 만들어 보세요.</DialogDescription>
                    </DialogHeader>
                    <div className="h-[60vh]">
                        <BookPreview doc={atelier.sample} className="h-full" />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** 기본 설정 — 책 페이지 비율·색 테마·폰트(표지부터 본문까지 책 전체에 적용). */
function SettingsPanel({
    doc,
    onRatio,
    onTheme,
    onFont,
}: {
    doc: AtelierDoc;
    onRatio: (r: PageRatio) => void;
    onTheme: (theme: AtelierDoc["theme"]) => void;
    onFont: (font: AtelierFont) => void;
}) {
    const current = effectiveRatio(doc);
    return (
        <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">기본 설정</h2>
                <span className="text-xs text-muted-foreground">책 전체에 적용돼요</span>
            </div>

            {/* 책 페이지 비율 */}
            <div className="flex flex-col gap-2">
                <Label>책 페이지 비율</Label>
                <div className="flex flex-wrap gap-2">
                    {RATIO_OPTIONS.map((opt) => {
                        const active = current === opt.value;
                        const { w, h } = pagePx(opt.value);
                        const ar = w / h;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onRatio(opt.value)}
                                className={cn(
                                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                                    active
                                        ? "border-brand font-semibold ring-2 ring-brand/30"
                                        : "border-border hover:bg-muted/60",
                                )}
                            >
                                <span
                                    className="shrink-0 rounded-sm border border-current opacity-70"
                                    style={{
                                        width: ar >= 1 ? 22 : Math.round(22 * ar),
                                        height: ar >= 1 ? Math.round(22 / ar) : 22,
                                    }}
                                />
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 색 테마 */}
            <div className="flex flex-col gap-2">
                <Label>색 테마</Label>
                <div className="flex flex-wrap gap-2">
                    {ATELIER_THEMES.map((t) => {
                        const active = doc.theme.key === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => onTheme(t)}
                                aria-label={`테마 ${t.key}`}
                                className={cn(
                                    "size-9 rounded-full border-2 transition-transform",
                                    active ? "scale-110 border-foreground" : "border-transparent",
                                )}
                                style={{ background: t.coverBg }}
                            >
                                <span className="block size-full rounded-full" style={{ boxShadow: `inset 0 0 0 3px ${t.accent}` }} />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 폰트 (색 테마와 분리) */}
            <div className="flex flex-col gap-2">
                <Label>폰트</Label>
                <div className="flex flex-wrap gap-2">
                    {FONT_OPTIONS.map((f) => {
                        const active = effectiveFont(doc) === f.value;
                        return (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => onFont(f.value)}
                                style={{ fontFamily: fontStack(f.value) }}
                                className={cn(
                                    "rounded-lg border px-4 py-2 text-base transition-colors",
                                    active
                                        ? "border-brand font-semibold ring-2 ring-brand/30"
                                        : "border-border hover:bg-muted/60",
                                )}
                            >
                                {f.label} 가나
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/** 표지 편집 패널 — 제목·부제·지은이, 표지 이미지. (색 테마·폰트는 기본 설정으로 이동) */
function CoverPanel({
    doc,
    isInstructor,
    userId,
    userName,
    onCover,
}: {
    doc: AtelierDoc;
    /** 강사면 표지 모델 선택 가능, 학생은 강사가 정한 모델 표시(읽기 전용). */
    isInstructor: boolean;
    userId: string;
    userName: string;
    onCover: (patch: Partial<AtelierDoc["cover"]>) => void;
}) {
    const [prompt, setPrompt] = useState("");
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // 프롬프트로 표지 이미지를 생성한다 — 모델이 비어 있으면 무료(Pollinations FLUX),
    // 강사가 유료 모델을 골랐으면 스튜디오(OpenRouter)로 생성하고 크레딧을 기록한다.
    async function genCover() {
        if (!prompt.trim()) {
            toast.error("표지 그림 설명을 입력해 주세요.");
            return;
        }
        setBusy(true);
        try {
            if (doc.cover.model) {
                const res = await studioGenerate({
                    category: "image",
                    model: doc.cover.model,
                    modelLabel: doc.cover.modelLabel || doc.cover.model,
                    prompt: prompt.trim(),
                    userId: userId || undefined,
                    userName: userName || undefined,
                });
                onCover({ image: res.output });
                toast.success(
                    res.free
                        ? "무료로 표지 그림을 만들었어요."
                        : `표지 그림 생성 · ${formatCredits(res.credits)} 크레딧`,
                );
            } else {
                const res = await generateImage(prompt.trim());
                onCover({ image: res.dataUrl });
                toast.success("표지 그림을 만들었어요. (무료)");
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "표지 생성에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    }

    // 파일을 올려 표지 이미지로 쓴다.
    async function uploadCover(file: File) {
        setBusy(true);
        try {
            const att = await uploadFile(file);
            onCover({ image: att.url });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "업로드에 실패했습니다.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">표지</h2>
                <span className="text-xs text-muted-foreground">책 첫 장에 보여요</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cover-title">제목</Label>
                    <Input
                        id="cover-title"
                        value={doc.cover.title}
                        onChange={(e) => onCover({ title: e.target.value })}
                        placeholder="작품 제목"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cover-author">지은이</Label>
                    <Input
                        id="cover-author"
                        value={doc.cover.author}
                        onChange={(e) => onCover({ author: e.target.value })}
                        placeholder="이름"
                    />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="cover-subtitle">부제</Label>
                    <Input
                        id="cover-subtitle"
                        value={doc.cover.subtitle}
                        onChange={(e) => onCover({ subtitle: e.target.value })}
                        placeholder="부제(선택)"
                    />
                </div>
            </div>

            {/* 표지 이미지 */}
            <div className="flex flex-col gap-2">
                <Label>표지 그림 (선택)</Label>
                {doc.cover.image ? (
                    <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={doc.cover.image} alt="표지" className="h-20 w-16 rounded-md object-cover ring-1 ring-border" />
                        <Button variant="outline" size="sm" onClick={() => onCover({ image: null })}>
                            <X />그림 제거
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <CoverModelPicker
                            model={doc.cover.model}
                            modelLabel={doc.cover.modelLabel}
                            authoring={isInstructor}
                            onChange={(m, l) => onCover({ model: m || undefined, modelLabel: l || undefined })}
                        />
                        <div className="flex gap-2">
                            <Input
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="표지 그림 설명 (예: 별이 빛나는 밤하늘)"
                                disabled={busy}
                            />
                            <Button variant="outline" onClick={genCover} disabled={busy} className="shrink-0">
                                {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                                AI 생성
                            </Button>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                            <Upload />파일 업로드
                        </Button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void uploadCover(f);
                                e.target.value = "";
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/** 표지 그림 생성 모델 선택 — 무료(Pollinations FLUX) + 스튜디오(OpenRouter) 이미지 모델.
 *  강사만 고를 수 있고(authoring), 학생은 강사가 정한(또는 기본 무료) 모델을 칩으로 본다. */
function CoverModelPicker({
    model,
    modelLabel,
    authoring,
    onChange,
}: {
    model?: string;
    modelLabel?: string;
    authoring: boolean;
    onChange: (model: string, label: string) => void;
}) {
    const { catalog, loading } = useStudioCatalog();
    const imageModels = (catalog?.models ?? []).filter((m) => m.category === "image");
    const hasKey = catalog?.hasKey ?? false;
    const isFree = !model;
    const currentLabel = isFree ? "무료 · FLUX" : modelLabel || model;

    // 학생 — 강사가 정한(또는 기본 무료) 표지 모델을 읽기 전용 칩으로 보여 준다.
    if (!authoring) {
        return (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <Bot className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{currentLabel}</span>
                <Lock className="ml-auto size-3 text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-1.5 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Bot className="size-3.5" />
                표지 그림 모델 — 무료(FLUX) 또는 유료(강사 선택)
            </div>
            <Select
                value={isFree ? FREE_COVER_ID : model}
                onValueChange={(v) => {
                    const id = String(v);
                    if (id === FREE_COVER_ID) {
                        onChange("", "");
                    } else {
                        const f = imageModels.find((m) => m.id === id);
                        onChange(id, f?.label ?? id);
                    }
                }}
            >
                <SelectTrigger className="w-full" disabled={loading}>
                    <SelectValue placeholder={loading ? "모델 불러오는 중…" : "모델 선택"}>
                        {currentLabel}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                    <SelectItem value={FREE_COVER_ID}>
                        <span className="flex items-center gap-1.5 font-medium">
                            무료 · FLUX
                            <span className="rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                                무료
                            </span>
                        </span>
                    </SelectItem>
                    {imageModels.map((m) => (
                        <SelectItem key={m.id} value={m.id} disabled={!hasKey}>
                            <span className="flex w-full flex-col gap-0.5 py-0.5">
                                <span className="flex items-center gap-1.5 font-medium">
                                    {m.label}
                                    {m.free && (
                                        <span className="rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                                            무료
                                        </span>
                                    )}
                                </span>
                                <span className="text-[11px] text-muted-foreground">{formatModelPrice(m)}</span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {!hasKey && (
                <p className="text-[11px] text-muted-foreground">
                    유료 모델은 OpenRouter API 키가 필요해요. 지금은 무료(FLUX)만 쓸 수 있어요.
                </p>
            )}
        </div>
    );
}

/** 한 쪽(페이지) 편집 카드 — 쪽 제목·정렬·삭제 + 블럭 목록 + 블럭 추가. */
function PageCard({
    page,
    index,
    total,
    onTitle,
    onMovePage,
    onDeletePage,
    onAddBlock,
    onBlockChange,
    onBlockMove,
    onBlockDelete,
    onBlockWidth,
}: {
    page: Page;
    index: number;
    total: number;
    onTitle: (title: string) => void;
    onMovePage: (dir: -1 | 1) => void;
    onDeletePage: () => void;
    onAddBlock: (type: Block["type"], mode?: BlockMode) => void;
    onBlockChange: (block: Block) => void;
    onBlockMove: (blockId: string, dir: -1 | 1) => void;
    onBlockDelete: (blockId: string) => void;
    onBlockWidth: (blockId: string, width: BlockWidth) => void;
}) {
    return (
        <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b px-3 py-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                    {index + 1}
                </span>
                <Input
                    value={page.title}
                    onChange={(e) => onTitle(e.target.value)}
                    placeholder="쪽 제목"
                    className="h-8 flex-1 border-none px-1 shadow-none focus-visible:ring-0"
                />
                <Button variant="ghost" size="icon-sm" onClick={() => onMovePage(-1)} disabled={index === 0} aria-label="쪽 위로">
                    <ChevronUp />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => onMovePage(1)} disabled={index === total - 1} aria-label="쪽 아래로">
                    <ChevronDown />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onDeletePage}
                    disabled={total <= 1}
                    aria-label="쪽 삭제"
                    className="text-destructive"
                >
                    <Trash2 />
                </Button>
            </div>

            <div className="space-y-3 p-3">
                {page.blocks.map((block, bi) => (
                    <BlockCard
                        key={block.id}
                        block={block}
                        first={bi === 0}
                        last={bi === page.blocks.length - 1}
                        onChange={onBlockChange}
                        onMove={(dir) => onBlockMove(block.id, dir)}
                        onDelete={() => onBlockDelete(block.id)}
                        onWidth={(w) => onBlockWidth(block.id, w)}
                    />
                ))}

                <AddBlockMenu onAdd={onAddBlock} />
            </div>
        </div>
    );
}

/** 한 블럭 편집 래퍼 — 종류 라벨·폭 토글·정렬·삭제 + 내부 BlockEdit. */
function BlockCard({
    block,
    first,
    last,
    onChange,
    onMove,
    onDelete,
    onWidth,
}: {
    block: Block;
    first: boolean;
    last: boolean;
    onChange: (block: Block) => void;
    onMove: (dir: -1 | 1) => void;
    onDelete: () => void;
    onWidth: (width: BlockWidth) => void;
}) {
    const m = blockMeta(block.type, "mode" in block ? block.mode : undefined);
    const width = block.width ?? "full";
    return (
        <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="mb-2 flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                <div className="ml-auto flex items-center gap-1">
                    {/* 폭 토글 */}
                    <div className="mr-1 hidden items-center rounded-md border sm:flex">
                        {BLOCK_WIDTH_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                title={opt.title}
                                onClick={() => onWidth(opt.value)}
                                className={cn(
                                    "px-1.5 py-0.5 text-[11px] transition-colors",
                                    width === opt.value ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted/60",
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={first} aria-label="위로">
                        <ChevronUp />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={last} aria-label="아래로">
                        <ChevronDown />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="삭제" className="text-destructive">
                        <Trash2 />
                    </Button>
                </div>
            </div>
            <BlockEdit block={block} onChange={onChange} />
        </div>
    );
}

/** 블럭 추가 드롭다운. */
function AddBlockMenu({ onAdd }: { onAdd: (type: Block["type"], mode?: BlockMode) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="w-full border-dashed" />}>
                <Plus />블럭 추가
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
                {ADD_BLOCKS.map((b) => (
                    <DropdownMenuItem key={b.label} onClick={() => onAdd(b.type, b.mode)}>
                        {b.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

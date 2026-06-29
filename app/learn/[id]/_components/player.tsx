/**
 * 강의 플레이어 컴포넌트 — 페이지 탐색, 블록 학습 작업 저장, AI 채팅 패널을 통합하는 몰입형 학습 인터페이스.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Link2,
    MessageCircle,
    PanelRightClose,
    PanelRightOpen,
    X,
} from "lucide-react";
import type { Block, BlockRun, ChatAttachment, Course, Role, RunCost } from "@/lib/types";
import { groupBlocksIntoRows, blockFlexStyle, blockDomId, blockLabel } from "@/lib/block-layout";
import { courseMaxWidthClass } from "@/lib/course-width";
import { cn } from "@/lib/utils";
import { getMyWork, saveBlockWork, recordProgress } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AccessibilityToolbar } from "@/components/accessibility-toolbar";
import { BlockView } from "@/components/blocks/block-view";
import { CourseChat } from "@/components/course-chat";
import { TocSidebar } from "@/components/toc/toc-sidebar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { Layout, PanelImperativeHandle } from "react-resizable-panels";
import { TITLE_DOM_ID } from "@/lib/toc";

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const m = window.matchMedia(query);
        const onChange = () => setMatches(m.matches);
        onChange();
        m.addEventListener("change", onChange);
        return () => m.removeEventListener("change", onChange);
    }, [query]);
    return matches;
}

/** blockId → BlockRun[] (최신순) 맵 */
type HistoryMap = Map<string, BlockRun[]>;

export function Player({
    initial,
    userId,
    role,
    programId,
}: {
    initial: Course;
    userId: string | null;
    role: Role | null;
    programId: string | null;
}) {
    const isStudent = role === "student" && !!userId;

    // 로컬 코스 상태 (학생이 프롬프트·결과 수정 시 갱신)
    const [course, setCourse] = useState<Course>(initial);
    const [pageIdx, setPageIdx] = useState(0);
    const [showChatMobile, setShowChatMobile] = useState(false);
    const [chatVisible, setChatVisible] = useState(true);

    // 블럭 우클릭 컨텍스트 메뉴 — 대상 블럭 id와 화면 좌표(없으면 닫힘).
    const [blockMenu, setBlockMenu] = useState<{ blockId: string; x: number; y: number } | null>(null);
    // 블럭 우클릭으로 만든 채팅 첨부 대기열 — CourseChat이 소비 후 비운다.
    const [chatInject, setChatInject] = useState<ChatAttachment[]>([]);
    // 채팅 링크 클릭으로 방금 이동한 블럭 id — 잠시 하이라이트(어디인지 표시) 후 해제.
    const [flashBlockId, setFlashBlockId] = useState<string | null>(null);
    // 페이지 전환 후 스크롤해야 할 블럭 id(전환 직후 effect에서 소비).
    const pendingBlockScrollRef = useRef<string | null>(null);
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // blockId → history 맵 (학생 전용)
    const [historyMap, setHistoryMap] = useState<HistoryMap>(new Map());

    // 진행률 중복 호출 방지: 마지막으로 recordProgress한 pageIdx
    const lastRecordedPageRef = useRef<number | null>(null);

    // 프롬프트 변경 디바운스 타이머 (blockId → timeout)
    const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const isLg = useMediaQuery("(min-width: 1024px)");

    // 리사이즈 패널 명령형 핸들 — 채팅 패널(접힘/펼침)과 그룹(레이아웃 복원)용.
    const chatPanelRef = useRef<PanelImperativeHandle | null>(null);
    // 접힘/펼침 애니메이션을 위해 패널 루트 DOM(flex-grow 변경 대상)을 참조한다.
    const chatPanelElRef = useRef<HTMLDivElement | null>(null);
    const lectureElRef = useRef<HTMLDivElement | null>(null);
    // 애니메이션 중 폭을 고정해 reflow를 막을 채팅 내용 래퍼.
    const chatInnerRef = useRef<HTMLDivElement | null>(null);
    // 정리해야 할 트랜지션 종료 타이머.
    const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 저장된 폭을 첫 렌더에서 한 번만 읽어 둔다(SSR에선 null). 마운트 시 onLayoutChanged가
    // 기본 폭으로 덮어쓰기 전에 확보해야 하므로 effect가 아닌 초기화 단계에서 읽는다.
    const [savedLayout] = useState<Layout | null>(() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = window.localStorage.getItem("learn-chat-layout");
            return raw ? (JSON.parse(raw) as Layout) : null;
        } catch {
            return null;
        }
    });
    // 레이아웃 확정(드래그 종료) 시 호출 — 채팅 폭을 localStorage에 저장해 다음 방문 때 복원.
    // 접힌 상태(0%)는 저장하지 않는다 — 마지막 실제 폭을 보존해 펼침·다음 방문 때 복원.
    const handleLayout = useCallback((layout: Layout) => {
        if ((layout.chat ?? 0) <= 0) return;
        try {
            window.localStorage.setItem("learn-chat-layout", JSON.stringify(layout));
        } catch {/* 저장 실패는 무시 */}
    }, []);

    // chatVisible ↔ 패널 접힘 상태 동기화(토글 버튼이 패널을 접고/편다).
    // 접고/펼 때 폭 변화량에 비례한 시간으로 flex-grow를 트랜지션해 부드럽게 움직인다.
    // (드래그 중에는 트랜지션이 없어야 즉각 반응하므로, 토글 직후에만 잠시 적용 후 제거.)
    useEffect(() => {
        const panel = chatPanelRef.current;
        if (!panel) return;

        const collapsing = !chatVisible && !panel.isCollapsed();
        const expanding = chatVisible && panel.isCollapsed();
        if (!collapsing && !expanding) return;

        const chatEl = chatPanelElRef.current;
        const lectureEl = lectureElRef.current;
        const innerEl = chatInnerRef.current;
        const groupW = chatEl?.parentElement?.getBoundingClientRect().width ?? 0;

        // 현재 채팅 폭(flex-grow ≈ %) → 목표 폭. 펼침 목표는 저장/기본 폭으로 추정.
        const curPct = chatEl ? parseFloat(getComputedStyle(chatEl).flexGrow) || 0 : 0;
        let targetPct = 0;
        if (expanding) {
            try {
                const raw = window.localStorage.getItem("learn-chat-layout");
                targetPct = raw ? ((JSON.parse(raw) as Layout).chat ?? 28) : 28;
            } catch {
                targetPct = 28;
            }
        }
        const delta = Math.abs(targetPct - curPct);
        // 변화량 1%당 8ms, 최소 160ms · 최대 480ms.
        const dur = Math.min(480, Math.max(160, Math.round(delta * 8)));
        const transition = `flex-grow ${dur}ms cubic-bezier(0.4, 0, 0.2, 1)`;

        // 내용 폭을 최종 펼침 폭(px)으로 고정 → 패널이 좁아져도 reflow 없이 미닫이처럼 가려진다.
        if (innerEl) {
            const fixedPx = expanding
                ? Math.round((targetPct / 100) * groupW)
                : Math.round(chatEl?.getBoundingClientRect().width ?? 0);
            if (fixedPx > 0) innerEl.style.width = `${fixedPx}px`;
        }

        if (chatEl) chatEl.style.transition = transition;
        if (lectureEl) lectureEl.style.transition = transition;

        if (expanding) panel.expand();
        else panel.collapse();

        if (animTimerRef.current) clearTimeout(animTimerRef.current);
        animTimerRef.current = setTimeout(() => {
            // 애니메이션 종료 후 트랜지션·고정폭 제거 — 이후 드래그가 1:1로 따라오게 한다.
            if (chatEl) chatEl.style.transition = "";
            if (lectureEl) lectureEl.style.transition = "";
            if (innerEl) innerEl.style.width = "";
        }, dur + 40);
    }, [chatVisible]);

    // 언마운트 시 애니메이션 타이머 정리.
    useEffect(() => {
        return () => {
            if (animTimerRef.current) clearTimeout(animTimerRef.current);
        };
    }, []);

    const total = course.pages.length;
    const page = course.pages[pageIdx] ?? course.pages[0];

    // 강사가 고른 본문 가로 폭 — 학생은 이 폭 그대로 본다(미설정이면 기본 3xl).
    const bodyWidthClass = courseMaxWidthClass(course.maxWidth);

    // 뒤로가기 목적지 — 강좌(프로그램) 안에서 열렸으면 해당 강좌 상세로, 아니면 강좌 목록으로.
    const backHref = programId ? `/programs/${programId}` : "/programs";
    const backLabel = programId ? "강좌로 돌아가기" : "강좌 목록으로";
    const backTooltip = programId ? "강좌로" : "강좌 목록";

    // ── 학생 복원: 마운트 시 getMyWork → 블럭에 current 주입 ──────────────
    useEffect(() => {
        if (!isStudent) return;
        let active = true;

        getMyWork(userId!, course.id)
            .then((works) => {
                if (!active) return;

                // historyMap 구성
                const newMap: HistoryMap = new Map();
                for (const w of works) {
                    newMap.set(w.blockId, w.history ?? []);
                }
                setHistoryMap(newMap);

                // 각 블럭에 current 주입
                if (works.length === 0) return;
                setCourse((prev) => ({
                    ...prev,
                    pages: prev.pages.map((p) => ({
                        ...p,
                        blocks: p.blocks.map((b) => {
                            const w = works.find((wk) => wk.blockId === b.id);
                            if (!w) return b;
                            const c = w.current;
                            if (b.type === "image") {
                                return {
                                    ...b,
                                    prompt: c.prompt,
                                    imageUrl: c.result,
                                    genMs: c.genMs,
                                    seed: c.seed ?? b.seed,
                                };
                            }
                            if (b.type === "llm") {
                                return {
                                    ...b,
                                    prompt: c.prompt,
                                    output: c.result,
                                    genMs: c.genMs,
                                };
                            }
                            if (b.type === "video" || b.type === "audio") {
                                return { ...b, prompt: c.prompt, url: c.result ?? b.url, genMs: c.genMs };
                            }
                            return b;
                        }),
                    })),
                }));
            })
            .catch(() => {
                // 복원 실패는 조용히 무시 — 빈 상태로 시작
            });

        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 진행률 기록 ──────────────────────────────────────────────────────────
    const doRecordProgress = useCallback(
        (idx: number) => {
            if (!isStudent) return;
            if (lastRecordedPageRef.current === idx) return; // 중복 스킵
            lastRecordedPageRef.current = idx;
            recordProgress({
                userId: userId!,
                lessonId: course.id,
                programId: programId ?? undefined,
                page: idx,
                totalPages: total,
            }).catch(() => {/* 조용히 무시 */});
        },
        [isStudent, userId, course.id, programId, total],
    );

    // 마운트 시 초기 진행률
    useEffect(() => {
        doRecordProgress(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 페이지 이동 ──────────────────────────────────────────────────────────
    const go = useCallback(
        (i: number) => {
            const next = Math.max(0, Math.min(total - 1, i));
            setPageIdx(next);
            doRecordProgress(next);
        },
        [total, doRecordProgress],
    );
    const prev = useCallback(() => go(pageIdx - 1), [go, pageIdx]);
    const next = useCallback(() => go(pageIdx + 1), [go, pageIdx]);

    // ── 채팅 ↔ 블럭 연동 ──────────────────────────────────────────────────────
    // 지정 블럭으로 부드럽게 스크롤하고 잠시 하이라이트해 위치를 알려 준다.
    const scrollToBlock = useCallback((blockId: string) => {
        const el = document.getElementById(blockDomId(blockId));
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setFlashBlockId(blockId);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashBlockId(null), 1600);
    }, []);

    // 채팅 링크 클릭 → 해당 페이지로 전환한 뒤 그 블럭으로 이동한다.
    const navigateToBlock = useCallback(
        (pIdx: number, blockId: string) => {
            if (pIdx === pageIdx) {
                scrollToBlock(blockId);
            } else {
                pendingBlockScrollRef.current = blockId;
                go(pIdx);
            }
        },
        [pageIdx, go, scrollToBlock],
    );

    // 블럭 우클릭 "채팅에 링크" → blockref 첨부를 채팅 입력에 주입하고 채팅을 연다.
    const linkBlockToChat = useCallback(
        (block: Block) => {
            const att: ChatAttachment = {
                type: "blockref",
                url: "",
                name: blockLabel(block),
                pageIdx,
                blockId: block.id,
            };
            setChatInject((prev) => [...prev, att]);
            if (isLg) setChatVisible(true);
            else setShowChatMobile(true);
            setBlockMenu(null);
        },
        [pageIdx, isLg],
    );

    // 컨텍스트 메뉴가 열려 있는 동안 바깥 클릭·Esc·스크롤·리사이즈 시 닫는다.
    useEffect(() => {
        if (!blockMenu) return;
        function close() {
            setBlockMenu(null);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") close();
        }
        window.addEventListener("click", close);
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("click", close);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
            window.removeEventListener("keydown", onKey);
        };
    }, [blockMenu]);

    // ── 저장 헬퍼 ────────────────────────────────────────────────────────────
    function persistBlockWork(
        blockId: string,
        blockType: "image" | "video" | "audio" | "llm",
        run: BlockRun,
        appendHistory: boolean,
    ) {
        if (!isStudent) return;
        saveBlockWork({
            userId: userId!,
            lessonId: course.id,
            blockId,
            blockType,
            run,
            appendHistory,
        })
            .then((saved) => {
                // 서버 반환 history로 맵 갱신
                setHistoryMap((prev) => new Map(prev).set(blockId, saved.history ?? []));
            })
            .catch(() => {/* 조용히 무시 */});
    }

    // ── 블럭 업데이트 + 저장 로직 ────────────────────────────────────────────
    // skipHistory=true면 생성 기록(history) 추가/저장 로직을 건너뛴다(예: 히스토리 복원).
    function updateBlock(id: string, nb: Block, skipHistory = false) {
        setCourse((prevC) => {
            // 이전 블럭 상태를 찾아 결과가 바뀌었는지 판단
            let prevBlock: Block | undefined;
            for (const p of prevC.pages) {
                const found = p.blocks.find((b) => b.id === id);
                if (found) { prevBlock = found; break; }
            }

            if (!skipHistory && isStudent && prevBlock && ((nb.type === "image" || nb.type === "llm") || ((nb.type === "video" || nb.type === "audio") && (nb.mode ?? "gen") === "gen"))) {
                const prevResult =
                    prevBlock.type === "image" ? prevBlock.imageUrl :
                    prevBlock.type === "llm" ? prevBlock.output :
                    prevBlock.type === "video" || prevBlock.type === "audio" ? prevBlock.url :
                    null;
                const newResult =
                    nb.type === "image" ? nb.imageUrl :
                    nb.type === "llm" ? nb.output :
                    nb.type === "video" || nb.type === "audio" ? nb.url :
                    null;

                const resultChanged = newResult !== prevResult && newResult !== null;

                // 블럭 카드가 실어 준 직전 생성 비용(lastRun). 결과가 같은 한(프롬프트만 고쳐도)
                // 그 결과의 비용은 동일하므로 두 저장 경로 모두에 같은 비용을 싣는다.
                const lr: RunCost | undefined = (nb as { lastRun?: RunCost }).lastRun;
                const costFields: Partial<BlockRun> = lr
                    ? {
                          credits: lr.credits,
                          krw: lr.krw,
                          costUsd: lr.costUsd,
                          free: lr.free,
                          model: lr.model,
                          modelLabel: lr.modelLabel,
                      }
                    : {};

                if (resultChanged) {
                    // 결과가 새로 생성됨 → appendHistory:true, 로컬 history도 즉시 prepend
                    const run: BlockRun = {
                        prompt: nb.type === "image" ? nb.prompt : nb.type === "llm" ? nb.prompt : (nb.prompt ?? ""),
                        result: newResult,
                        genMs: nb.genMs ?? null,
                        seed: nb.type === "image" ? (nb.seed ?? null) : null,
                        at: Date.now(),
                        ...costFields,
                    };
                    // 로컬 즉시 갱신
                    setHistoryMap((prev) => {
                        const existing = prev.get(id) ?? [];
                        return new Map(prev).set(id, [run, ...existing]);
                    });
                    persistBlockWork(id, nb.type, run, true);
                } else {
                    // 프롬프트 텍스트 변경 → 디바운스 600ms, appendHistory:false
                    const existing = debounceTimers.current.get(id);
                    if (existing) clearTimeout(existing);
                    const timer = setTimeout(() => {
                        const run: BlockRun = {
                            prompt: nb.type === "image" ? nb.prompt : nb.type === "llm" ? nb.prompt : (nb.prompt ?? ""),
                            result: newResult,
                            genMs: nb.genMs ?? null,
                            seed: nb.type === "image" ? (nb.seed ?? null) : null,
                            at: Date.now(),
                            ...costFields,
                        };
                        persistBlockWork(id, nb.type, run, false);
                    }, 600);
                    debounceTimers.current.set(id, timer);
                }
            }

            return {
                ...prevC,
                pages: prevC.pages.map((p, i) =>
                    i === pageIdx
                        ? { ...p, blocks: p.blocks.map((b) => (b.id === id ? nb : b)) }
                        : p,
                ),
            };
        });
    }

    // ── onRestore: 히스토리 항목 클릭 → 블럭 복원 ───────────────────────────
    function handleRestore(blockId: string, run: BlockRun) {
        // 현재 블럭을 찾아 type 파악 후 적용
        for (const p of course.pages) {
            const b = p.blocks.find((bl) => bl.id === blockId);
            if (!b) continue;
            if (b.type === "image") {
                updateBlock(blockId, {
                    ...b,
                    prompt: run.prompt,
                    imageUrl: run.result,
                    genMs: run.genMs,
                    seed: run.seed ?? b.seed,
                }, true);
            } else if (b.type === "llm") {
                updateBlock(blockId, {
                    ...b,
                    prompt: run.prompt,
                    output: run.result,
                    genMs: run.genMs,
                }, true);
            }
            break;
        }
    }

    // ── 키보드 페이지 이동 ───────────────────────────────────────────────────
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const t = e.target as HTMLElement | null;
            if (
                t &&
                (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
            )
                return;
            if (e.key === "ArrowRight") next();
            else if (e.key === "ArrowLeft") prev();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [next, prev]);

    // 페이지 변경 시 — 대기 중인 블럭 타깃이 있으면 그 블럭으로, 없으면 상단으로 스크롤.
    useEffect(() => {
        const target = pendingBlockScrollRef.current;
        if (target) {
            pendingBlockScrollRef.current = null;
            // 새 페이지 article(key=pageIdx)이 그려진 뒤 스크롤한다.
            const t = setTimeout(() => scrollToBlock(target), 60);
            return () => clearTimeout(t);
        }
        document.getElementById("lecture-scroll")?.scrollTo({ top: 0 });
    }, [pageIdx, scrollToBlock]);

    // 언마운트 시 하이라이트 타이머 정리
    useEffect(() => {
        return () => {
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        };
    }, []);

    // 언마운트 시 디바운스 타이머 정리
    useEffect(() => {
        const timers = debounceTimers.current;
        return () => {
            timers.forEach((t) => clearTimeout(t));
        };
    }, []);

    // ── 강의 영역 ─────────────────────────────────────────────────────────────
    const lecture = (
        <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
            {/* 플로팅 컨트롤 — Topbar 제거 대체: 왼쪽 상단 뒤로가기 */}
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label={backLabel}
                            className="absolute left-3 top-3 z-20 size-9 rounded-full bg-background/80 shadow-sm backdrop-blur"
                            render={<Link href={backHref} />}
                        />
                    }
                >
                    <ArrowLeft className="size-5" />
                </TooltipTrigger>
                <TooltipContent>{backTooltip}</TooltipContent>
            </Tooltip>

            {/* 플로팅 컨트롤 — 오른쪽 상단: 글자 크기 + 채팅 토글 */}
            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
                <AccessibilityToolbar className="rounded-full bg-background/80 shadow-sm backdrop-blur" />
                {isLg ? (
                    /* 데스크톱: 채팅 패널 토글 */
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setChatVisible((v) => !v)}
                                    aria-label={chatVisible ? "채팅 숨기기" : "채팅 보이기"}
                                    className="size-9 rounded-full bg-background/80 shadow-sm backdrop-blur"
                                />
                            }
                        >
                            {chatVisible ? (
                                <PanelRightClose className="size-5" />
                            ) : (
                                <PanelRightOpen className="size-5" />
                            )}
                        </TooltipTrigger>
                        <TooltipContent>{chatVisible ? "채팅 숨기기" : "채팅 보이기"}</TooltipContent>
                    </Tooltip>
                ) : (
                    /* 모바일: 채팅 열기 */
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setShowChatMobile(true)}
                                    aria-label="채팅 열기"
                                    className="size-9 rounded-full bg-background/80 shadow-sm backdrop-blur"
                                />
                            }
                        >
                            <MessageCircle className="size-5" />
                        </TooltipTrigger>
                        <TooltipContent>채팅 열기</TooltipContent>
                    </Tooltip>
                )}
            </div>

            <div id="lecture-scroll" className="flex-1 overflow-y-auto">
                <article
                    key={pageIdx}
                    className={cn(
                        "relative mx-auto animate-in fade-in-0 space-y-6 px-4 pb-8 pt-16 duration-200 sm:px-6 sm:pb-12 sm:pt-16",
                        bodyWidthClass,
                    )}
                >
                    <div className="space-y-1">
                        <span className="eyebrow">
                            페이지 {pageIdx + 1} / {total}
                        </span>
                        <h1
                            id={TITLE_DOM_ID}
                            className="scroll-mt-24 text-3xl font-bold tracking-tight sm:text-4xl"
                        >
                            {page.title || "제목 없음"}
                        </h1>
                    </div>

                    {page.blocks.length === 0 ? (
                        <p className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
                            이 페이지에는 아직 내용이 없어요.
                        </p>
                    ) : (
                        groupBlocksIntoRows(page.blocks).map((row) => (
                            <div
                                key={row[0].id}
                                className="space-y-6 md:flex md:space-y-0 md:gap-4 md:items-start"
                            >
                                {row.map((b) => (
                                    <div
                                        key={b.id}
                                        id={blockDomId(b.id)}
                                        data-block-id={b.id}
                                        style={blockFlexStyle(b.width)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setBlockMenu({ blockId: b.id, x: e.clientX, y: e.clientY });
                                        }}
                                        className={cn(
                                            "scroll-mt-20 rounded-lg transition-shadow duration-300",
                                            flashBlockId === b.id &&
                                                "ring-2 ring-primary ring-offset-2 ring-offset-background",
                                        )}
                                    >
                                        <BlockView
                                            block={b}
                                            onChange={(nb) => updateBlock(b.id, nb)}
                                            work={
                                                isStudent &&
                                                ((b.type === "image" && (b.mode ?? "gen") === "gen") ||
                                                    b.type === "llm")
                                                    ? {
                                                            history: historyMap.get(b.id) ?? [],
                                                            onRestore: (run) => handleRestore(b.id, run),
                                                        }
                                                    : undefined
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                    {/* 목차 — 강의 본문 왼쪽 가장자리에 앵커(#lecture-scroll 추적) */}
                    <TocSidebar blocks={page.blocks} title={page.title} scrollRootId="lecture-scroll" />
                </article>
            </div>

            <nav className="shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
                <div className={cn("mx-auto flex items-center gap-3", bodyWidthClass)}>
                    <Button size="lg" variant="outline" onClick={prev} disabled={pageIdx === 0} className="h-12">
                        <ChevronLeft className="size-5" /> 이전
                    </Button>
                    <div className="flex flex-1 flex-col items-center gap-1.5">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {course.pages.map((p, i) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => go(i)}
                                    aria-label={`${i + 1}페이지로 이동`}
                                    aria-current={i === pageIdx}
                                    className={cn(
                                        "size-2.5 rounded-full transition-colors",
                                        i === pageIdx
                                            ? "bg-primary"
                                            : "bg-muted-foreground/30 hover:bg-muted-foreground/60",
                                    )}
                                />
                            ))}
                        </div>
                        <span className="mono text-xs text-muted-foreground">
                            {pageIdx + 1} / {total}
                        </span>
                    </div>
                    <Button size="lg" onClick={next} disabled={pageIdx === total - 1} className="h-12">
                        다음 <ChevronRight className="size-5" />
                    </Button>
                </div>
            </nav>
        </section>
    );

    return (
        <div className="flex h-screen flex-col">
            <div className="flex min-h-0 flex-1">
                {isLg ? (
                    /* 강의 본문 | 채팅 패널 — 경계선(핸들) 드래그로 채팅 폭 조절(폭은 localStorage에 저장). */
                    <ResizablePanelGroup
                        orientation="horizontal"
                        defaultLayout={savedLayout ?? undefined}
                        onLayoutChanged={handleLayout}
                        className="min-h-0 flex-1"
                    >
                        <ResizablePanel
                            id="lecture"
                            elementRef={lectureElRef}
                            defaultSize="72%"
                            minSize="30%"
                            className="min-w-0"
                        >
                            {lecture}
                        </ResizablePanel>
                        {/* 채팅이 보일 때만 드래그 가능한 경계선 노출 */}
                        <ResizableHandle withHandle className={cn(!chatVisible && "hidden")} />
                        <ResizablePanel
                            id="chat"
                            panelRef={chatPanelRef}
                            elementRef={chatPanelElRef}
                            collapsible
                            collapsedSize="0%"
                            defaultSize="28%"
                            minSize="18%"
                            maxSize="48%"
                            className="relative min-w-0 overflow-hidden"
                        >
                            {/* 애니메이션 중 내용 폭을 고정(px)해 줄넘김(reflow)을 막는다.
                                오른쪽 화면 가장자리에 고정(absolute right-0)되어, 패널이 좁아지면
                                왼쪽부터 잘리며 미닫이처럼 닫힌다. 평소엔 w-full이라 드래그에 맞춰 따라온다. */}
                            <div ref={chatInnerRef} className="absolute inset-y-0 right-0 w-full">
                                <CourseChat
                                    courseId={course.id}
                                    className="h-full w-full"
                                    incoming={chatInject}
                                    onIncomingConsumed={() => setChatInject([])}
                                    onNavigateToBlock={navigateToBlock}
                                />
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                ) : (
                    lecture
                )}
            </div>

            {showChatMobile && !isLg && (
                <div className="fixed inset-0 z-50 flex flex-col bg-background">
                    <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                        <span className="font-bold">학생 자랑방</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowChatMobile(false)}
                            aria-label="채팅 닫기"
                        >
                            <X className="size-5" />
                        </Button>
                    </div>
                    <CourseChat
                        courseId={course.id}
                        className="min-h-0 flex-1"
                        incoming={chatInject}
                        onIncomingConsumed={() => setChatInject([])}
                        onNavigateToBlock={navigateToBlock}
                    />
                </div>
            )}

            {/* 블럭 우클릭 컨텍스트 메뉴 — 커서 위치에 떠 "채팅에 링크" 한 항목. */}
            {blockMenu && (
                <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                        top: Math.min(blockMenu.y, window.innerHeight - 56),
                        left: Math.min(blockMenu.x, window.innerWidth - 200),
                    }}
                    className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
                >
                    <button
                        type="button"
                        onClick={() => {
                            const b = page.blocks.find((bl) => bl.id === blockMenu.blockId);
                            if (b) linkBlockToChat(b);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                    >
                        <Link2 className="size-4 shrink-0 text-muted-foreground" />
                        채팅에 링크
                    </button>
                </div>
            )}
        </div>
    );
}

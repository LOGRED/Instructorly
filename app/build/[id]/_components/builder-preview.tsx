/**
 * 빌더 미리보기 — 편집 중인 강의를 학습자 화면처럼 보여 주는 인페이지 미리보기.
 * 생성 블럭을 눌러 봐도 실제 강의 데이터는 건드리지 않도록 로컬 사본을 둔다.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import type { Block, Course } from "@/lib/types";
import { cn } from "@/lib/utils";
import { groupBlocksIntoRows, blockFlexStyle } from "@/lib/block-layout";
import { courseMaxWidthClass } from "@/lib/course-width";
import { Button } from "@/components/ui/button";
import { BlockView } from "@/components/blocks/block-view";

export function BuilderPreview({
    course,
    open,
    startPage,
    onExit,
}: {
    course: Course;
    open: boolean;
    startPage: number;
    onExit: () => void;
}) {
    // 미리보기 전용 로컬 사본 — 생성/입력을 시험해 봐도 원본 강의에 반영되지 않는다.
    const [pages, setPages] = useState(course.pages);
    const [pageIdx, setPageIdx] = useState(startPage);

    // 본문 스크롤 컨테이너 — 페이지 이동 시 상단으로 되돌리기 위해 참조한다.
    const scrollRef = useRef<HTMLDivElement>(null);

    // 미리보기를 열 때마다 최신 강의 내용으로 사본을 새로 만든다.
    useEffect(() => {
        if (!open) return;
        setPages(course.pages);
        setPageIdx(Math.min(startPage, Math.max(0, course.pages.length - 1)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // 페이지 변경 시 본문 스크롤을 상단으로 되돌린다.
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: 0 });
    }, [pageIdx]);

    const total = pages.length;
    const page = pages[pageIdx] ?? pages[0];

    // 학생 화면과 동일한 본문 폭 — 강사가 고른 폭을 미리보기에도 그대로 반영한다.
    const bodyWidthClass = courseMaxWidthClass(course.maxWidth);

    // 현재 페이지의 한 블럭을 로컬 사본에서 교체한다(생성 미리보기용).
    function updateBlock(id: string, nb: Block) {
        setPages((prev) =>
            prev.map((p, i) =>
                i === pageIdx
                    ? { ...p, blocks: p.blocks.map((b) => (b.id === id ? nb : b)) }
                    : p,
            ),
        );
    }

    if (!page) return null;

    return (
        <div className="flex h-full flex-col">
            {/* 미리보기 상단 바 */}
            <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-muted/30 px-4">
                <span className="eyebrow text-muted-foreground">미리보기</span>
                <span className="line-clamp-1 text-sm font-medium">{course.title}</span>
                <Button variant="outline" size="sm" className="ml-auto" onClick={onExit}>
                    <Pencil className="size-4" /> 편집으로
                </Button>
            </div>

            {/* 본문 스크롤 영역 — 학습자 화면과 동일한 폭/여백 */}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <article
                    key={pageIdx}
                    className={cn(
                        "mx-auto animate-in space-y-6 px-4 pt-10 pb-12 duration-200 fade-in-0 sm:px-6",
                        bodyWidthClass,
                    )}
                >
                    <div className="space-y-1">
                        <span className="eyebrow">
                            페이지 {pageIdx + 1} / {total}
                        </span>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
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
                                    <div key={b.id} style={blockFlexStyle(b.width)}>
                                        <BlockView block={b} onChange={(nb) => updateBlock(b.id, nb)} />
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </article>
            </div>

            {/* 페이지 네비게이션 */}
            <nav className="shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
                <div className={cn("mx-auto flex items-center gap-3", bodyWidthClass)}>
                    <Button
                        size="lg"
                        variant="outline"
                        onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
                        disabled={pageIdx === 0}
                        className="h-11"
                    >
                        <ChevronLeft className="size-5" /> 이전
                    </Button>
                    <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5">
                        {pages.map((p, i) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPageIdx(i)}
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
                    <Button
                        size="lg"
                        onClick={() => setPageIdx((i) => Math.min(total - 1, i + 1))}
                        disabled={pageIdx === total - 1}
                        className="h-11"
                    >
                        다음 <ChevronRight className="size-5" />
                    </Button>
                </div>
            </nav>
        </div>
    );
}

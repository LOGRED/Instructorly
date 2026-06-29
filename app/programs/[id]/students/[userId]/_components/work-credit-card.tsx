/**
 * 작품 크레딧 카드 — 수강생의 AI 블럭 작품 한 건(결과·프롬프트·크레딧·이력)을 표시한다.
 */
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";

import type { StudentBlockWork, BlockRun } from "@/lib/types";
import { WORK_KIND_LABEL, WORK_KIND_EMOJI } from "@/lib/works";
import { formatCredits, formatKrw, creditsToKrw } from "@/lib/credits";
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/markdown";

// 한 BlockRun 의 크레딧 합산값을 구한다(없으면 0).
function runCredits(run: BlockRun): number {
    return run.credits ?? 0;
}

// 작품 전체 크레딧 합산 — history 가 있으면 history 를 기준으로, 없으면 current 를 쓴다.
export function workTotalCredits(work: StudentBlockWork): number {
    if (work.history.length > 0) {
        return work.history.reduce((sum, r) => sum + runCredits(r), 0);
    }
    return runCredits(work.current);
}

// BlockRun 의 생성 시각을 "M월 D일 HH:MM" 형식으로 포맷한다.
function formatAt(at: number): string {
    return new Date(at).toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// BlockRun 의 크레딧 라인을 렌더한다(무료 / 크레딧+원화).
function RunCreditLine({ run }: { run: BlockRun }) {
    if (run.free) {
        return <span className="text-xs text-muted-foreground">무료</span>;
    }
    const cr = runCredits(run);
    if (cr === 0) {
        return <span className="text-xs text-muted-foreground">—</span>;
    }
    return (
        <span className="text-xs text-muted-foreground tabular-nums">
            {formatCredits(cr)} 크레딧 · {formatKrw(creditsToKrw(cr))}
        </span>
    );
}

// 한 BlockRun 의 결과를 미디어 종류에 맞게 렌더한다.
function RunResultDisplay({
    run,
    blockType,
    compact = false,
}: {
    run: BlockRun;
    blockType: "image" | "video" | "audio" | "llm";
    compact?: boolean;
}) {
    return (
        <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-4"}>
            {/* 프롬프트 */}
            <div className="flex flex-col gap-1">
                <span className="eyebrow text-xs">프롬프트</span>
                <p className={`whitespace-pre-wrap break-words ${compact ? "text-sm text-muted-foreground" : "text-base leading-relaxed"}`}>
                    {run.prompt || <span className="italic text-muted-foreground">프롬프트 없음</span>}
                </p>
            </div>

            {/* 결과 */}
            {run.result && (
                <div className="flex flex-col gap-1">
                    <span className="eyebrow text-xs">생성 결과</span>
                    {blockType === "image" ? (
                        <img
                            src={run.result}
                            alt="생성된 이미지"
                            className={`rounded-lg border object-cover ${compact ? "max-h-36 w-auto" : "max-h-80 w-auto"}`}
                        />
                    ) : blockType === "video" ? (
                        <video
                            src={run.result}
                            controls
                            className={`w-full rounded-lg border ${compact ? "max-h-40" : "max-h-80"}`}
                        />
                    ) : blockType === "audio" ? (
                        <WaveformPlayer src={run.result} className="w-full" />
                    ) : (
                        <div className={`rounded-lg border bg-muted/30 p-4 ${compact ? "text-sm" : ""}`}>
                            <Markdown>{run.result}</Markdown>
                        </div>
                    )}
                </div>
            )}

            {/* 메타: 크레딧 + 일시 */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <RunCreditLine run={run} />
                <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatAt(run.at)}
                </span>
                {run.modelLabel && (
                    <span className="truncate">{run.modelLabel}</span>
                )}
            </div>
        </div>
    );
}

interface WorkCreditCardProps {
    work: StudentBlockWork;
}

// 작품 크레딧 카드 컴포넌트 — 블럭 타입 배지, 결과 미리보기, 크레딧 합산, 이력 토글.
export function WorkCreditCard({ work }: WorkCreditCardProps) {
    const [historyOpen, setHistoryOpen] = useState(false);
    const hasHistory = work.history.length > 0;
    const totalCredits = workTotalCredits(work);
    const label = WORK_KIND_LABEL[work.blockType];
    const emoji = WORK_KIND_EMOJI[work.blockType];
    // 성공 생성은 current 가 곧 history[0] 이므로 history 길이가 실제 실행 횟수다.
    // 옛 기록(history 비었는데 결과 있음)만 1회로 센다.
    const runCount = work.history.length || (work.current.result ? 1 : 0);

    return (
        <div className="flex flex-col gap-4 rounded-xl border bg-background p-5">
            {/* 헤더: 타입 배지 + 크레딧 합계 + 실행 횟수 */}
            <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="mono text-xs gap-1">
                    <span>{emoji}</span>
                    <span>{label}</span>
                </Badge>
                <span className="mono text-xs text-muted-foreground">#{work.blockId.slice(-6)}</span>
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                    {totalCredits > 0 && (
                        <span className="tabular-nums font-medium text-foreground">
                            {formatCredits(totalCredits)} 크레딧
                        </span>
                    )}
                    <span>{runCount}회 실행</span>
                </div>
            </div>

            <Separator />

            {/* 최신 실행 결과 */}
            <RunResultDisplay run={work.current} blockType={work.blockType} />

            {/* 이력 토글 */}
            {hasHistory && (
                <>
                    <Separator />
                    <button
                        type="button"
                        onClick={() => setHistoryOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm font-medium hover:bg-muted/50 transition-colors"
                    >
                        <span className="flex items-center gap-1.5">
                            <Clock className="size-3.5 text-muted-foreground" />
                            이전 기록 {work.history.length}회
                        </span>
                        {historyOpen ? (
                            <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                    </button>

                    {historyOpen && (
                        <div className="flex flex-col gap-4 border-l-2 border-border pl-3">
                            {work.history.map((run, idx) => (
                                <div key={run.at + idx} className="flex flex-col gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {work.history.length - idx}번째 기록
                                    </span>
                                    <RunResultDisplay run={run} blockType={work.blockType} compact />
                                    {idx < work.history.length - 1 && <Separator />}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

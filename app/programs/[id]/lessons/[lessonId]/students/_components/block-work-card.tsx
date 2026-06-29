/**
 * 블럭 작업 카드 — 수강생 한 명의 AI/이미지 블럭 실행 결과(최신 + 이력)를 펼쳐 보여 준다.
 */
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, Image as ImageIcon, Music, PenLine, Video } from "lucide-react";

import type { StudentBlockWork, BlockRun } from "@/lib/types";
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/markdown";

function formatTime(ms: number | null): string {
    if (ms === null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}초`;
}

function formatAt(at: number): string {
    return new Date(at).toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

interface RunDisplayProps {
    run: BlockRun;
    blockType: "image" | "video" | "audio" | "llm";
    compact?: boolean;
}

function RunDisplay({ run, blockType, compact = false }: RunDisplayProps) {
    return (
        <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-4"}>
            {/* 프롬프트 */}
            <div className="flex flex-col gap-1.5">
                <span className="eyebrow text-xs">프롬프트</span>
                <p className={`whitespace-pre-wrap break-words ${compact ? "text-sm text-muted-foreground" : "text-base leading-relaxed"}`}>
                    {run.prompt || <span className="text-muted-foreground italic">프롬프트 없음</span>}
                </p>
            </div>

            {/* 결과 */}
            {run.result && (
                <div className="flex flex-col gap-1.5">
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

            {/* 메타: 생성시간 + 일시 */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatTime(run.genMs)}
                </span>
                <span>{formatAt(run.at)}</span>
            </div>
        </div>
    );
}

interface BlockWorkCardProps {
    work: StudentBlockWork;
}

export function BlockWorkCard({ work }: BlockWorkCardProps) {
    const [historyOpen, setHistoryOpen] = useState(false);
    const hasHistory = work.history.length > 0;

    return (
        <div className="flex flex-col gap-4 rounded-xl border bg-background p-5">
            {/* 블럭 헤더 */}
            <div className="flex items-center gap-2">
                {work.blockType === "image" ? (
                    <ImageIcon className="size-4 text-muted-foreground" />
                ) : work.blockType === "video" ? (
                    <Video className="size-4 text-muted-foreground" />
                ) : work.blockType === "audio" ? (
                    <Music className="size-4 text-muted-foreground" />
                ) : (
                    <PenLine className="size-4 text-muted-foreground" />
                )}
                <Badge variant="outline" className="mono text-xs">
                    {work.blockType === "image"
                        ? "이미지"
                        : work.blockType === "video"
                            ? "동영상"
                            : work.blockType === "audio"
                                ? "오디오"
                                : "AI 글쓰기"}
                </Badge>
                <span className="mono text-xs text-muted-foreground">#{work.blockId.slice(-6)}</span>
            </div>

            <Separator />

            {/* 현재(최신) 작업 */}
            <RunDisplay run={work.current} blockType={work.blockType} />

            {/* 변경 이력 토글 */}
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
                            기록 {work.history.length}회
                        </span>
                        {historyOpen ? (
                            <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                    </button>

                    {historyOpen && (
                        <div className="flex flex-col gap-4 pl-3 border-l-2 border-border">
                            {work.history.map((run, idx) => (
                                <div key={run.at + idx} className="flex flex-col gap-2">
                                    <span className="text-xs text-muted-foreground font-medium">
                                        {work.history.length - idx}번째 기록
                                    </span>
                                    <RunDisplay run={run} blockType={work.blockType} compact />
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

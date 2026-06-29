/**
 * AI 생성 기록 상세 다이얼로그 — /studio 사용 기록 목록에서 특정 항목을 클릭했을 때
 * 해당 기록의 프롬프트·결과물·비용 등 상세 정보를 표시하는 프레젠테이션 컴포넌트.
 */
"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/markdown";
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { youtubeEmbed } from "@/components/blocks/media-block-card";
import {
    formatCredits,
    formatKrw,
    formatUsd,
    creditsToKrw,
} from "@/lib/credits";
import { cn } from "@/lib/utils";
import {
    FileText,
    ImageIcon,
    Video,
    Music,
    Coins,
    Timer,
    Loader2,
    Bot,
} from "lucide-react";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

/** AI 생성 카테고리 종류 */
export type StudioCategory = "text" | "image" | "video" | "audio";

/** 사용 기록 상세 데이터 */
export interface UsageRecordDetail {
    id: string;
    userName: string;
    category: StudioCategory;
    kind: StudioCategory | "";
    modelLabel: string;
    prompt: string;
    output: string | null;
    credits: number;
    costUsd: number;
    genMs: number;
    createdAt: number;
}

// ─── 카테고리 아이콘 맵 ───────────────────────────────────────────────────────

/** 카테고리에 대응하는 아이콘 컴포넌트와 색상 클래스를 반환한다. */
function getCategoryIcon(
    category: StudioCategory | undefined
): { Icon: React.ElementType; colorClass: string } {
    switch (category) {
        case "text":
            return { Icon: FileText, colorClass: "text-blue-500" };
        case "image":
            return { Icon: ImageIcon, colorClass: "text-violet-500" };
        case "video":
            return { Icon: Video, colorClass: "text-rose-500" };
        case "audio":
            return { Icon: Music, colorClass: "text-amber-500" };
        default:
            return { Icon: Bot, colorClass: "text-muted-foreground" };
    }
}

// ─── 결과물 렌더러 ────────────────────────────────────────────────────────────

/** record.kind에 따라 적절한 결과물 UI를 렌더한다. */
function ResultRenderer({
    kind,
    output,
}: {
    kind: StudioCategory | "";
    output: string;
}): React.ReactElement {
    if (kind === "text") {
        return (
            <div className="max-h-[40vh] overflow-y-auto rounded-lg border p-3">
                <div className="maketor-prose">
                    <Markdown>{output}</Markdown>
                </div>
            </div>
        );
    }

    if (kind === "image") {
        return (
            <img
                src={output}
                alt="생성 이미지"
                className="w-full rounded-lg border"
            />
        );
    }

    if (kind === "video") {
        const yt = youtubeEmbed(output);
        if (yt) {
            return (
                <div className="aspect-video overflow-hidden rounded-lg border">
                    <iframe
                        src={yt}
                        className="h-full w-full"
                        allowFullScreen
                        title="동영상"
                    />
                </div>
            );
        }
        return (
            <video
                src={output}
                controls
                className="w-full rounded-lg border"
            />
        );
    }

    if (kind === "audio") {
        return <WaveformPlayer src={output} className="w-full" />;
    }

    // 알 수 없는 kind — 빈 fragment 대신 빈 div 반환
    return <div />;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

/** AI 생성 기록 하나의 상세 내용을 다이얼로그로 표시한다. */
export function UsageRecordDialog({
    open,
    onOpenChange,
    record,
    loading = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record: UsageRecordDetail | null;
    loading?: boolean;
}): React.ReactElement | null {
    const { Icon, colorClass } = getCategoryIcon(record?.category);

    /** createdAt 타임스탬프를 한국어 날짜·시간 문자열로 포맷한다. */
    const formattedDate = record
        ? new Date(record.createdAt).toLocaleString("ko-KR", {
              dateStyle: "medium",
              timeStyle: "short",
          })
        : "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                {/* 헤더 */}
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <Icon className={cn("size-5 shrink-0", colorClass)} />
                        <DialogTitle>
                            {record?.modelLabel ?? ""}
                        </DialogTitle>
                    </div>
                    {record && (
                        <p className="text-xs text-muted-foreground">
                            {formattedDate} · {record.userName}
                        </p>
                    )}
                </DialogHeader>

                {record && (
                    <div className="flex flex-col gap-4">
                        {/* 프롬프트 섹션 */}
                        <section className="flex flex-col gap-1.5">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                프롬프트
                            </h3>
                            <div className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">
                                {record.prompt}
                            </div>
                        </section>

                        {/* 결과물 섹션 */}
                        <section className="flex flex-col gap-1.5">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                결과물
                            </h3>

                            {loading ? (
                                <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                                    <Loader2 className="size-5 animate-spin" />
                                    결과물을 불러오는 중…
                                </div>
                            ) : !record.output || record.kind === "" ? (
                                <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                                    이 기록에는 저장된 결과물이 없습니다. (예전 기록이거나 결과가 저장되지 않았어요)
                                </div>
                            ) : (
                                <ResultRenderer
                                    kind={record.kind}
                                    output={record.output}
                                />
                            )}
                        </section>

                        {/* 푸터 메타 정보 */}
                        <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Coins className="size-3.5" />
                                {formatCredits(record.credits)} 크레딧
                                {" "}({formatKrw(creditsToKrw(record.credits))})
                            </span>
                            <span className="flex items-center gap-1">
                                <Timer className="size-3.5" />
                                {(record.genMs / 1000).toFixed(1)}초
                            </span>
                            <span>{formatUsd(record.costUsd)}</span>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * 첨부 렌더링 공용 컴포넌트 — 채팅(course-chat)과 게시물 댓글(post-comments)이
 * 똑같은 모양으로 첨부를 보여 주도록 공유한다. AttachmentPreview는 보낸 첨부를,
 * PendingChip은 전송 대기 중인 첨부 칩을 렌더한다.
 */
"use client";

import * as React from "react";
import { X, FileIcon, Music, Video, Image as ImageIcon, PenLine, Link2 } from "lucide-react";

import { WaveformPlayer } from "@/components/ui/waveform-player";
import { Markdown } from "@/components/markdown";
import type { ChatAttachment } from "@/lib/types";

// 보낸 첨부 하나를 타입별로 알맞게 렌더한다(블럭 링크·AI 글·이미지·영상·오디오·파일).
export function AttachmentPreview({
    attachment,
    onNavigateToBlock,
}: {
    attachment: ChatAttachment;
    onNavigateToBlock?: (pageIdx: number, blockId: string) => void;
}) {
    // 강의 블럭 링크 — 클릭하면 해당 페이지의 해당 블럭으로 이동한다.
    if (attachment.type === "blockref") {
        return (
            <button
                type="button"
                onClick={() => {
                    if (attachment.blockId != null && attachment.pageIdx != null) {
                        onNavigateToBlock?.(attachment.pageIdx, attachment.blockId);
                    }
                }}
                disabled={!onNavigateToBlock}
                className="flex w-full items-center gap-2 rounded-lg border border-primary/40 bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-70"
            >
                <Link2 className="size-4 shrink-0 text-primary" />
                <span className="truncate text-left">{attachment.name}</span>
            </button>
        );
    }
    // AI 글(LLM 결과) — 다운로드 링크 대신 읽기 좋은 글 카드로 보여 준다.
    if (attachment.text) {
        return (
            <div className="w-full rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/30">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <PenLine className="size-3.5" /> AI 글
                </div>
                <Markdown className="max-h-[26rem] overflow-y-auto text-sm leading-relaxed text-foreground">
                    {attachment.text}
                </Markdown>
            </div>
        );
    }
    if (attachment.type === "image") {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={attachment.url}
                alt={attachment.name}
                className="rounded-lg w-full h-auto max-h-80 object-contain"
            />
        );
    }
    if (attachment.type === "video") {
        return (
            <video
                src={attachment.url}
                controls
                className="rounded-lg w-full max-h-80"
            />
        );
    }
    if (attachment.type === "audio") {
        return (
            <div className="flex w-full flex-col gap-1">
                <span className="truncate text-xs text-muted-foreground">
                    {attachment.name}
                </span>
                <WaveformPlayer src={attachment.url} className="w-full" />
            </div>
        );
    }
    return (
        <a
            href={attachment.url}
            download={attachment.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
        >
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{attachment.name}</span>
        </a>
    );
}

// 전송 대기 중인 첨부 한 건을 작은 칩으로 보여 준다(타입 아이콘 + 이름 + 제거 버튼).
export function PendingChip({
    attachment,
    onRemove,
}: {
    attachment: ChatAttachment;
    onRemove: () => void;
}) {
    const Icon =
        attachment.type === "blockref"
            ? Link2
            : attachment.text
                ? PenLine
                : attachment.type === "image"
                    ? ImageIcon
                    : attachment.type === "video"
                        ? Video
                        : attachment.type === "audio"
                            ? Music
                            : FileIcon;

    return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
            <Icon className="size-3 shrink-0" />
            <span className="truncate max-w-[120px]">{attachment.name}</span>
            <button
                type="button"
                onClick={onRemove}
                className="ml-0.5 rounded-sm hover:text-foreground transition-colors"
                aria-label={`${attachment.name} 제거`}
            >
                <X className="size-3" />
            </button>
        </span>
    );
}

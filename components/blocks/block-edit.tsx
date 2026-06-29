"use client";

import type { Block } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageBlockCard } from "./image-block-card";
import { MediaBlockCard } from "./media-block-card";
import { LlmBlockCard } from "./llm-block-card";
import { TextBlockCard } from "./text-block-card";
import { TableBlockCard } from "./table-block-card";
import { ChartBlockCard } from "./chart-block-card";
import { BookmarkBlockCard } from "./bookmark-block-card";

/** Instructor-side editable rendering of a block. The builder wraps this with
  * drag handle / delete chrome; this component owns only the inner editing UI.
  * 미디어 블럭(이미지·동영상·오디오)과 텍스트 블럭은 카드 안 세그먼트 토글로 업로드/직접
  * 작성과 AI 생성을 강사가 자유롭게 오간다. */
export function BlockEdit({
    block,
    onChange,
    autoFocus,
}: {
    block: Block;
    onChange: (b: Block) => void;
    autoFocus?: boolean;
}) {
    switch (block.type) {
        case "heading":
            return (
                <div className="space-y-2">
                    <div className="flex gap-1">
                        {[1, 2, 3].map((lv) => (
                            <Button
                                key={lv}
                                type="button"
                                size="sm"
                                variant={block.level === lv ? "default" : "outline"}
                                onClick={() => onChange({ ...block, level: lv as 1 | 2 | 3 })}
                            >
                                H{lv}
                            </Button>
                        ))}
                    </div>
                    <Input
                        value={block.text}
                        onChange={(e) => onChange({ ...block, text: e.target.value })}
                        placeholder="제목을 입력하세요"
                        autoFocus={autoFocus}
                        className={`h-auto py-2 font-bold ${
              block.level === 1
                ? "text-3xl"
                : block.level === 2
                  ? "text-2xl"
                  : "text-xl"
            }`}
                    />
                </div>
            );
        case "text":
            return <TextBlockCard block={block} onChange={(b) => onChange(b)} autoFocus={autoFocus} />;
        case "quote":
            return (
                <Textarea
                    value={block.text}
                    onChange={(e) => onChange({ ...block, text: e.target.value })}
                    placeholder="인용할 내용을 입력하세요"
                    autoFocus={autoFocus}
                    className="min-h-16 border-l-4 pl-4 italic"
                />
            );
        case "callout":
            return (
                <div className="flex gap-2">
                    <Input
                        value={block.emoji}
                        onChange={(e) => onChange({ ...block, emoji: e.target.value })}
                        className="w-14 shrink-0 text-center text-xl"
                        maxLength={2}
                        aria-label="이모지"
                    />
                    <Textarea
                        value={block.text}
                        onChange={(e) => onChange({ ...block, text: e.target.value })}
                        placeholder="강조할 내용을 입력하세요"
                        autoFocus={autoFocus}
                        className="min-h-16 flex-1"
                    />
                </div>
            );
        case "divider":
            return (
                <div className="py-2">
                    <div className="h-px bg-border" />
                    <p className="mt-1 text-center text-xs text-muted-foreground">구분선</p>
                </div>
            );
        case "table":
            return <TableBlockCard block={block} onChange={(b) => onChange(b)} />;
        case "chart":
            return <ChartBlockCard block={block} onChange={(b) => onChange(b)} />;
        case "bookmark":
            return <BookmarkBlockCard block={block} onChange={(b) => onChange(b)} autoFocus={autoFocus} />;
        case "image":
            return (
                <ImageBlockCard block={block} onChange={(b) => onChange(b)} autoFocusPrompt={autoFocus} />
            );
        case "llm":
            return (
                <LlmBlockCard block={block} onChange={(b) => onChange(b)} autoFocusPrompt={autoFocus} />
            );
        case "video":
            return (
                <MediaBlockCard block={block} onChange={(b) => onChange(b)} kind="video" autoFocusPrompt={autoFocus} />
            );
        case "audio":
            return (
                <MediaBlockCard block={block} onChange={(b) => onChange(b)} kind="audio" autoFocusPrompt={autoFocus} />
            );
    }
}

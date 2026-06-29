"use client";

import type { Block, BlockRun } from "@/lib/types";
import { headingDomId } from "@/lib/toc";
import { Markdown } from "@/components/markdown";
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { Separator } from "@/components/ui/separator";
import { ImageBlockCard } from "./image-block-card";
import { MediaBlockCard, youtubeEmbed } from "./media-block-card";
import { LlmBlockCard } from "./llm-block-card";
import { TableBlockCard } from "./table-block-card";
import { ChartBlockCard } from "./chart-block-card";
import { BookmarkBlockCard } from "./bookmark-block-card";

/** Read-only lecture renderer for students. 생성(gen) 블럭은 상호작용형 —
  * 학습자가 프롬프트를 고쳐 다시 생성할 수 있다. 업로드(upload) 블럭은 읽기 전용으로
  * 보여 주며, 학습자는 절대 업로드할 수 없다(authoring=false). */
export function BlockView({
    block,
    onChange,
    work,
}: {
    block: Block;
    onChange: (b: Block) => void;
    /** 학생 히스토리 — 이 blockId의 history와 onRestore를 카드에 전달. opt-in(없으면 빌더처럼 동작). */
    work?: { history: BlockRun[]; onRestore: (r: BlockRun) => void };
}) {
    switch (block.type) {
        case "heading": {
            const cls =
                block.level === 1
                    ? "text-3xl sm:text-4xl"
                    : block.level === 2
                        ? "text-2xl sm:text-3xl"
                        : "text-xl sm:text-2xl";
            const Tag = `h${block.level}` as "h1" | "h2" | "h3";
            return (
                <Tag id={headingDomId(block.id)} className={`scroll-mt-24 font-bold tracking-tight ${cls}`}>
                    {block.text || "제목 없음"}
                </Tag>
            );
        }
        case "text":
            return <Markdown className="text-lg">{block.markdown}</Markdown>;
        case "quote":
            return (
                <blockquote className="border-l-4 pl-4 text-lg text-muted-foreground italic">
                    {block.text}
                </blockquote>
            );
        case "callout":
            return (
                <div className="flex gap-3 rounded-xl border bg-muted/40 p-4">
                    <span className="text-2xl leading-none">{block.emoji}</span>
                    <div className="text-lg leading-relaxed">{block.text}</div>
                </div>
            );
        case "divider":
            return <Separator className="my-2" />;
        case "table":
            return <TableBlockCard block={block} onChange={(b) => onChange(b)} authoring={false} />;
        case "chart":
            return <ChartBlockCard block={block} onChange={(b) => onChange(b)} authoring={false} />;
        case "bookmark":
            return <BookmarkBlockCard block={block} onChange={(b) => onChange(b)} authoring={false} />;
        case "image": {
            // 업로드 이미지 — 수강생에겐 카드 없이 본문처럼 그대로 보여 준다.
            if ((block.mode ?? "gen") === "upload") {
                return block.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={block.imageUrl} alt={block.prompt || ""} className="w-full rounded-lg" />
                ) : null;
            }
            return (
                <ImageBlockCard
                    block={block}
                    onChange={(b) => onChange(b)}
                    authoring={false}
                    history={work?.history}
                    onRestore={work?.onRestore}
                />
            );
        }
        case "llm":
            return (
                <LlmBlockCard
                    block={block}
                    onChange={(b) => onChange(b)}
                    authoring={false}
                    history={work?.history}
                    onRestore={work?.onRestore}
                />
            );
        case "video": {
            // 업로드 동영상 — 본문처럼 그대로(유튜브는 임베드).
            if ((block.mode ?? "gen") === "upload") {
                if (!block.url) return null;
                const yt = youtubeEmbed(block.url);
                return (
                    <figure className="space-y-2">
                        {yt ? (
                            <div className="aspect-video overflow-hidden rounded-lg">
                                <iframe
                                    src={yt}
                                    className="h-full w-full"
                                    allowFullScreen
                                    title={block.caption || "동영상"}
                                />
                            </div>
                        ) : (
                            <video src={block.url} controls className="w-full rounded-lg" />
                        )}
                        {block.caption && (
                            <figcaption className="text-sm text-muted-foreground">{block.caption}</figcaption>
                        )}
                    </figure>
                );
            }
            return (
                <MediaBlockCard block={block} onChange={(b) => onChange(b)} kind="video" authoring={false} />
            );
        }
        case "audio": {
            // 업로드 오디오 — 본문처럼 그대로.
            if ((block.mode ?? "gen") === "upload") {
                if (!block.url) return null;
                return (
                    <figure className="space-y-2">
                        <WaveformPlayer src={block.url} className="w-full" />
                        {block.caption && (
                            <figcaption className="text-sm text-muted-foreground">{block.caption}</figcaption>
                        )}
                    </figure>
                );
            }
            return (
                <MediaBlockCard block={block} onChange={(b) => onChange(b)} kind="audio" authoring={false} />
            );
        }
    }
}

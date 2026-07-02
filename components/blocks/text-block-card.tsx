/**
 * 텍스트 블럭 카드 — 직접 작성(마크다운)과 AI 생성을 세그먼트 토글로 오간다(강사 전용).
 * AI 생성은 OpenRouter 텍스트 모델로 글을 만들어 마크다운 본문에 채운다. 결과가 일반
 * 텍스트처럼 `markdown`에 저장·렌더되므로 TextBlock 타입이나 직렬화를 바꿀 필요가 없다
 * (학생 화면은 기존대로 마크다운만 읽기 전용으로 보여 준다).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Coins, Bot, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { TextBlock } from "@/lib/types";
import { studioGenerate } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { DEFAULT_BLOCK_MODEL } from "@/lib/blocks";
import { formatCredits, formatKrw } from "@/lib/credits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BlockModelPicker } from "@/components/blocks/block-model-picker";
import { RichTextEditor } from "@/components/blocks/rich-text-editor";
import { cn } from "@/lib/utils";

/** 텍스트 블럭의 강사 편집 카드. 직접 작성/AI 생성 두 보기를 토글한다. */
export function TextBlockCard({
    block,
    onChange,
    autoFocus,
}: {
    block: TextBlock;
    onChange: (b: TextBlock) => void;
    autoFocus?: boolean;
}) {
    const [view, setView] = useState<"write" | "ai">("write");
    const [prompt, setPrompt] = useState("");
    const [model, setModel] = useState(DEFAULT_BLOCK_MODEL.llm.id);
    const [modelLabel, setModelLabel] = useState(DEFAULT_BLOCK_MODEL.llm.label);
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [lastCost, setLastCost] = useState<{ credits: number; krw: number; free: boolean } | null>(null);
    const startRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);

    useEffect(
        () => () => {
            if (timerRef.current) clearInterval(timerRef.current);
        },
        [],
    );

    // 선택한 텍스트 모델로 글을 생성해 마크다운 본문에 채운다(기존 내용을 덮어쓴다).
    async function run() {
        const p = prompt.trim();
        if (!p) {
            toast.error("먼저 프롬프트를 입력해 주세요.");
            return;
        }
        setRunning(true);
        setElapsed(0);
        startRef.current = performance.now();
        timerRef.current = setInterval(() => {
            setElapsed((performance.now() - startRef.current) / 1000);
        }, 100);
        try {
            const res = await studioGenerate({
                category: "text",
                model,
                modelLabel,
                prompt: p,
                userId: userId ?? undefined,
                userName: nickname ?? undefined,
            });
            onChange({ ...block, markdown: res.output });
            setLastCost({ credits: res.credits, krw: res.krw, free: res.free });
            toast.success(
                res.free
                    ? `무료로 글을 만들었어요. (${(res.genMs / 1000).toFixed(1)}초)`
                    : `${formatCredits(res.credits)} 크레딧 사용 · ${(res.genMs / 1000).toFixed(1)}초`,
            );
            // 생성 결과를 바로 다듬을 수 있도록 직접 작성 보기로 전환한다.
            setView("write");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "글 생성에 실패했습니다.");
        } finally {
            if (timerRef.current) clearInterval(timerRef.current);
            setRunning(false);
        }
    }

    const toggle = (
        <div className="flex w-fit items-center gap-0.5 rounded-md bg-muted p-0.5">
            <button
                type="button"
                onClick={() => setView("write")}
                className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                    view === "write"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                )}
            >
                <Pencil className="size-3.5" /> 직접 작성
            </button>
            <button
                type="button"
                onClick={() => setView("ai")}
                className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                    view === "ai"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                )}
            >
                <Bot className="size-3.5" /> AI 생성
            </button>
        </div>
    );

    if (view === "write") {
        return (
            <div className="space-y-2">
                {toggle}
                <RichTextEditor
                    value={block.markdown}
                    onChange={(md) => onChange({ ...block, markdown: md })}
                    autoFocus={autoFocus}
                    placeholder="내용을 입력하세요. 위 버튼으로 굵게·제목·목록을 넣을 수 있어요."
                />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {toggle}
            <BlockModelPicker
                category="text"
                model={model}
                modelLabel={modelLabel}
                authoring
                onChange={(m, l) => {
                    setModel(m);
                    setModelLabel(l);
                }}
            />
            <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="쓰고 싶은 글을 설명하세요. 예: 광합성 과정을 학생에게 3문단으로 설명해줘"
                className="min-h-20 text-base"
                autoFocus={autoFocus}
            />
            <Button onClick={run} disabled={running} size="lg" className="h-11 w-full">
                {running ? (
                    <>
                        <Loader2 className="size-4 animate-spin" /> 쓰는 중...
                    </>
                ) : (
                    <>
                        <Bot className="size-4" /> {block.markdown.trim() ? "다시 생성" : "생성"}
                    </>
                )}
            </Button>
            {block.markdown.trim() && !running && (
                <p className="text-center text-xs text-muted-foreground">
                    생성하면 지금 작성된 내용을 덮어써요.
                </p>
            )}
            {running && (
                <p className="mono text-center text-sm tabular-nums text-muted-foreground">
                    ⏱ {elapsed.toFixed(1)}초 경과
                </p>
            )}
            {lastCost && !running && (
                <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                    <Coins className="size-4 text-amber-500" />
                    {lastCost.free ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">무료 생성</span>
                    ) : (
                        <span>
                            이번 생성 <span className="font-semibold">{formatCredits(lastCost.credits)} 크레딧</span>
                            <span className="text-muted-foreground"> · {formatKrw(lastCost.krw)}</span>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

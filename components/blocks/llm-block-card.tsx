/**
 * AI 글쓰기 블럭 카드 — 강사가 잠근 OpenRouter 텍스트 모델로 글을 생성한다. 학생은
 * 프롬프트만 고쳐 다시 실행할 수 있고, 생성 비용은 크레딧으로 표시·기록된다(사용자별).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { PenLine, Loader2, Timer, History, Coins, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import type { BlockRun, LlmBlock } from "@/lib/types";
import { studioGenerate } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { DEFAULT_BLOCK_MODEL } from "@/lib/blocks";
import { formatCredits, formatKrw } from "@/lib/credits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { BlockModelPicker } from "@/components/blocks/block-model-picker";

/**
  * AI 글쓰기 블럭. 프롬프트는 학생도 고쳐 다시 실행할 수 있고, `onChange`로 상위에 반영된다.
  * `authoring`이면 모델 선택을 편집할 수 있고, 학생이면 잠긴 모델로만 실행한다.
  */
export function LlmBlockCard({
    block,
    onChange,
    authoring = true,
    autoFocusPrompt,
    history,
    onRestore,
}: {
    block: LlmBlock;
    onChange: (b: LlmBlock) => void;
    /** 빌더(강사)면 true — 모델 선택 편집 가능. 학생이면 false — 잠긴 모델 표시만. */
    authoring?: boolean;
    autoFocusPrompt?: boolean;
    /** 학생 히스토리. 주어질 때만 히스토리 버튼 표시(빌더는 전달 안 함). */
    history?: BlockRun[];
    onRestore?: (run: BlockRun) => void;
}) {
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [lastCost, setLastCost] = useState<{ credits: number; krw: number; free: boolean } | null>(null);
    const startRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);

    // 강사가 프롬프트를 고정했고 지금 학생 화면이면 — 수정·실행을 막고 강사 결과만 보여 준다.
    const studentLocked = !authoring && !!block.locked;

    useEffect(
        () => () => {
            if (timerRef.current) clearInterval(timerRef.current);
        },
        [],
    );

    // 강사가 잠근 모델(없으면 기본 모델)로 OpenRouter 텍스트 생성을 실행한다.
    async function run() {
        const prompt = block.prompt.trim();
        if (!prompt) {
            toast.error("먼저 내용을 입력해 주세요.");
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
                model: block.model ?? DEFAULT_BLOCK_MODEL.llm.id,
                modelLabel: block.modelLabel ?? DEFAULT_BLOCK_MODEL.llm.label,
                prompt,
                userId: userId ?? undefined,
                userName: nickname ?? undefined,
            });
            onChange({
                ...block,
                prompt,
                output: res.output,
                genMs: res.genMs,
                // 학생 작업 기록에 이 생성의 크레딧을 싣기 위한 임시 비용 묶음(저장 시 BlockRun으로 옮겨짐).
                lastRun: {
                    credits: res.credits,
                    krw: res.krw,
                    costUsd: res.costUsd,
                    free: res.free,
                    model: block.model ?? DEFAULT_BLOCK_MODEL.llm.id,
                    modelLabel: block.modelLabel ?? DEFAULT_BLOCK_MODEL.llm.label,
                },
            });
            setLastCost({ credits: res.credits, krw: res.krw, free: res.free });
            toast.success(
                res.free
                    ? `무료로 글을 만들었어요. (${(res.genMs / 1000).toFixed(1)}초)`
                    : `${formatCredits(res.credits)} 크레딧 사용 · ${(res.genMs / 1000).toFixed(1)}초`,
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "글 생성에 실패했습니다.");
        } finally {
            if (timerRef.current) clearInterval(timerRef.current);
            setRunning(false);
        }
    }

    const secs = (ms: number) => (ms / 1000).toFixed(1);

    return (
        <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <PenLine className="size-4 text-muted-foreground" />
                <span className="eyebrow">AI 글쓰기</span>
                {/* 강사: 프롬프트 고정 토글 / 학생: 고정됨 표시 */}
                {authoring && (
                    <Button
                        type="button"
                        variant={block.locked ? "default" : "outline"}
                        size="sm"
                        className="ml-auto h-7 gap-1 px-2 text-xs"
                        onClick={() => onChange({ ...block, locked: !block.locked })}
                    >
                        {block.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                        {block.locked ? "고정됨" : "고정"}
                    </Button>
                )}
                {studentLocked && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3.5" /> 선생님 고정
                    </span>
                )}
                {block.genMs != null && !running && (
                    <span className="mono ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Timer className="size-3.5" /> {secs(block.genMs)}초
                    </span>
                )}
            </div>

            <div className="space-y-3 p-4">
                {/* 강사: 모델 선택 / 학생: 잠긴 모델 + 단가 표시 */}
                <BlockModelPicker
                    category="text"
                    model={block.model}
                    modelLabel={block.modelLabel}
                    authoring={authoring}
                    onChange={(m, l) => onChange({ ...block, model: m, modelLabel: l })}
                />

                {/* 고정된 학생 화면에서는 프롬프트를 읽기 전용으로만 보여 준다. */}
                {!studentLocked && (
                    <Textarea
                        value={block.prompt}
                        onChange={(e) => onChange({ ...block, prompt: e.target.value })}
                        placeholder="쓰고 싶은 글을 설명하세요. 예: 봄에 대한 짧은 시를 써줘"
                        className="min-h-20 text-base"
                        autoFocus={autoFocusPrompt}
                    />
                )}

                {!studentLocked && (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <Button onClick={run} disabled={running} size="lg" className="h-11 flex-1">
                            {running ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" /> 쓰는 중...
                                </>
                            ) : block.output ? (
                                "다시 생성"
                            ) : (
                                "실행"
                            )}
                        </Button>

                        {/* history prop이 주어진 경우(학생 플레이어)에만 표시 */}
                        {history !== undefined && (
                            <Popover>
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <PopoverTrigger
                                                render={
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-11 w-11 shrink-0"
                                                        aria-label="생성 기록"
                                                        type="button"
                                                    />
                                                }
                                            />
                                        }
                                    >
                                        <History className="size-5" />
                                    </TooltipTrigger>
                                    <TooltipContent>생성 기록</TooltipContent>
                                </Tooltip>

                                <PopoverContent side="bottom" align="end" className="w-80 p-0">
                                    <div className="border-b px-3 py-2 text-sm font-medium">생성 기록</div>
                                    <div className="max-h-72 overflow-y-auto">
                                        {(!history || history.length === 0) ? (
                                            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                                                아직 생성 기록이 없어요
                                            </p>
                                        ) : (
                                            <ul className="divide-y">
                                                {history.map((run, i) => (
                                                    <li key={`${run.at}-${i}`}>
                                                        <button
                                                            type="button"
                                                            className="flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                                                            onClick={() => onRestore?.(run)}
                                                        >
                                                            <p className="truncate text-sm font-medium">{run.prompt || "(프롬프트 없음)"}</p>
                                                            {run.result && (
                                                                <p className="line-clamp-2 text-xs text-muted-foreground">{run.result}</p>
                                                            )}
                                                            <p className="mono text-xs text-muted-foreground">
                                                                {run.genMs != null ? `${(run.genMs / 1000).toFixed(1)}초` : "—"}
                                                                {" · "}
                                                                {new Date(run.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                                            </p>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>

                    {running && (
                        <p className="mono text-center text-sm tabular-nums text-muted-foreground">
                            ⏱ {elapsed.toFixed(1)}초 경과
                        </p>
                    )}
                </div>
                )}

                {/* 직전 생성 비용 — 크레딧 + 원화 */}
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

                {block.output && (
                    <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
                        <Markdown>{block.output}</Markdown>
                        {block.genMs != null && (
                            <p className="mono text-xs text-muted-foreground">
                                ⏱ {secs(block.genMs)}초 만에 생성
                            </p>
                        )}
                    </div>
                )}

                {!block.output && !running && (
                    <div className="grid h-24 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        {studentLocked ? "선생님이 아직 결과를 올리지 않았어요" : "실행을 누르면 글이 만들어집니다"}
                    </div>
                )}
            </div>
        </div>
    );
}

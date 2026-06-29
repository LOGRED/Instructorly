/**
 * 이미지 블럭 카드 — 생성(gen)/업로드(upload) 모드를 헤더의 세그먼트 토글로 강사가
 * 자유롭게 전환한다(업로드 블럭도 AI 생성 가능, 그 반대도 가능). 생성 모드는 강사가
 * 잠근 OpenRouter 이미지 모델로 그림을 만들고, 비용을 크레딧으로 표시·기록한다(사용자별).
 * `authoring=true`(빌더)는 모드 토글·모델 선택·업로드까지 가능하고, `authoring=false`
 * (학습자)는 토글 없이 강사가 남긴 모드대로 — 잠긴 모델로 프롬프트만 고쳐 다시 생성한다.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Timer, History, Upload, Bot, Coins, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import type { BlockRun, ImageBlock } from "@/lib/types";
import { studioGenerate, uploadFile } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { DEFAULT_BLOCK_MODEL } from "@/lib/blocks";
import { formatCredits, formatKrw } from "@/lib/credits";
import { BlockModeToggle } from "@/components/blocks/block-mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { BlockModelPicker } from "@/components/blocks/block-model-picker";

/**
  * 이미지 블럭 카드. 학습자는 어떤 경우에도 파일을 업로드할 수 없다(생성만 가능).
  */
export function ImageBlockCard({
    block,
    onChange,
    authoring = true,
    autoFocusPrompt,
    history,
    onRestore,
}: {
    block: ImageBlock;
    onChange: (b: ImageBlock) => void;
    /** 빌더(작성자)면 true — 모델 선택·업로드 UI 노출. 학습자면 false — 잠긴 모델/읽기 전용. */
    authoring?: boolean;
    autoFocusPrompt?: boolean;
    /** 학생 히스토리. 주어질 때만 히스토리 버튼 표시(빌더는 전달 안 함). */
    history?: BlockRun[];
    onRestore?: (run: BlockRun) => void;
}) {
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [lastCost, setLastCost] = useState<{ credits: number; krw: number; free: boolean } | null>(null);
    const startRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);

    const mode = block.mode ?? "gen";
    // 강사가 프롬프트를 고정했고 지금 학생 화면이면 — 수정·실행을 막고 강사 결과만 보여 준다.
    const studentLocked = !authoring && !!block.locked;

    useEffect(
        () => () => {
            if (timerRef.current) clearInterval(timerRef.current);
        },
        [],
    );

    // 강사가 잠근 모델(없으면 기본 모델)로 OpenRouter 이미지 생성을 실행한다.
    async function run() {
        const prompt = block.prompt.trim();
        if (!prompt) {
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
                category: "image",
                model: block.model ?? DEFAULT_BLOCK_MODEL.image.id,
                modelLabel: block.modelLabel ?? DEFAULT_BLOCK_MODEL.image.label,
                prompt,
                userId: userId ?? undefined,
                userName: nickname ?? undefined,
            });
            onChange({
                ...block,
                prompt,
                imageUrl: res.output,
                genMs: res.genMs,
                // 학생 작업 기록에 이 생성의 크레딧을 싣기 위한 임시 비용 묶음(저장 시 BlockRun으로 옮겨짐).
                lastRun: {
                    credits: res.credits,
                    krw: res.krw,
                    costUsd: res.costUsd,
                    free: res.free,
                    model: block.model ?? DEFAULT_BLOCK_MODEL.image.id,
                    modelLabel: block.modelLabel ?? DEFAULT_BLOCK_MODEL.image.label,
                },
            });
            setLastCost({ credits: res.credits, krw: res.krw, free: res.free });
            toast.success(
                res.free
                    ? `무료로 이미지를 만들었어요. (${(res.genMs / 1000).toFixed(1)}초)`
                    : `${formatCredits(res.credits)} 크레딧 사용 · ${(res.genMs / 1000).toFixed(1)}초`,
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "이미지 생성에 실패했습니다.");
        } finally {
            if (timerRef.current) clearInterval(timerRef.current);
            setRunning(false);
        }
    }

    // 파일을 골라 업로드하고 이미지로 설정한다(작성자 전용).
    async function pick(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const att = await uploadFile(file);
            onChange({ ...block, imageUrl: att.url, genMs: null });
            toast.success("이미지 업로드 완료");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "업로드에 실패했습니다.");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    const secs = (ms: number) => (ms / 1000).toFixed(1);

    return (
        <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
                {mode === "gen" ? (
                    <Bot className="size-4 text-muted-foreground" />
                ) : (
                    <ImageIcon className="size-4 text-muted-foreground" />
                )}
                {/* 강사: 업로드↔AI 생성 토글 / 학생: 강사가 남긴 모드 라벨만 */}
                {authoring ? (
                    <BlockModeToggle value={mode} onChange={(m) => onChange({ ...block, mode: m })} />
                ) : (
                    <span className="eyebrow">{mode === "gen" ? "이미지 생성" : "이미지 업로드"}</span>
                )}
                {/* 강사: 프롬프트 고정 토글 / 학생: 고정됨 표시 (생성 모드만) */}
                {mode === "gen" && authoring && (
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
                {mode === "gen" && studentLocked && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3.5" /> 선생님 고정
                    </span>
                )}
                {mode === "gen" && block.genMs != null && !running && (
                    <span className="mono ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Timer className="size-3.5" /> {secs(block.genMs)}초
                    </span>
                )}
            </div>

            <div className="space-y-3 p-4">
                {mode === "gen" ? (
                    <>
                        {/* 강사: 모델 선택 / 학생: 잠긴 모델 + 단가 표시 */}
                        <BlockModelPicker
                            category="image"
                            model={block.model}
                            modelLabel={block.modelLabel}
                            authoring={authoring}
                            onChange={(m, l) => onChange({ ...block, model: m, modelLabel: l })}
                        />

                        {/* 고정된 학생 화면에서는 프롬프트·실행을 숨기고 강사 결과만 보여 준다. */}
                        {!studentLocked && (
                        <Textarea
                            value={block.prompt}
                            onChange={(e) => onChange({ ...block, prompt: e.target.value })}
                            placeholder="만들고 싶은 그림을 설명하세요. 예: 노을 지는 바닷가, 수채화풍"
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
                                            <Loader2 className="size-4 animate-spin" /> 생성 중...
                                        </>
                                    ) : block.imageUrl ? (
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
                                                                    className="flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                                                                    onClick={() => onRestore?.(run)}
                                                                >
                                                                    {/* 이미지 썸네일 */}
                                                                    {run.result ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img
                                                                            src={run.result}
                                                                            alt={run.prompt}
                                                                            className="size-12 shrink-0 rounded border object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="grid size-12 shrink-0 place-items-center rounded border bg-muted text-xs text-muted-foreground">
                                                                            없음
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0 flex-1 space-y-0.5">
                                                                        <p className="truncate text-sm font-medium">{run.prompt || "(프롬프트 없음)"}</p>
                                                                        <p className="mono text-xs text-muted-foreground">
                                                                            {run.genMs != null ? `${(run.genMs / 1000).toFixed(1)}초` : "—"}
                                                                            {" · "}
                                                                            {new Date(run.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                                                        </p>
                                                                    </div>
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
                    </>
                ) : authoring ? (
                    /* 업로드 모드 + 작성자(빌더) — URL 입력/파일 업로드 가능 */
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <Input
                                value={block.imageUrl ?? ""}
                                onChange={(e) => onChange({ ...block, imageUrl: e.target.value || null, genMs: null })}
                                placeholder="이미지 URL 붙여넣기"
                                className="flex-1"
                            />
                            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Upload className="size-4" />
                                )}
                                업로드
                            </Button>
                        </div>
                    </div>
                ) : null}

                {/* 직전 생성 비용 — 크레딧 + 원화 */}
                {mode === "gen" && lastCost && !running && (
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

                {block.imageUrl && (
                    <figure className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={block.imageUrl}
                            alt={block.prompt}
                            className="w-full rounded-lg border"
                        />
                        {mode === "gen" && block.genMs != null && (
                            <figcaption className="mono text-xs text-muted-foreground">
                                ⏱ {secs(block.genMs)}초 만에 생성
                            </figcaption>
                        )}
                    </figure>
                )}

                {!block.imageUrl && !running && (
                    <div className="grid h-40 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        {mode === "gen"
                            ? studentLocked
                                ? "선생님이 아직 결과를 올리지 않았어요"
                                : "실행을 누르면 그림이 만들어집니다"
                            : authoring
                                ? "이미지를 업로드하거나 URL을 붙여넣으세요"
                                : "선생님이 올린 이미지가 없어요"}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * 동영상·오디오 블럭 카드 — 이미지 카드와 동일한 규칙. 헤더의 세그먼트 토글로 강사가
 * 업로드↔AI 생성을 자유롭게 전환한다. 생성(gen) 모드는 강사가 잠근 OpenRouter 모델로
 * 영상/소리를 만들고 비용을 크레딧으로 표시·기록한다(사용자별). 동영상은 비동기라 완료까지
 * 몇 분 걸릴 수 있다. `authoring=true`(빌더)는 모드 토글·모델 선택·업로드·캡션 편집까지,
 * `authoring=false`(학습자)는 토글 없이 강사가 남긴 모드대로 — 잠긴 모델로 프롬프트만 고쳐 다시 생성한다.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, Timer, Bot, Video as VideoIcon, Music, Coins, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";

import { WaveformPlayer } from "@/components/ui/waveform-player";
import type { AudioBlock, VideoBlock } from "@/lib/types";
import { uploadFile, studioGenerate } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { DEFAULT_BLOCK_MODEL } from "@/lib/blocks";
import { formatCredits, formatKrw } from "@/lib/credits";
import { BlockModeToggle } from "@/components/blocks/block-mode-toggle";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BlockModelPicker } from "@/components/blocks/block-model-picker";

// 유튜브 URL이면 임베드 주소로 바꾼다(아니면 null).
export function youtubeEmbed(url: string): string | null {
    const m = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
    );
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

// 동영상 또는 오디오 블럭 카드를 렌더한다.
export function MediaBlockCard({
    block,
    onChange,
    kind,
    authoring = true,
    autoFocusPrompt,
}: {
    block: VideoBlock | AudioBlock;
    onChange: (b: VideoBlock | AudioBlock) => void;
    kind: "video" | "audio";
    /** 빌더(작성자)면 true — 모델 선택·업로드·캡션 편집 노출. 학습자면 false — 잠긴 모델/읽기 전용. */
    authoring?: boolean;
    autoFocusPrompt?: boolean;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [lastCost, setLastCost] = useState<{ credits: number; krw: number; free: boolean } | null>(null);
    const startRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);

    const mode = block.mode ?? "gen";
    const label = kind === "video" ? "동영상" : "오디오";
    const accept = kind === "video" ? "video/*" : "audio/*";
    const defaults = kind === "video" ? DEFAULT_BLOCK_MODEL.video : DEFAULT_BLOCK_MODEL.audio;
    // 강사가 프롬프트를 고정했고 지금 학생 화면이면 — 수정·실행을 막고 강사 결과만 보여 준다.
    const studentLocked = !authoring && !!block.locked;

    useEffect(
        () => () => {
            if (timerRef.current) clearInterval(timerRef.current);
        },
        [],
    );

    // 파일을 골라 업로드하고 미디어 URL로 설정한다(작성자 전용).
    async function pick(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const att = await uploadFile(file);
            onChange({ ...block, url: att.url });
            toast.success(`${label} 업로드 완료`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "업로드에 실패했습니다.");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    // 강사가 잠근 모델(없으면 기본 모델)로 OpenRouter 동영상/오디오 생성을 실행한다.
    async function run() {
        const prompt = (block.prompt ?? "").trim();
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
                category: kind,
                model: block.model ?? defaults.id,
                modelLabel: block.modelLabel ?? defaults.label,
                prompt,
                userId: userId ?? undefined,
                userName: nickname ?? undefined,
            });
            onChange({
                ...block,
                prompt,
                url: res.output,
                genMs: res.genMs,
                // 학생 작업 기록에 이 생성의 크레딧을 싣기 위한 임시 비용 묶음(저장 시 BlockRun으로 옮겨짐).
                lastRun: {
                    credits: res.credits,
                    krw: res.krw,
                    costUsd: res.costUsd,
                    free: res.free,
                    model: block.model ?? defaults.id,
                    modelLabel: block.modelLabel ?? defaults.label,
                },
            });
            setLastCost({ credits: res.credits, krw: res.krw, free: res.free });
            toast.success(
                res.free
                    ? `무료로 ${label}을(를) 만들었어요. (${(res.genMs / 1000).toFixed(1)}초)`
                    : `${formatCredits(res.credits)} 크레딧 사용 · ${(res.genMs / 1000).toFixed(1)}초`,
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `${label} 생성에 실패했습니다.`);
        } finally {
            if (timerRef.current) clearInterval(timerRef.current);
            setRunning(false);
        }
    }

    const secs = (ms: number) => (ms / 1000).toFixed(1);

    // 미디어 플레이어 — 동영상(유튜브 임베드 지원) / 오디오.
    const player = block.url ? (
        kind === "video" ? (
            (() => {
                const yt = youtubeEmbed(block.url);
                return yt ? (
                    <div className="aspect-video overflow-hidden rounded-lg border">
                        <iframe src={yt} className="h-full w-full" allowFullScreen title={block.caption || "동영상"} />
                    </div>
                ) : (
                    <video src={block.url} controls className="w-full rounded-lg border" />
                );
            })()
        ) : (
            <WaveformPlayer src={block.url} className="w-full" />
        )
    ) : null;

    return (
        <div className="overflow-hidden rounded-xl border bg-card">
            {/* 헤더 행 — 아이콘 + 라벨 + 생성 시간 */}
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
                {mode === "gen" ? (
                    <Bot className="size-4 text-muted-foreground" />
                ) : kind === "video" ? (
                    <VideoIcon className="size-4 text-muted-foreground" />
                ) : (
                    <Music className="size-4 text-muted-foreground" />
                )}
                {/* 강사: 업로드↔AI 생성 토글 / 학생: 강사가 남긴 모드 라벨만 */}
                {authoring ? (
                    <BlockModeToggle value={mode} onChange={(m) => onChange({ ...block, mode: m })} />
                ) : (
                    <span className="eyebrow">
                        {label} {mode === "gen" ? "생성" : "업로드"}
                    </span>
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

            {/* 본문 영역 */}
            <div className="space-y-3 p-4">
                {mode === "gen" ? (
                    <div className="space-y-2">
                        {/* 강사: 모델 선택 / 학생: 잠긴 모델 + 단가 표시 */}
                        <BlockModelPicker
                            category={kind}
                            model={block.model}
                            modelLabel={block.modelLabel}
                            authoring={authoring}
                            onChange={(m, l) => onChange({ ...block, model: m, modelLabel: l })}
                        />

                        {/* 고정된 학생 화면에서는 프롬프트·실행을 숨기고 강사 결과만 보여 준다. */}
                        {!studentLocked && (
                        <>
                        <Textarea
                            value={block.prompt ?? ""}
                            onChange={(e) => onChange({ ...block, prompt: e.target.value })}
                            placeholder={
                                kind === "video"
                                    ? "만들고 싶은 영상을 설명하세요. 예: 파도가 치는 해변의 짧은 클립"
                                    : "만들고 싶은 소리를 설명하세요. 예: 잔잔한 피아노 멜로디"
                            }
                            className="min-h-20 text-base"
                            autoFocus={autoFocusPrompt}
                        />
                        <Button onClick={run} disabled={running} size="lg" className="h-11 w-full">
                            {running ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" /> 생성 중...
                                </>
                            ) : block.url ? (
                                "다시 생성"
                            ) : (
                                "실행"
                            )}
                        </Button>
                        {kind === "video" && running && (
                            <p className="text-center text-xs text-muted-foreground">
                                동영상은 1~4분 정도 걸릴 수 있어요. 창을 닫지 말고 기다려 주세요.
                            </p>
                        )}
                        {running && (
                            <p className="mono text-center text-sm tabular-nums text-muted-foreground">
                                ⏱ {elapsed.toFixed(1)}초 경과
                            </p>
                        )}
                        </>
                        )}
                    </div>
                ) : authoring ? (
                    /* 업로드 모드 + 작성자(빌더) — URL 입력/파일 업로드 가능 */
                    <div className="flex gap-2">
                        <Input
                            value={block.url}
                            onChange={(e) => onChange({ ...block, url: e.target.value })}
                            placeholder={kind === "video" ? "동영상 URL 또는 유튜브 링크 붙여넣기" : `${label} URL 붙여넣기`}
                            className="flex-1"
                        />
                        <input ref={fileRef} type="file" accept={accept} hidden onChange={pick} />
                        <Button
                            type="button"
                            variant="outline"
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

                {/* 캡션 — 작성자만 편집, 학습자는 읽기 전용 표시 */}
                {authoring ? (
                    <Input
                        value={block.caption}
                        onChange={(e) => onChange({ ...block, caption: e.target.value })}
                        placeholder="설명 (선택)"
                    />
                ) : null}

                {player ?? (
                    <div className="grid h-40 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        {mode === "gen"
                            ? studentLocked
                                ? "선생님이 아직 결과를 올리지 않았어요"
                                : "실행을 누르면 만들어집니다"
                            : authoring
                                ? `${label} 파일을 업로드하거나 URL을 붙여넣으세요`
                                : `선생님이 올린 ${label}이(가) 없어요`}
                    </div>
                )}

                {!authoring && block.caption && (
                    <p className="text-sm text-muted-foreground">{block.caption}</p>
                )}
            </div>
        </div>
    );
}

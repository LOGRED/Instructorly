/**
 * 오디오 파형 플레이어 — 음성·음악을 막대 파형(waveform)으로 그리고 재생/탐색하는 클라이언트 컴포넌트.
 * Web Audio API(decodeAudioData)로 피크를 뽑아 canvas에 그린다. 외부 의존성 없음(LAN HTTP에서도 동작).
 * 디코드가 불가능한 소스는 네이티브 <audio controls>로 폴백한다.
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface WaveformPlayerProps {
    /** 오디오 소스 URL(data URL 또는 원격 URL). */
    src: string;
    className?: string;
    /** 파형 높이(px). 기본 56. */
    height?: number;
}

/** 디코드된 오디오에서 막대 개수만큼 정규화된 피크(0~1) 배열을 뽑는다. */
function extractPeaks(buffer: AudioBuffer, bars: number): number[] {
    const channel = buffer.getChannelData(0);
    const block = Math.floor(channel.length / bars) || 1;
    const peaks: number[] = [];
    let max = 0.0001;
    for (let i = 0; i < bars; i++) {
        const startI = i * block;
        let sum = 0;
        for (let j = 0; j < block; j++) {
            const v = channel[startI + j] ?? 0;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / block); // RMS = 체감 음량에 가까움
        peaks.push(rms);
        if (rms > max) max = rms;
    }
    return peaks.map((p) => p / max);
}

/**
 * 디코드 불가(원격 CORS·미지원 포맷) 시 쓰는 의사(pseudo) 파형 — src로 시드한 결정적 패턴.
 * 실제 음량은 아니지만 항상 동일하게 그려져 네이티브 플레이어 대신 파형 UI를 유지한다.
 */
function pseudoPeaks(src: string, bars: number): number[] {
    let seed = 0;
    for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) >>> 0;
    const rand = () => {
        // xorshift32 — 외부 의존 없는 결정적 난수.
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        seed >>>= 0;
        return seed / 0xffffffff;
    };
    const peaks: number[] = [];
    for (let i = 0; i < bars; i++) {
        // 부드러운 곡선(사인) + 약간의 난수로 자연스러운 막대 높이.
        const wave = 0.5 + 0.4 * Math.sin((i / bars) * Math.PI * 6);
        peaks.push(Math.max(0.12, Math.min(1, wave * (0.6 + 0.5 * rand()))));
    }
    return peaks;
}

/** 초를 m:ss로 포맷한다. */
function fmtTime(sec: number): string {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// 오디오 파형 플레이어 컴포넌트.
export function WaveformPlayer({ src, className, height = 56 }: WaveformPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const peaksRef = useRef<number[] | null>(null);

    const [decoding, setDecoding] = useState(true);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);

    // 피크 + 진행도를 canvas에 그린다.
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const peaks = peaksRef.current;
        if (!canvas || !peaks) return;
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const cssW = canvas.clientWidth || 1;
        const cssH = canvas.clientHeight || height;
        if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
            canvas.width = Math.floor(cssW * dpr);
            canvas.height = Math.floor(cssH * dpr);
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);

        const styles = getComputedStyle(canvas);
        const playedColor = styles.getPropertyValue("--wf-played").trim() || "#6366f1";
        const restColor = styles.getPropertyValue("--wf-rest").trim() || "rgba(120,120,130,0.35)";

        const barW = 3;
        const gap = 2;
        const step = barW + gap;
        const count = Math.max(1, Math.floor(cssW / step));
        const mid = cssH / 2;
        const progress = duration > 0 ? current / duration : 0;
        const playedBars = Math.floor(count * progress);

        for (let i = 0; i < count; i++) {
            // 막대 개수에 맞춰 피크를 리샘플.
            const peak = peaks[Math.floor((i / count) * peaks.length)] ?? 0;
            const h = Math.max(2, peak * (cssH - 4));
            const x = i * step;
            ctx.fillStyle = i <= playedBars ? playedColor : restColor;
            ctx.beginPath();
            const r = barW / 2;
            const top = mid - h / 2;
            // 둥근 막대.
            ctx.roundRect(x, top, barW, h, r);
            ctx.fill();
        }
    }, [current, duration, height]);

    // 소스를 받아 디코드하고 피크를 만든다.
    useEffect(() => {
        let cancelled = false;
        setDecoding(true);
        peaksRef.current = null;

        // AudioContext 지원/디코드 가능 여부 확인.
        const AC =
            typeof window !== "undefined"
                ? window.AudioContext ||
                  (window as unknown as { webkitAudioContext?: typeof AudioContext })
                      .webkitAudioContext
                : undefined;
        // 디코드 실패해도 네이티브로 떨어지지 않고 의사 파형으로 UI를 유지한다.
        const fallbackToPseudo = () => {
            if (cancelled) return;
            peaksRef.current = pseudoPeaks(src, 400);
            setDecoding(false);
            requestAnimationFrame(draw);
        };

        if (!AC) {
            fallbackToPseudo();
            return;
        }

        (async () => {
            try {
                // CORS 허용 시 실제 피크, 막히면 catch에서 의사 파형으로 대체.
                const res = await fetch(src, { mode: "cors" });
                const arr = await res.arrayBuffer();
                const ctx = new AC();
                const buffer = await ctx.decodeAudioData(arr.slice(0));
                ctx.close();
                if (cancelled) return;
                peaksRef.current = extractPeaks(buffer, 400);
                setDuration(buffer.duration);
                setDecoding(false);
                requestAnimationFrame(draw);
            } catch {
                fallbackToPseudo();
            }
        })();

        return () => {
            cancelled = true;
        };
        // draw는 의도적으로 의존성에서 제외(재디코드 방지).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);

    // 진행도/리사이즈에 맞춰 다시 그린다(의사 파형 포함).
    useEffect(() => {
        draw();
    }, [draw]);

    useEffect(() => {
        const onResize = () => draw();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [draw]);

    // 재생/일시정지 토글.
    const toggle = useCallback(() => {
        const a = audioRef.current;
        if (!a) return;
        if (a.paused) {
            void a.play();
        } else {
            a.pause();
        }
    }, []);

    // 파형 클릭 위치로 탐색.
    const seek = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const a = audioRef.current;
            const canvas = canvasRef.current;
            if (!a || !canvas || !duration) return;
            const rect = canvas.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            a.currentTime = ratio * duration;
            setCurrent(a.currentTime);
        },
        [duration],
    );

    return (
        <div
            className={cn(
                // 불투명 배경 — 채팅의 primary 버블(검정) 위에서도 파형이 묻히지 않게.
                "flex flex-col gap-1 rounded-xl border bg-background px-3 py-2",
                className,
            )}
            style={
                {
                    // 파형 색 토큰 — 재생된 부분은 primary, 나머지는 옅게.
                    ["--wf-played" as string]: "var(--primary, #6366f1)",
                    ["--wf-rest" as string]: "color-mix(in srgb, var(--foreground, #71717a) 28%, transparent)",
                } as React.CSSProperties
            }
        >
            <audio
                ref={audioRef}
                src={src}
                className="hidden"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) setDuration(d);
                }}
            />

            {/* 재생 버튼 + 파형 — 같은 줄(세로 중앙 정렬) */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={toggle}
                    disabled={decoding}
                    aria-label={playing ? "일시정지" : "재생"}
                    className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full text-primary-foreground transition-colors",
                        "bg-primary hover:bg-primary/90 disabled:opacity-50",
                    )}
                >
                    {decoding ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : playing ? (
                        <Pause className="size-4" />
                    ) : (
                        <Play className="size-4 translate-x-px" />
                    )}
                </button>

                <canvas
                    ref={canvasRef}
                    onClick={seek}
                    style={{ height }}
                    className="min-w-0 flex-1 cursor-pointer"
                />
            </div>

            {/* 시간 — 파형 아래(버튼 너비만큼 들여써 파형 시작점에 맞춤) */}
            <div className="flex justify-between pl-12 text-[11px] tabular-nums text-muted-foreground">
                <span>{fmtTime(current)}</span>
                <span>{fmtTime(duration)}</span>
            </div>
        </div>
    );
}

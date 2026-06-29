/**
 * Soniox 실시간 STT(받아쓰기) 훅 — 마이크 오디오를 s16le PCM으로 떠서 Soniox WebSocket으로
 * 스트리밍하고, 돌아오는 토큰(확정 final + 임시 non-final)을 누적해 현재까지의 전사 텍스트를
 * onText로 흘려준다. 실 키는 서버(/api/stt/token)가 발급한 임시 키로만 연결한다.
 *
 * 프로토콜: 첫 메시지로 JSON config({api_key, model, audio_format:"s16le", sample_rate,
 * num_channels, language_hints})를 보내고, 이후 오디오를 바이너리 프레임으로 보낸다.
 * 응답 { tokens:[{text,is_final}], ... }. final 토큰은 한 번만 오므로 누적, non-final은 매번 갱신.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SONIOX_WS_URL = "wss://stt-rt.soniox.com/transcribe-websocket";

/** Soniox 토큰 응답(필요한 필드만). */
interface SonioxToken {
    text: string;
    is_final?: boolean;
}
interface SonioxMessage {
    tokens?: SonioxToken[];
    finished?: boolean;
    error_code?: number;
    error_message?: string;
}

export interface UseSonioxSttOptions {
    /** 현재까지의 전사 텍스트(확정 + 임시)를 받을 콜백. */
    onText: (text: string) => void;
    /** 오류 메시지 콜백(권한 거부, 키 없음, 연결 실패 등). */
    onError?: (message: string) => void;
    /** 언어 힌트(기본 한국어+영어). */
    languageHints?: string[];
}

export interface SonioxStt {
    /** 현재 듣는 중인지(연결/녹음 중). */
    listening: boolean;
    /** 받아쓰기 시작(임시 키 발급 → 마이크 → WS 연결). */
    start: () => Promise<void>;
    /** 받아쓰기 종료(WS·마이크·오디오 정리). 텍스트는 보존(전송하지 않음). */
    stop: () => void;
    /** 이 브라우저에서 마이크 받아쓰기가 가능한지. */
    supported: boolean;
}

/** Soniox가 발화 끝 등에 끼워 보내는 특수 마커 토큰(전사 텍스트에서 제외). */
function isMarkerToken(text: string): boolean {
    return text === "<end>" || text === "<fin>";
}

/** Float32 오디오 샘플을 16-bit PCM(s16le) 바이트로 변환한다. */
function floatToPcm16(input: Float32Array): ArrayBuffer {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out.buffer;
}

// Soniox 실시간 받아쓰기를 제어하는 React 훅.
export function useSonioxStt(opts: UseSonioxSttOptions): SonioxStt {
    const { onText, onError, languageHints } = opts;
    const [listening, setListening] = useState(false);

    // 콜백/옵션은 ref로 들고 있어 start/stop 정체성을 안정적으로 유지한다.
    const onTextRef = useRef(onText);
    const onErrorRef = useRef(onError);
    const hintsRef = useRef(languageHints);
    useEffect(() => {
        onTextRef.current = onText;
        onErrorRef.current = onError;
        hintsRef.current = languageHints;
    }, [onText, onError, languageHints]);

    // 자원 핸들들.
    const wsRef = useRef<WebSocket | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const procRef = useRef<ScriptProcessorNode | null>(null);
    const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const finalTextRef = useRef("");
    // 세션 활성 플래그 — stop 즉시 false로 만들어 늦게 오는 오디오/메시지를 전부 무시한다.
    const activeRef = useRef(false);

    const supported =
        typeof window !== "undefined" &&
        typeof window.WebSocket !== "undefined" &&
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        (typeof window.AudioContext !== "undefined" ||
            typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !==
                "undefined");

    // 모든 자원을 정리한다(중복 호출 안전).
    const cleanup = useCallback(() => {
        activeRef.current = false;
        if (keepaliveRef.current) {
            clearInterval(keepaliveRef.current);
            keepaliveRef.current = null;
        }
        try {
            if (procRef.current) procRef.current.onaudioprocess = null;
            procRef.current?.disconnect();
        } catch {
            /* noop */
        }
        try {
            srcRef.current?.disconnect();
        } catch {
            /* noop */
        }
        procRef.current = null;
        srcRef.current = null;
        if (ctxRef.current && ctxRef.current.state !== "closed") {
            void ctxRef.current.close().catch(() => {});
        }
        ctxRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const ws = wsRef.current;
        wsRef.current = null;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            try {
                if (ws.readyState === WebSocket.OPEN) ws.send(new ArrayBuffer(0)); // 빈 프레임 = 종료 신호
            } catch {
                /* noop */
            }
            try {
                ws.close();
            } catch {
                /* noop */
            }
        }
    }, []);

    // 받아쓰기를 멈추고 자원을 정리한다(텍스트는 그대로 둔다).
    const stop = useCallback(() => {
        cleanup();
        setListening(false);
    }, [cleanup]);

    // 받아쓰기를 시작한다.
    const start = useCallback(async () => {
        if (!supported) {
            const insecure = typeof window !== "undefined" && !window.isSecureContext;
            onErrorRef.current?.(
                insecure
                    ? "마이크는 보안 연결(localhost 또는 https)에서만 동작해요. http LAN 주소에선 브라우저가 막습니다."
                    : "이 브라우저에서는 마이크 받아쓰기를 쓸 수 없어요.",
            );
            return;
        }
        if (activeRef.current) return; // 이미 듣는 중이면 중복 시작 금지(orphan 세션 방지).
        activeRef.current = true;
        finalTextRef.current = "";
        setListening(true);
        try {
            // 1) 서버에서 임시 키 + 모델을 받는다.
            const tokenRes = await fetch("/api/stt/token", { method: "POST" });
            const tokenData = (await tokenRes.json().catch(() => null)) as
                | { apiKey?: string; model?: string; error?: string }
                | null;
            if (!tokenRes.ok || !tokenData?.apiKey) {
                throw new Error(tokenData?.error ?? "받아쓰기 키를 받지 못했어요.");
            }
            if (!activeRef.current) return; // 키 받는 사이 사용자가 껐으면 중단(마이크 안 켬).

            // 2) 마이크 권한 + 스트림.
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
            });
            // 마이크 받는 사이 껐으면 스트림 즉시 정리하고 중단.
            if (!activeRef.current) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }
            streamRef.current = stream;

            // 3) 오디오 그래프(16k 힌트, 실제 sampleRate를 config에 보고).
            const Ctx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const ctx = new Ctx({ sampleRate: 16000 });
            ctxRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            srcRef.current = source;
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            procRef.current = processor;

            // 4) WebSocket 연결 + config 전송.
            const ws = new WebSocket(SONIOX_WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                ws.send(
                    JSON.stringify({
                        api_key: tokenData.apiKey,
                        model: tokenData.model || "stt-rt-preview",
                        audio_format: "s16le",
                        sample_rate: Math.round(ctx.sampleRate),
                        num_channels: 1,
                        language_hints: hintsRef.current ?? ["ko", "en"],
                        // 받아쓰기는 수동 ON/OFF라 자동 끝점검출 불필요(켜면 <end> 마커가 끼어든다).
                        enable_endpoint_detection: false,
                    }),
                );
                // 침묵 구간에도 연결 유지(8초마다 keepalive).
                keepaliveRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: "keepalive" }));
                    }
                }, 8000);
            };

            ws.onmessage = (ev) => {
                if (!activeRef.current) return; // 멈춘 뒤 늦게 오는 메시지는 무시(텍스트 변동 정지).
                let msg: SonioxMessage;
                try {
                    msg = JSON.parse(typeof ev.data === "string" ? ev.data : "") as SonioxMessage;
                } catch {
                    return;
                }
                if (msg.error_code) {
                    onErrorRef.current?.(`받아쓰기 오류: ${msg.error_message ?? msg.error_code}`);
                    stop();
                    return;
                }
                // 끝점 마커(<end> 등) 토큰은 전사 텍스트에서 제외한다.
                const toks = (msg.tokens ?? []).filter((t) => !isMarkerToken(t.text));
                for (const t of toks) {
                    if (t.is_final) finalTextRef.current += t.text;
                }
                const partial = toks.filter((t) => !t.is_final).map((t) => t.text).join("");
                onTextRef.current(finalTextRef.current + partial);
            };

            ws.onerror = () => {
                onErrorRef.current?.("받아쓰기 서버 연결에 문제가 생겼어요.");
            };
            ws.onclose = () => {
                // 서버가 닫으면 녹음 상태 해제(stop이 이미 처리했을 수도 있음).
                setListening(false);
            };

            // 5) 오디오를 PCM으로 떠서 전송. 피드백 방지를 위해 0 게인으로 destination에 연결.
            processor.onaudioprocess = (e) => {
                if (!activeRef.current) return; // 멈췄으면 오디오 전송 즉시 중단.
                const ws2 = wsRef.current;
                if (!ws2 || ws2.readyState !== WebSocket.OPEN) return;
                ws2.send(floatToPcm16(e.inputBuffer.getChannelData(0)));
            };
            const mute = ctx.createGain();
            mute.gain.value = 0;
            source.connect(processor);
            processor.connect(mute);
            mute.connect(ctx.destination);

            setListening(true);
        } catch (e) {
            cleanup();
            setListening(false);
            const msg =
                e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")
                    ? "마이크 권한이 필요해요. 브라우저에서 허용해 주세요."
                    : e instanceof Error
                      ? e.message
                      : "받아쓰기를 시작하지 못했어요.";
            onErrorRef.current?.(msg);
        }
    }, [supported, cleanup, stop]);

    // 언마운트 시 자원 정리.
    useEffect(() => cleanup, [cleanup]);

    return { listening, start, stop, supported };
}

/**
 * 시험·연습 LLM 클론 공용 엔진 — 4개 클론(ChatGPT·Claude·Gemini·Grok)이 똑같이 쓰는
 * 실시간 채팅 훅과 작은 UI 조각들. 각 클론은 "겉모습"만 다르게 그리고, 메시지 상태·
 * 실제 OpenRouter 호출·생성 애니메이션 타이밍은 모두 이 파일의 useLlmChat 으로 통일한다.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LlmProvider } from "@/lib/types";

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
    id: string;
    role: ChatRole;
    text: string;
}

/** 4개 클론이 공통으로 받는 props — 런너가 넘긴다. */
export interface LlmCloneProps {
    /** 학습자 이름(인사말·아바타에 사용). */
    userName: string;
    /** 어시스턴트 답변이 한 번 끝날 때마다 호출 — 런너가 "제출" 버튼을 푼다. */
    onReplyComplete: () => void;
}

export type ChatStatus = "idle" | "thinking" | "streaming";

interface UseLlmChatOptions {
    provider: LlmProvider;
    onReplyComplete?: () => void;
    /** 전송 후 답변이 흐르기 시작할 때까지의 최소 "생각 중" 시간(ms). */
    thinkingMs?: number;
    /** 한 틱마다 흘리는 글자 수. */
    chunk?: number;
    /** 틱 간격(ms). 작을수록 빨리 흐른다. */
    tickMs?: number;
}

export interface LlmChat {
    messages: ChatTurn[];
    status: ChatStatus;
    /** 지금 스트리밍 중인 어시스턴트 메시지 id(없으면 null). */
    streamingId: string | null;
    /** 사용자가 보낸 메시지 수. */
    sentCount: number;
    send: (text: string) => void;
    reset: () => void;
}

let _seq = 0;
// 충돌 없는 간단한 메시지 id 생성(렌더 안정성을 위해 Math.random 미사용).
function nextId(): string {
    _seq += 1;
    return `m${_seq}`;
}

/**
 * 실제 OpenRouter와 연결된 대화 흐름을 관리한다.
 * send() → 사용자 메시지 추가 → "생각 중"(최소 thinkingMs) → /api/drills/chat 호출 →
 * 받은 전체 답변을 빈 어시스턴트 메시지에 한 글자씩 흘림 → 끝나면 onReplyComplete 호출.
 * 키 미설정·네트워크 오류 등은 한국어 안내 문구를 어시스턴트 말풍선에 표시한다.
 */
export function useLlmChat({
    provider,
    onReplyComplete,
    thinkingMs = 650,
    chunk = 2,
    tickMs = 18,
}: UseLlmChatOptions): LlmChat {
    const [messages, setMessages] = useState<ChatTurn[]>([]);
    const [status, setStatus] = useState<ChatStatus>("idle");
    const [streamingId, setStreamingId] = useState<string | null>(null);
    const [sentCount, setSentCount] = useState(0);

    // 최신 메시지 히스토리를 동기적으로 읽기 위한 거울 ref.
    const messagesRef = useRef<ChatTurn[]>([]);
    messagesRef.current = messages;

    const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const onDoneRef = useRef(onReplyComplete);
    onDoneRef.current = onReplyComplete;
    const aliveRef = useRef(true);
    const inflightRef = useRef(false);
    // 전송 세대 번호 — reset/언마운트 시 증가시켜 진행 중 응답을 무효화한다.
    const genRef = useRef(0);

    // 언마운트 시 정리 — 진행 중 응답·타이머 무효화.
    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
            genRef.current += 1;
            if (streamTimer.current) clearInterval(streamTimer.current);
        };
    }, []);

    // 에러 안내 문구를 어시스턴트 말풍선으로 띄우고 idle로 되돌린다.
    const showError = useCallback((msg: string, gen: number) => {
        if (!aliveRef.current || gen !== genRef.current) return;
        const asstId = nextId();
        setMessages((prev) => [...prev, { id: asstId, role: "assistant", text: msg }]);
        setStreamingId(null);
        setStatus("idle");
        inflightRef.current = false;
    }, []);

    // 받은 전체 텍스트를 chunk자씩 흘려 어시스턴트 메시지에 채운다.
    const revealText = useCallback(
        (asstId: string, full: string, gen: number) => {
            setStreamingId(asstId);
            setStatus("streaming");
            let i = 0;
            streamTimer.current = setInterval(() => {
                // reset·언마운트로 세대가 바뀌면 즉시 멈춘다.
                if (!aliveRef.current || gen !== genRef.current) {
                    if (streamTimer.current) clearInterval(streamTimer.current);
                    streamTimer.current = null;
                    return;
                }
                i += chunk;
                const slice = full.slice(0, i);
                setMessages((prev) =>
                    prev.map((m) => (m.id === asstId ? { ...m, text: slice } : m)),
                );
                if (i >= full.length) {
                    if (streamTimer.current) clearInterval(streamTimer.current);
                    streamTimer.current = null;
                    setStreamingId(null);
                    setStatus("idle");
                    inflightRef.current = false;
                    onDoneRef.current?.();
                }
            }, tickMs);
        },
        [chunk, tickMs],
    );

    const send = useCallback(
        (text: string) => {
            const prompt = text.trim();
            // 이미 생성 중이면 무시(실제 UI도 전송 버튼이 멈춤 버튼으로 바뀜).
            if (!prompt || inflightRef.current) return;
            inflightRef.current = true;

            const userTurn: ChatTurn = { id: nextId(), role: "user", text: prompt };
            // 보낼 히스토리는 방금 추가한 사용자 메시지까지 포함한다.
            const history = [...messagesRef.current, userTurn].map((m) => ({
                role: m.role,
                content: m.text,
            }));
            setMessages((prev) => [...prev, userTurn]);
            setSentCount((n) => n + 1);
            setStatus("thinking");

            const gen = ++genRef.current;

            void (async () => {
                // 최소 "생각 중" 시간 — 실제 LLM 같은 호흡을 준다(응답이 빨라도 너무 즉답으로 안 보이게).
                const waitMin = new Promise((r) => setTimeout(r, thinkingMs));
                try {
                    const res = await fetch("/api/drills/chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ provider, messages: history }),
                    });
                    const data = (await res.json().catch(() => ({}))) as {
                        text?: unknown;
                        error?: unknown;
                    };
                    await waitMin;
                    if (!aliveRef.current || gen !== genRef.current) return;

                    if (!res.ok) {
                        const msg =
                            typeof data?.error === "string"
                                ? data.error
                                : "지금은 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
                        showError(msg, gen);
                        return;
                    }

                    const full =
                        typeof data?.text === "string" && data.text.trim()
                            ? data.text
                            : "음… 지금은 답변을 만들지 못했어요. 다시 한 번 물어봐 주세요.";
                    const asstId = nextId();
                    setMessages((prev) => [...prev, { id: asstId, role: "assistant", text: "" }]);
                    revealText(asstId, full, gen);
                } catch {
                    await waitMin;
                    showError(
                        "연결이 원활하지 않아요. 인터넷 상태를 확인하고 다시 시도해 주세요.",
                        gen,
                    );
                }
            })();
        },
        [provider, thinkingMs, revealText, showError],
    );

    const reset = useCallback(() => {
        // 세대 증가로 진행 중 fetch·reveal을 무효화한다.
        genRef.current += 1;
        if (streamTimer.current) clearInterval(streamTimer.current);
        streamTimer.current = null;
        inflightRef.current = false;
        setMessages([]);
        setStatus("idle");
        setStreamingId(null);
        setSentCount(0);
    }, []);

    return { messages, status, streamingId, sentCount, send, reset };
}

/** 메시지 영역이 길어지면 항상 맨 아래로 스크롤하는 ref 헬퍼. */
export function useAutoScroll(dep: unknown) {
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [dep]);
    return ref;
}

/** 텍스트 끝에서 깜빡이는 커서(ChatGPT·Claude 스트리밍 표시용). */
export function BlinkingCaret({ className }: { className?: string }) {
    return (
        <span
            className={className}
            style={{
                display: "inline-block",
                width: "0.5em",
                height: "1.05em",
                marginLeft: "1px",
                transform: "translateY(0.18em)",
                background: "currentColor",
                borderRadius: "1px",
                animation: "drillBlink 1s steps(1) infinite",
            }}
        />
    );
}

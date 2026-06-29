/**
 * 시험·연습 LLM 클론 공용 엔진 — 4개 클론(ChatGPT·Claude·Gemini·Grok)이 똑같이 쓰는
 * 가짜 채팅 스트리밍 훅과 작은 UI 조각들. 각 클론은 "겉모습"만 다르게 그리고, 메시지
 * 상태·생성 애니메이션 타이밍은 모두 이 파일의 useFakeChat 으로 통일한다.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cannedReply } from "@/lib/llm-clones";
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

interface UseFakeChatOptions {
    provider: LlmProvider;
    onReplyComplete?: () => void;
    /** 전송 후 답변이 흐르기 시작할 때까지의 "생각 중" 시간(ms). */
    thinkingMs?: number;
    /** 한 틱마다 흘리는 글자 수. */
    chunk?: number;
    /** 틱 간격(ms). 작을수록 빨리 흐른다. */
    tickMs?: number;
}

export interface FakeChat {
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
 * 실제 LLM처럼 보이는 가짜 대화 흐름을 관리한다.
 * send() → 사용자 메시지 추가 → "생각 중"(thinkingMs) → 빈 어시스턴트 메시지 추가 후
 * cannedReply 를 한 글자씩 흘림 → 끝나면 onReplyComplete 호출.
 */
export function useFakeChat({
    provider,
    onReplyComplete,
    thinkingMs = 650,
    chunk = 2,
    tickMs = 18,
}: UseFakeChatOptions): FakeChat {
    const [messages, setMessages] = useState<ChatTurn[]>([]);
    const [status, setStatus] = useState<ChatStatus>("idle");
    const [streamingId, setStreamingId] = useState<string | null>(null);
    const [sentCount, setSentCount] = useState(0);

    const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const onDoneRef = useRef(onReplyComplete);
    onDoneRef.current = onReplyComplete;

    // 언마운트 시 타이머 정리.
    useEffect(
        () => () => {
            if (thinkTimer.current) clearTimeout(thinkTimer.current);
            if (streamTimer.current) clearInterval(streamTimer.current);
        },
        [],
    );

    const send = useCallback(
        (text: string) => {
            const prompt = text.trim();
            if (!prompt) return;
            // 이미 생성 중이면 무시(실제 UI도 전송 버튼이 멈춤 버튼으로 바뀜).
            if (thinkTimer.current || streamTimer.current) return;

            const userTurn: ChatTurn = { id: nextId(), role: "user", text: prompt };
            setMessages((prev) => [...prev, userTurn]);
            setSentCount((n) => n + 1);
            setStatus("thinking");

            thinkTimer.current = setTimeout(() => {
                thinkTimer.current = null;
                const full = cannedReply(provider, prompt);
                const asstId = nextId();
                setMessages((prev) => [...prev, { id: asstId, role: "assistant", text: "" }]);
                setStreamingId(asstId);
                setStatus("streaming");

                let i = 0;
                streamTimer.current = setInterval(() => {
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
                        onDoneRef.current?.();
                    }
                }, tickMs);
            }, thinkingMs);
        },
        [provider, thinkingMs, chunk, tickMs],
    );

    const reset = useCallback(() => {
        if (thinkTimer.current) clearTimeout(thinkTimer.current);
        if (streamTimer.current) clearInterval(streamTimer.current);
        thinkTimer.current = null;
        streamTimer.current = null;
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

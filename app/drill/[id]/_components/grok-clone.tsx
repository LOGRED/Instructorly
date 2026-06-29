/**
 * Grok 클론 — grok.com(xAI) 화면을 픽셀 단위로 흉내 낸 시험/연습용 컴포넌트.
 * 순수 블랙(#000) 배경 + 흰 텍스트의 미니멀 다크 UI, 얇은 아이콘 전용 왼쪽 레일,
 * 중앙 정렬 rounded-[20px] 입력창, 3점 바운스 생각 애니메이션, 흰색 스트리밍 커서.
 */
"use client";

import { useState } from "react";
import {
    SquarePen,
    Clock,
    ChevronDown,
    Plus,
    ArrowUp,
    Square,
    Copy,
    ThumbsUp,
    ThumbsDown,
    RotateCcw,
    Telescope,
    Brain,
    Image,
    Settings,
} from "lucide-react";

import { Markdown } from "@/components/markdown";
import {
    useFakeChat,
    useAutoScroll,
    BlinkingCaret,
    type LlmCloneProps,
} from "./_shared";

// Grok 공식 엠블럼(xAI) — 두 개의 각진 곡선 path로 이루어진 monochrome 글리프.
function GrokGlyph({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0.36 0.5 33.33 32"
            className={className}
            fill="currentColor"
            aria-label="Grok"
            aria-hidden
        >
            <path d="M13.2371 21.0407L24.3186 12.8506C24.8619 12.4491 25.6384 12.6057 25.8973 13.2294C27.2597 16.5185 26.651 20.4712 23.9403 23.1851C21.2297 25.8989 17.4581 26.4941 14.0108 25.1386L10.2449 26.8843C15.6463 30.5806 22.2053 29.6665 26.304 25.5601C29.5551 22.3051 30.562 17.8683 29.6205 13.8673L29.629 13.8758C28.2637 7.99809 29.9647 5.64871 33.449 0.844576C33.5314 0.730667 33.6139 0.616757 33.6964 0.5L29.1113 5.09055V5.07631L13.2343 21.0436" />
            <path d="M10.9503 23.0313C7.07343 19.3235 7.74185 13.5853 11.0498 10.2763C13.4959 7.82722 17.5036 6.82767 21.0021 8.2971L24.7595 6.55998C24.0826 6.07017 23.215 5.54334 22.2195 5.17313C17.7198 3.31926 12.3326 4.24192 8.67479 7.90126C5.15635 11.4239 4.0499 16.8403 5.94992 21.4622C7.36924 24.9165 5.04257 27.3598 2.69884 29.826C1.86829 30.7002 1.0349 31.5745 0.36364 32.5L10.9474 23.0341" />
        </svg>
    );
}

// 사이드바에 표시할 샘플 채팅 히스토리.
const SIDEBAR_HISTORY = [
    "스마트폰 사진 찍는 법",
    "건강에 좋은 아침 습관",
    "손주에게 보내는 편지",
    "요리 레시피 추천",
    "동네 병원 예약 방법",
];

/** Grok 클론 메인 컴포넌트 — 검정 배경 미니멀 채팅 UI. */
export function GrokClone({ userName, onReplyComplete }: LlmCloneProps) {
    const chat = useFakeChat({
        provider: "grok",
        onReplyComplete,
        thinkingMs: 550,
        chunk: 3,
        tickMs: 14,
    });
    const [input, setInput] = useState("");
    const scrollRef = useAutoScroll(chat.messages);

    const isEmpty = chat.messages.length === 0;
    const busy = chat.status !== "idle";
    const initial = userName.trim().charAt(0) || "나";

    // 입력값을 전송하고 입력창을 초기화한다.
    function submit() {
        if (!input.trim() || busy) return;
        chat.send(input);
        setInput("");
    }

    // 입력창 + 제출 버튼(빈 화면 중앙 / 대화 중 하단 공용).
    function Composer() {
        return (
            <div className="mx-auto w-full max-w-2xl">
                <div
                    className="rounded-[20px] border p-2.5"
                    style={{ background: "#16181c", borderColor: "#2f3336" }}
                >
                    {/* 텍스트 입력 영역 */}
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                submit();
                            }
                        }}
                        rows={1}
                        placeholder="무엇이든 물어보세요"
                        className="block max-h-40 min-h-[28px] w-full resize-none bg-transparent px-2 pt-1.5 text-[16px] leading-6 outline-none"
                        style={{
                            color: "#e7e9ea",
                            // @ts-expect-error CSS custom property via inline style
                            "--tw-placeholder-color": "#71767b",
                        }}
                    />
                    {/* 하단 컨트롤 줄 */}
                    <div className="flex items-center justify-between px-1 pt-1.5">
                        {/* 왼쪽: 첨부 버튼 + 모드 칩 */}
                        <div className="flex items-center gap-1.5">
                            <button
                                className="grid size-8 place-items-center rounded-full"
                                style={{ color: "#71767b" }}
                                aria-label="파일 추가"
                            >
                                <Plus className="size-[18px]" />
                            </button>
                            <button
                                className="flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px]"
                                style={{ borderColor: "#2f3336", color: "#71767b", background: "transparent" }}
                            >
                                <Telescope className="size-[13px]" />
                                DeepSearch
                            </button>
                            <button
                                className="flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px]"
                                style={{ borderColor: "#2f3336", color: "#71767b", background: "transparent" }}
                            >
                                <Brain className="size-[13px]" />
                                Think
                            </button>
                        </div>
                        {/* 오른쪽: 원형 전송 버튼 */}
                        <button
                            onClick={submit}
                            disabled={!input.trim() && !busy}
                            aria-label={busy ? "생성 중" : "보내기"}
                            className="grid size-9 place-items-center rounded-full transition-colors"
                            style={{
                                background: input.trim() ? "#ffffff" : "#2f3336",
                                color: input.trim() ? "#000000" : "#71767b",
                            }}
                        >
                            {busy ? (
                                <Square className="size-3.5 fill-current" />
                            ) : (
                                <ArrowUp className="size-5" />
                            )}
                        </button>
                    </div>
                </div>
                {/* 경고 문구 */}
                <p className="py-2 text-center text-[12px]" style={{ color: "#71767b" }}>
                    Grok는 실수를 할 수 있어요.
                </p>
            </div>
        );
    }

    return (
        <>
            {/* Grok 전용 keyframe — 생각 중 3점 바운스 */}
            <style>{`
                @keyframes grokDotBounce {
                    0%, 80%, 100% { transform: translateY(0);   opacity: 0.35; }
                    40%           { transform: translateY(-5px); opacity: 1;    }
                }
                .grok-placeholder::placeholder { color: #71767b; }
            `}</style>

            <div
                className="flex h-full w-full overflow-hidden font-sans"
                style={{ background: "#000000", color: "#e7e9ea" }}
            >
                {/* ── 왼쪽 아이콘 전용 레일 (w-[68px], md 이상) ── */}
                <aside
                    className="hidden w-[68px] shrink-0 flex-col items-center border-r py-3 md:flex"
                    style={{ background: "#000000", borderColor: "#2f3336" }}
                >
                    {/* 상단: Grok 글리프 */}
                    <GrokGlyph className="mb-5 size-8" />

                    {/* 새 채팅 */}
                    <button
                        className="grid size-10 place-items-center rounded-full"
                        style={{ color: "#e7e9ea" }}
                        aria-label="새 채팅"
                    >
                        <SquarePen className="size-5" />
                    </button>

                    {/* 대화 기록 */}
                    <button
                        className="mt-1 grid size-10 place-items-center rounded-full"
                        style={{ color: "#71767b" }}
                        aria-label="대화 기록"
                    >
                        <Clock className="size-5" />
                    </button>

                    {/* 하단: 계정 아바타 */}
                    <div className="mt-auto">
                        <span
                            className="grid size-8 place-items-center rounded-full text-[13px] font-semibold text-white"
                            style={{ background: "#1d9bf0" }}
                        >
                            {initial}
                        </span>
                    </div>
                </aside>

                {/* ── 메인 컬럼 ── */}
                <main className="flex min-w-0 flex-1 flex-col">
                    {/* 상단 헤더 */}
                    <header className="flex h-14 shrink-0 items-center justify-between px-4">
                        {/* 모델 선택 필 버튼 */}
                        <button
                            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[14px] font-medium"
                            style={{
                                borderColor: "#2f3336",
                                color: "#e7e9ea",
                                background: "transparent",
                            }}
                        >
                            Grok 4.3
                            <ChevronDown className="size-4" style={{ color: "#71767b" }} />
                        </button>

                        {/* 오른쪽 아이콘 + 아바타 */}
                        <div className="flex items-center gap-2">
                            <button
                                className="grid size-9 place-items-center rounded-full"
                                style={{ color: "#71767b" }}
                                aria-label="설정"
                            >
                                <Settings className="size-5" />
                            </button>
                            <span
                                className="grid size-8 place-items-center rounded-full text-[13px] font-semibold text-white"
                                style={{ background: "#1d9bf0" }}
                            >
                                {initial}
                            </span>
                        </div>
                    </header>

                    {isEmpty ? (
                        /* ── 빈 화면: 로고 + 인사말 + 중앙 입력창 + 제안 칩 ── */
                        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-4">
                            {/* 큰 Grok 글리프 */}
                            <GrokGlyph className="size-11" />

                            {/* 인사말 */}
                            <h1
                                className="text-2xl font-semibold tracking-tight"
                                style={{ color: "#e7e9ea" }}
                            >
                                무엇이 궁금하세요?
                            </h1>

                            {/* 중앙 입력창 */}
                            <div className="w-full">
                                <Composer />
                            </div>

                            {/* 제안 칩 줄 */}
                            <div className="flex flex-wrap justify-center gap-2">
                                {(
                                    [
                                        { Icon: Telescope, label: "DeepSearch" },
                                        { Icon: Brain, label: "Think" },
                                        { Icon: Image, label: "이미지 만들기" },
                                    ] as const
                                ).map(({ Icon, label }) => (
                                    <button
                                        key={label}
                                        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[14px]"
                                        style={{
                                            borderColor: "#2f3336",
                                            color: "#e7e9ea",
                                            background: "transparent",
                                        }}
                                    >
                                        <Icon className="size-[15px]" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* ── 대화 화면 ── */
                        <>
                            {/* 메시지 스크롤 영역 */}
                            <div ref={scrollRef} className="flex-1 overflow-y-auto">
                                <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
                                    {chat.messages.map((m) =>
                                        m.role === "user" ? (
                                            /* 사용자 메시지 — 오른쪽 정렬 다크 말풍선 */
                                            <div key={m.id} className="flex justify-end">
                                                <div
                                                    className="max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[16px] leading-7"
                                                    style={{
                                                        background: "#1d1f23",
                                                        color: "#e7e9ea",
                                                    }}
                                                >
                                                    {m.text}
                                                </div>
                                            </div>
                                        ) : (
                                            /* 어시스턴트 메시지 — 왼쪽 아바타 없는 전체폭 텍스트 */
                                            <div key={m.id} className="flex flex-col gap-2">
                                                <div className="text-[16px] leading-7">
                                                    {m.text ? (
                                                        <>
                                                            {/*
                                                             * maketor-prose가 라이트 앱 색상을 주입하므로,
                                                             * 검정 배경 위에 읽히도록 흰 계열로 강제 덮어씀.
                                                             */}
                                                            <div
                                                                className="[&_.maketor-prose]:text-[#e7e9ea] [&_*]:text-[#e7e9ea] [&_a]:text-[#1d9bf0] [&_blockquote]:border-[#2f3336] [&_code]:bg-[#16181c] [&_code]:text-[#e7e9ea] [&_strong]:text-[#ffffff]"
                                                            >
                                                                <Markdown>{m.text}</Markdown>
                                                            </div>
                                                            {/* 스트리밍 커서 */}
                                                            {chat.streamingId === m.id && (
                                                                <span style={{ color: "#ffffff" }}>
                                                                    <BlinkingCaret />
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : null}
                                                </div>

                                                {/* 완료 후 액션 버튼 줄 */}
                                                {chat.streamingId !== m.id && m.text && (
                                                    <div
                                                        className="flex items-center gap-1"
                                                        style={{ color: "#71767b" }}
                                                    >
                                                        {([Copy, ThumbsUp, ThumbsDown, RotateCcw] as const).map(
                                                            (Icon, i) => (
                                                                <button
                                                                    key={i}
                                                                    className="grid size-8 place-items-center rounded-full"
                                                                    aria-label=""
                                                                >
                                                                    <Icon className="size-[17px]" />
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    )}

                                    {/* 생각 중 — 3개 흰 점 바운스(Grok 시그니처) */}
                                    {chat.status === "thinking" && (
                                        <div className="flex items-center gap-[5px] py-1">
                                            {([0, 0.15, 0.3] as const).map((delay, i) => (
                                                <span
                                                    key={i}
                                                    className="size-[7px] rounded-full"
                                                    style={{
                                                        background: "#ffffff",
                                                        animation: "grokDotBounce 1.2s ease-in-out infinite",
                                                        animationDelay: `${delay}s`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 하단 고정 입력창 */}
                            <div className="shrink-0 px-4 pb-3">
                                <Composer />
                            </div>
                        </>
                    )}
                </main>
            </div>
        </>
    );
}

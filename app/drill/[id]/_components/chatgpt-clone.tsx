/**
 * ChatGPT 클론 — chatgpt.com 화면을 똑같이 흉내 낸 시험/연습용 컴포넌트.
 * 왼쪽 사이드바 + 모델 선택 헤더 + 가운데 입력창(빈 화면) / 하단 입력창(대화 중),
 * 사용자 회색 말풍선 / 어시스턴트 전체폭 텍스트, 검은 원형 전송 버튼과 점 깜빡임 생성
 * 애니메이션까지 실제 ChatGPT와 같은 구조로 만든다.
 */
"use client";

import { useState } from "react";
import {
    SquarePen,
    Search,
    Grid2x2,
    ChevronDown,
    Plus,
    SlidersHorizontal,
    AudioLines,
    ArrowUp,
    Square,
    Copy,
    ThumbsUp,
    ThumbsDown,
    Volume2,
    RotateCcw,
} from "lucide-react";

import { Markdown } from "@/components/markdown";
import {
    useLlmChat,
    useAutoScroll,
    BlinkingCaret,
    type LlmCloneProps,
} from "./_shared";

// OpenAI 블로섬 로고(검정).
function OpenAiMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7494-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.1419.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
        </svg>
    );
}

const SIDEBAR_HISTORY = [
    "스마트폰으로 사진 찍는 법",
    "건강에 좋은 아침 습관",
    "손주에게 쓰는 편지",
    "김치찌개 끓이는 법",
    "동네 병원 예약하는 방법",
];

export function ChatGptClone({ userName, onReplyComplete }: LlmCloneProps) {
    const chat = useLlmChat({
        provider: "chatgpt",
        onReplyComplete,
        thinkingMs: 600,
        chunk: 2,
        tickMs: 16,
    });
    const [input, setInput] = useState("");
    const scrollRef = useAutoScroll(chat.messages);

    const isEmpty = chat.messages.length === 0;
    const busy = chat.status !== "idle";
    const initial = userName.trim().charAt(0) || "나";

    // 입력값을 보내고 입력창을 비운다.
    function submit() {
        if (!input.trim() || busy) return;
        chat.send(input);
        setInput("");
    }

    // 입력창 + 전송 버튼(빈 화면·하단 공용).
    function Composer() {
        return (
            <div className="mx-auto w-full max-w-3xl px-3">
                <div className="rounded-[28px] border border-black/10 bg-white px-2.5 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
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
                        className="block max-h-40 min-h-[28px] w-full resize-none bg-transparent px-2.5 pt-1.5 text-[16px] leading-6 text-[#0d0d0d] outline-none placeholder:text-black/40"
                    />
                    <div className="flex items-center justify-between px-1 pt-1">
                        <div className="flex items-center gap-1">
                            <button className="grid size-9 place-items-center rounded-full text-[#0d0d0d] hover:bg-black/5" aria-label="추가">
                                <Plus className="size-5" />
                            </button>
                            <button className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[14px] text-[#0d0d0d] hover:bg-black/5">
                                <SlidersHorizontal className="size-[18px]" />
                                도구
                            </button>
                        </div>
                        <div className="flex items-center gap-1">
                            <button className="grid size-9 place-items-center rounded-full text-[#0d0d0d] hover:bg-black/5" aria-label="음성">
                                <AudioLines className="size-5" />
                            </button>
                            <button
                                onClick={submit}
                                disabled={!input.trim() && !busy}
                                aria-label={busy ? "생성 중" : "보내기"}
                                className="grid size-9 place-items-center rounded-full bg-[#0d0d0d] text-white transition-opacity disabled:bg-black/15 disabled:text-white"
                            >
                                {busy ? (
                                    <Square className="size-3.5 fill-current" />
                                ) : (
                                    <ArrowUp className="size-5" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                <p className="py-2 text-center text-[12px] text-black/50">
                    ChatGPT는 실수를 할 수 있습니다. 중요한 정보는 확인하세요.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full overflow-hidden bg-white font-sans text-[#0d0d0d]">
            {/* 사이드바 */}
            <aside className="hidden w-[260px] shrink-0 flex-col bg-[#f9f9f9] md:flex">
                <div className="flex items-center justify-between px-3 py-3">
                    <OpenAiMark className="size-6" />
                    <button className="grid size-8 place-items-center rounded-lg text-black/70 hover:bg-black/5" aria-label="사이드바">
                        <SquarePen className="size-[18px]" />
                    </button>
                </div>
                <nav className="flex flex-col gap-0.5 px-2 text-[14px]">
                    <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-black/5">
                        <SquarePen className="size-[18px]" /> 새 채팅
                    </button>
                    <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-black/5">
                        <Search className="size-[18px]" /> 채팅 검색
                    </button>
                    <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-black/5">
                        <Grid2x2 className="size-[18px]" /> GPT 탐색
                    </button>
                </nav>
                <div className="mt-4 px-4 pb-1 text-[12px] font-medium text-black/40">채팅</div>
                <div className="flex-1 overflow-y-auto px-2">
                    {SIDEBAR_HISTORY.map((t) => (
                        <button
                            key={t}
                            className="block w-full truncate rounded-lg px-2 py-2 text-left text-[14px] text-black/80 hover:bg-black/5"
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2.5 border-t border-black/5 px-3 py-3">
                    <span className="grid size-7 place-items-center rounded-full bg-[#6b4eff] text-[13px] font-semibold text-white">
                        {initial}
                    </span>
                    <span className="text-[14px] font-medium">{userName || "사용자"}</span>
                </div>
            </aside>

            {/* 본문 */}
            <main className="flex min-w-0 flex-1 flex-col">
                {/* 상단 바 */}
                <header className="flex h-14 items-center justify-between px-3">
                    <button className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[18px] font-medium hover:bg-black/5">
                        ChatGPT <span className="text-black/40">5.5</span>
                        <ChevronDown className="size-4 text-black/40" />
                    </button>
                    <span className="grid size-8 place-items-center rounded-full bg-[#6b4eff] text-[13px] font-semibold text-white">
                        {initial}
                    </span>
                </header>

                {isEmpty ? (
                    /* 빈 화면 — 인사말 + 가운데 입력창 */
                    <div className="flex flex-1 flex-col items-center justify-center gap-7 px-4">
                        <h1 className="text-[28px] font-semibold tracking-tight text-[#0d0d0d]">
                            무엇을 도와드릴까요?
                        </h1>
                        <div className="w-full">
                            {Composer()}
                        </div>
                    </div>
                ) : (
                    /* 대화 화면 */
                    <>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto">
                            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
                                {chat.messages.map((m) =>
                                    m.role === "user" ? (
                                        <div key={m.id} className="flex justify-end">
                                            <div className="max-w-[75%] whitespace-pre-wrap rounded-3xl bg-[#f4f4f4] px-5 py-2.5 text-[16px] leading-7 text-[#0d0d0d]">
                                                {m.text}
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={m.id} className="flex flex-col gap-2">
                                            <div className="text-[16px] leading-7 text-[#0d0d0d]">
                                                {m.text ? (
                                                    <div className="relative">
                                                        <Markdown>{m.text}</Markdown>
                                                        {chat.streamingId === m.id && (
                                                            <BlinkingCaret className="text-[#0d0d0d]" />
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
                                            {/* 답변이 끝나면 동작 버튼 줄 */}
                                            {chat.streamingId !== m.id && m.text && (
                                                <div className="flex items-center gap-1 text-black/50">
                                                    {[Copy, ThumbsUp, ThumbsDown, Volume2, RotateCcw].map(
                                                        (Icon, i) => (
                                                            <button
                                                                key={i}
                                                                className="grid size-8 place-items-center rounded-lg hover:bg-black/5 hover:text-black/80"
                                                            >
                                                                <Icon className="size-[18px]" />
                                                            </button>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ),
                                )}

                                {/* 생각 중 — 점 하나가 숨 쉬듯 깜빡 */}
                                {chat.status === "thinking" && (
                                    <div className="flex items-center">
                                        <span
                                            className="size-4 rounded-full bg-[#0d0d0d]"
                                            style={{ animation: "drillPulse 1.2s ease-in-out infinite" }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="pb-3">
                            {Composer()}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

/**
 * Gemini 클론 — gemini.google.com 화면을 최대한 똑같이 흉내 낸 시험/연습용 컴포넌트.
 * 왼쪽 사이드바(최근 대화) + 상단 헤더 + 빈 화면 그라데이션 인사말 + 하단 고정 입력창,
 * 4꼭짓점 별(Gemini Spark) 아바타·로고, 반짝이는 생성 애니메이션까지 구현한다.
 */
"use client";

import { useRef, useState } from "react";
import {
    Menu,
    Plus,
    Settings,
    ChevronDown,
    Mic,
    ArrowUp,
    Square,
    ThumbsUp,
    ThumbsDown,
    Share2,
    RotateCcw,
    MoreVertical,
} from "lucide-react";

import { Markdown } from "@/components/markdown";
import {
    useFakeChat,
    useAutoScroll,
    BlinkingCaret,
    type LlmCloneProps,
} from "./_shared";

// 사이드바 최근 대화 목록.
const SIDEBAR_HISTORY = [
    "스마트폰으로 사진 찍는 법",
    "건강에 좋은 아침 습관",
    "손주에게 쓰는 편지",
    "오늘 날씨 알려줘",
    "가까운 약국 찾기",
];

// 어시스턴트 메시지 액션 아이콘과 레이블 목록.
const ACTION_ICONS = [
    { Icon: ThumbsUp, label: "좋아요" },
    { Icon: ThumbsDown, label: "싫어요" },
    { Icon: Share2, label: "공유" },
    { Icon: RotateCcw, label: "재생성" },
    { Icon: MoreVertical, label: "더보기" },
] as const;

/**
 * Gemini 4꼭짓점 별(Spark) SVG 컴포넌트.
 * 로고·아바타·생각 중 표시에 공용으로 쓰며, gradId를 달리해 gradient id 충돌을 피한다.
 */
function GeminiSpark({
    size = 24,
    className,
    gradId = "geminiGrad",
    style,
}: {
    size?: number;
    className?: string;
    gradId?: string;
    style?: React.CSSProperties;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            style={style}
            aria-hidden
        >
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#4285f4" />
                    <stop offset="50%" stopColor="#9b72cb" />
                    <stop offset="100%" stopColor="#d96570" />
                </linearGradient>
            </defs>
            <path
                d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
                fill={`url(#${gradId})`}
            />
        </svg>
    );
}

/** 생각 중 샤머링 플레이스홀더 줄 3개 — 반짝이는 별과 함께 표시된다. */
function ThinkingShimmer({ gradId }: { gradId: string }) {
    return (
        <div className="flex items-center gap-3">
            <GeminiSpark
                size={26}
                gradId={gradId}
                style={{
                    animation: "drillSparkle 1.4s ease-in-out infinite",
                    transformOrigin: "center",
                    flexShrink: 0,
                }}
            />
            <div className="flex flex-col gap-2">
                {[140, 200, 100].map((w, i) => (
                    <div
                        key={i}
                        className="rounded-full"
                        style={{
                            width: w,
                            height: 10,
                            background: "#e8eaed",
                            animation: `drillPulse 1.6s ease-in-out ${i * 0.18}s infinite`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

/** Gemini 클론 메인 컴포넌트 — 사이드바·헤더·메시지 영역·입력창 전체를 렌더링한다. */
export function GeminiClone({ userName, onReplyComplete }: LlmCloneProps) {
    const chat = useFakeChat({
        provider: "gemini",
        onReplyComplete,
        thinkingMs: 750,
        chunk: 3,
        tickMs: 16,
    });
    const [input, setInput] = useState("");
    const scrollRef = useAutoScroll(chat.messages);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isEmpty = chat.messages.length === 0;
    const busy = chat.status !== "idle";
    const initial = userName.trim().charAt(0).toUpperCase() || "나";

    /** 입력값을 보내고 입력창을 초기화한다. */
    function submit() {
        if (!input.trim() || busy) return;
        chat.send(input);
        setInput("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }

    /** textarea 높이를 내용에 맞게 자동으로 조절한다. */
    function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }

    /** 입력창 + 전송 버튼 — 빈 화면과 대화 중 화면에서 공용으로 쓴다. */
    function Composer() {
        return (
            <div className="mx-auto w-full max-w-3xl px-4">
                <div
                    className="flex flex-col rounded-[28px] border border-black/5 px-4 py-2.5"
                    style={{ background: "#f0f4f9" }}
                >
                    <div className="flex items-start gap-2">
                        {/* 왼쪽 플러스 버튼 */}
                        <button
                            className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-black/8"
                            style={{ color: "#444746" }}
                            aria-label="파일 추가"
                        >
                            <Plus className="size-5" />
                        </button>

                        {/* 텍스트 입력 영역 */}
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleTextareaChange}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    submit();
                                }
                            }}
                            rows={1}
                            placeholder="Gemini에게 물어보기"
                            className="flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-6 outline-none placeholder:text-[#444746]/60"
                            style={{ minHeight: "28px", maxHeight: "160px", color: "#1f1f1f" }}
                        />

                        {/* 오른쪽 버튼 — 바쁨: 정지 / 입력 있음: 전송 / 기본: 마이크 */}
                        <div className="mt-1.5 shrink-0">
                            {busy ? (
                                <button
                                    aria-label="생성 중지"
                                    className="grid size-9 place-items-center rounded-full text-white transition-colors"
                                    style={{ background: "#1a73e8" }}
                                >
                                    <Square className="size-3.5 fill-white" />
                                </button>
                            ) : input.trim() ? (
                                <button
                                    onClick={submit}
                                    aria-label="보내기"
                                    className="grid size-9 place-items-center rounded-full text-white transition-colors hover:brightness-90"
                                    style={{ background: "#1a73e8" }}
                                >
                                    <ArrowUp className="size-5" />
                                </button>
                            ) : (
                                <button
                                    aria-label="음성 입력"
                                    className="grid size-9 place-items-center rounded-full transition-colors hover:bg-black/8"
                                    style={{ color: "#444746" }}
                                >
                                    <Mic className="size-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 면책 문구 */}
                <p
                    className="py-2 text-center text-[12px]"
                    style={{ color: "#444746" }}
                >
                    Gemini는 실수를 할 수 있어요. 중요한 정보는 다시 확인하세요.
                </p>
            </div>
        );
    }

    return (
        <div
            className="flex h-full w-full overflow-hidden font-sans"
            style={{ background: "#ffffff", color: "#1f1f1f" }}
        >
            {/* ───── 사이드바 ───── */}
            <aside
                className="hidden w-[280px] shrink-0 flex-col md:flex"
                style={{ background: "#f0f4f9" }}
            >
                {/* 상단 — 햄버거 + 새 채팅 */}
                <div className="flex flex-col gap-3 px-3 pt-4 pb-3">
                    <button
                        className="grid size-10 place-items-center self-start rounded-full transition-colors hover:bg-black/8"
                        style={{ color: "#444746" }}
                        aria-label="메뉴"
                    >
                        <Menu className="size-5" />
                    </button>
                    <button
                        className="flex items-center gap-2 self-start rounded-full border border-black/10 bg-white px-4 py-2 text-[14px] font-medium shadow-sm transition-colors hover:bg-black/5"
                        style={{ color: "#1f1f1f" }}
                    >
                        <Plus className="size-4" />
                        새 채팅
                    </button>
                </div>

                {/* 최근 대화 목록 */}
                <div className="flex-1 overflow-y-auto px-2 py-1">
                    <p
                        className="px-3 py-1 text-[12px] font-medium"
                        style={{ color: "#444746" }}
                    >
                        최근
                    </p>
                    {SIDEBAR_HISTORY.map((title) => (
                        <button
                            key={title}
                            className="block w-full truncate rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors hover:bg-black/6"
                            style={{ color: "#1f1f1f" }}
                        >
                            {title}
                        </button>
                    ))}
                </div>

                {/* 하단 — 설정 */}
                <div className="border-t border-black/8 px-2 py-3">
                    <button
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/6"
                    >
                        <Settings className="size-[18px]" style={{ color: "#444746" }} />
                        <span className="text-[14px]" style={{ color: "#444746" }}>
                            설정 및 도움말
                        </span>
                    </button>
                </div>
            </aside>

            {/* ───── 본문 ───── */}
            <main className="flex min-w-0 flex-1 flex-col bg-white">
                {/* 상단 헤더 */}
                <header className="flex h-14 items-center justify-between px-4">
                    {/* 왼쪽 — Gemini 워드마크 + 모델 선택 */}
                    <button
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-black/5"
                    >
                        <span className="text-xl font-medium" style={{ color: "#444746" }}>
                            Gemini
                        </span>
                        <span
                            className="flex items-center gap-0.5 rounded-full border border-black/15 px-2 py-0.5 text-[13px] font-medium"
                            style={{ color: "#444746" }}
                        >
                            3.5 Flash
                            <ChevronDown className="size-3.5" />
                        </span>
                    </button>

                    {/* 오른쪽 — PRO 이용 버튼 + 구글 계정 아바타 */}
                    <div className="flex items-center gap-2">
                        <button
                            className="hidden rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors hover:bg-blue-50 sm:block"
                            style={{ borderColor: "#1a73e8", color: "#1a73e8" }}
                        >
                            PRO 이용
                        </button>
                        <span
                            className="grid size-9 place-items-center rounded-full text-[14px] font-semibold text-white select-none"
                            style={{ background: "#1a73e8" }}
                            aria-label={`${userName} 아바타`}
                        >
                            {initial}
                        </span>
                    </div>
                </header>

                {isEmpty ? (
                    /* ───── 빈 화면 — 인사말 + 하단 고정 입력창 ───── */
                    <div className="flex flex-1 flex-col pb-4">
                        <div className="flex-1 px-6 pt-14">
                            <h1 className="drill-gemini-gradient mb-3 text-4xl font-medium sm:text-5xl">
                                안녕하세요, {userName || "사용자"}님
                            </h1>
                            <p className="text-[18px]" style={{ color: "#444746" }}>
                                무엇을 도와드릴까요?
                            </p>
                        </div>
                        <Composer />
                    </div>
                ) : (
                    /* ───── 대화 화면 ───── */
                    <>
                        {/* 스크롤 가능한 메시지 영역 */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto">
                            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
                                {chat.messages.map((m) =>
                                    m.role === "user" ? (
                                        /* 사용자 메시지 — 오른쪽 말풍선 */
                                        <div key={m.id} className="flex justify-end">
                                            <div
                                                className="max-w-[78%] whitespace-pre-wrap rounded-[20px] px-4 py-2.5 text-[16px] leading-7"
                                                style={{ background: "#f0f4f9", color: "#1f1f1f" }}
                                            >
                                                {m.text}
                                            </div>
                                        </div>
                                    ) : (
                                        /* 어시스턴트 메시지 — 왼쪽 별 아바타 + 텍스트 */
                                        <div key={m.id} className="flex flex-col gap-1">
                                            <div className="flex items-start gap-3">
                                                {/* Gemini Spark 아바타 — 각 메시지마다 고유 gradId */}
                                                <GeminiSpark
                                                    size={28}
                                                    gradId={`geminiGradAvatar-${m.id}`}
                                                    className="mt-0.5 shrink-0"
                                                />

                                                <div className="min-w-0 flex-1">
                                                    {/* 생각 중 표시 — 마지막 어시스턴트 메시지가 비어있을 때 */}
                                                    {chat.status === "thinking" && !m.text && (
                                                        <ThinkingShimmer gradId={`geminiGradThink-${m.id}`} />
                                                    )}

                                                    {/* 스트리밍 중 또는 완료된 텍스트 */}
                                                    {m.text && (
                                                        <div
                                                            className="text-[16px] leading-7"
                                                            style={{ color: "#1f1f1f" }}
                                                        >
                                                            <Markdown>{m.text}</Markdown>
                                                            {chat.streamingId === m.id && (
                                                                <BlinkingCaret className="text-[#1a73e8]" />
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* 답변 완료 후 액션 버튼 줄 */}
                                                    {chat.streamingId !== m.id && m.text && (
                                                        <div
                                                            className="mt-2 flex items-center gap-0.5"
                                                            style={{ color: "#444746" }}
                                                        >
                                                            {ACTION_ICONS.map(({ Icon, label }) => (
                                                                <button
                                                                    key={label}
                                                                    aria-label={label}
                                                                    className="grid size-8 place-items-center rounded-full transition-colors hover:bg-black/8"
                                                                >
                                                                    <Icon className="size-[18px]" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ),
                                )}

                                {/* 최상위 "생각 중" — 아직 어시스턴트 메시지 객체가 없는 직후 */}
                                {chat.status === "thinking" &&
                                    !chat.messages.some((m) => m.role === "assistant") && (
                                        <div className="flex items-start gap-3">
                                            <GeminiSpark
                                                size={28}
                                                gradId="geminiGradThinkRoot"
                                                className="mt-0.5 shrink-0"
                                            />
                                            <ThinkingShimmer gradId="geminiGradThinkRootInner" />
                                        </div>
                                    )}
                            </div>
                        </div>

                        {/* 하단 고정 입력창 */}
                        <div className="pb-3">
                            <Composer />
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

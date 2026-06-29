/**
 * AI 페이지 만들기 채팅 — 빌더 좌하단 플로팅 버튼을 누르면 작은 채팅창이 열리고,
 * AI와 대화하면 "지금 보고 있는 페이지"만 만들어 캔버스에 자동 반영한다(되돌리기 가능).
 * 대화 내역은 페이지마다 따로 보관돼, 다른 페이지로 가면 그 페이지의 대화로 바뀐다.
 * 응답은 lib/course-format의 docToPage로 런타임 Page로 변환해 현재 페이지를 교체한다.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, X, ArrowUp, Mic, Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Page } from "@/lib/types";
import { generatePage } from "@/lib/api";
import { docToPage } from "@/lib/course-format";
import { formatCredits } from "@/lib/credits";
import { useIdentity } from "@/lib/identity";
import { newId } from "@/lib/id";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { useSonioxStt } from "@/lib/soniox-stt";

/** 채팅에 쌓이는 메시지 한 개. */
interface ChatMsg {
    id: string;
    role: "user" | "assistant";
    content: string;
    /** assistant 메시지의 부가 정보(비용·소요시간·페이지 반영 여부). */
    meta?: { credits: number; free: boolean; genMs: number; applied: boolean };
}

/** 빌더에서 받는 props — 현재 페이지와 적용/되돌리기 콜백. */
export function AiCourseChat({
    page,
    pageIndex,
    courseTitle,
    onApplyPage,
    canUndo,
    onUndo,
}: {
    page: Page;
    pageIndex: number;
    courseTitle: string;
    onApplyPage: (pageId: string, page: Page) => void;
    canUndo: boolean;
    onUndo: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    // 페이지 id별 대화 스레드 — 페이지를 옮기면 그 페이지의 대화만 보인다.
    const [threads, setThreads] = useState<Record<string, ChatMsg[]>>({});
    // 지금 생성 중인 요청이 어느 페이지를 향하는지(없으면 null).
    const [sendingPageId, setSendingPageId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { userId, nickname } = useIdentity();

    const msgs = threads[page.id] ?? [];
    const sendingHere = sendingPageId === page.id;

    // 마이크 받아쓰기 시작 시점의 입력값을 접두로 두고, 전사 텍스트를 이어 붙인다.
    const sttBaseRef = useRef("");
    const stt = useSonioxStt({
        onText: (t) => setInput(sttBaseRef.current ? `${sttBaseRef.current} ${t}` : t),
        onError: (m) => toast.error(m),
        languageHints: ["ko", "en"],
    });

    // 마이크 토글 — 켜면 받아쓰기 시작(끄면 텍스트는 그대로 두고 전송하지 않음).
    // 마이크를 못 쓰면(보안 컨텍스트 아님 등) 비활성 대신 이유를 알려준다.
    function toggleMic() {
        if (!stt.supported) {
            const insecure = typeof window !== "undefined" && !window.isSecureContext;
            toast.error(
                insecure
                    ? "마이크는 보안 연결에서만 동작해요. localhost 또는 https로 접속해 주세요. (지금처럼 http://192.168.x.x 같은 LAN 주소에선 브라우저가 마이크를 막습니다.)"
                    : "이 브라우저에서는 마이크 받아쓰기를 쓸 수 없어요.",
            );
            return;
        }
        if (stt.listening) {
            stt.stop();
            return;
        }
        sttBaseRef.current = input.trim();
        void stt.start();
    }

    // 페이지가 바뀌면 입력칸을 비운다(대화 내역은 페이지별로 유지).
    useEffect(() => {
        setInput("");
    }, [page.id]);

    // 패널이 열리면(애니메이션 뒤) 입력칸에 포커스를 준다.
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => inputRef.current?.focus(), 210);
        return () => clearTimeout(t);
    }, [open]);

    // 새 메시지가 쌓이거나 생각 중일 때 맨 아래로 스크롤한다.
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, [threads, page.id, sendingPageId]);

    /** 한 페이지 스레드에 메시지를 덧붙인다. */
    function appendMsg(pid: string, msg: ChatMsg) {
        setThreads((prev) => ({ ...prev, [pid]: [...(prev[pid] ?? []), msg] }));
    }

    // 입력을 보내 AI 응답을 받고, 페이지가 오면 현재 페이지를 교체한다.
    async function send() {
        const content = input.trim();
        if (!content || sendingPageId) return;
        // 전송하면 받아쓰기는 끈다(켜져 있었다면 OFF로 전환).
        if (stt.listening) stt.stop();
        // 요청이 향하는 페이지를 전송 시점에 고정(생성 중 페이지를 옮겨도 올바른 페이지에 반영).
        const pid = page.id;
        const titleSnap = page.title;
        const pageSnap = { title: page.title, blocks: page.blocks as unknown[] };

        const userMsg: ChatMsg = { id: newId(), role: "user", content };
        const history = [...(threads[pid] ?? []), userMsg].map((m) => ({
            role: m.role,
            content: m.content,
        }));
        appendMsg(pid, userMsg);
        setInput("");
        setSendingPageId(pid);
        try {
            const res = await generatePage({
                messages: history,
                currentPage: pageSnap,
                courseTitle,
                userId: userId ?? undefined,
                userName: nickname ?? undefined,
            });

            let applied = false;
            if (res.page) {
                try {
                    const next = docToPage(res.page, { id: pid });
                    onApplyPage(pid, { ...next, title: next.title || titleSnap });
                    applied = true;
                } catch (err) {
                    toast.error(err instanceof Error ? err.message : "페이지를 반영하지 못했어요.");
                }
            }

            appendMsg(pid, {
                id: newId(),
                role: "assistant",
                content: res.reply,
                meta: { credits: res.credits, free: res.free, genMs: res.genMs, applied },
            });
            if (applied) toast.success("이 페이지에 반영했어요. 되돌리려면 ↩ 버튼을 누르세요.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "페이지 생성에 실패했어요.");
        } finally {
            setSendingPageId(null);
        }
    }

    // Enter로 전송, Shift+Enter로 줄바꿈.
    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
        }
    }

    return (
        <>
            {/* 플로팅 버튼 — 패널이 열리면 부드럽게 사라진다. */}
            <Button
                onClick={() => setOpen(true)}
                className={cn(
                    "fixed bottom-6 left-6 z-40 h-12 gap-2 rounded-full px-5 shadow-lg",
                    "transition-all duration-200 ease-out motion-reduce:transition-none",
                    open
                        ? "pointer-events-none translate-y-2 scale-90 opacity-0"
                        : "translate-y-0 scale-100 opacity-100",
                )}
                aria-label="AI로 강의 만들기"
                aria-hidden={open}
                tabIndex={open ? -1 : 0}
            >
                <Bot className="size-5" /> AI로 만들기
            </Button>

            {/* 패널 — 버튼 자리(좌하단)에서 자라나고, 닫으면 그 자리로 줄어든다. */}
            <div
                className={cn(
                    "fixed bottom-6 left-6 z-40 flex h-[30rem] max-h-[calc(100vh-6rem)] w-[22rem] max-w-[calc(100vw-3rem)] origin-bottom-left flex-col overflow-hidden rounded-2xl border bg-background shadow-xl",
                    "transition-all duration-200 ease-out motion-reduce:transition-none",
                    open
                        ? "translate-y-0 scale-100 opacity-100"
                        : "pointer-events-none translate-y-3 scale-95 opacity-0",
                )}
                role="dialog"
                aria-label="AI 페이지 만들기"
                aria-hidden={!open}
            >
            {/* 헤더 — 지금 편집 중인 페이지 번호를 함께 보여 범위를 분명히 한다. */}
            <div className="flex items-center gap-2 border-b px-3 py-2">
                <Bot className="size-4 text-primary" />
                <span className="text-sm font-semibold">AI 페이지 만들기</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {pageIndex + 1}페이지
                </span>
                <div className="ml-auto flex items-center gap-1">
                    {canUndo && (
                        <Button size="icon-sm" variant="ghost" onClick={onUndo} aria-label="되돌리기">
                            <Undo2 className="size-4" />
                        </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)} aria-label="닫기">
                        <X className="size-4" />
                    </Button>
                </div>
            </div>

            {/* 메시지 목록(현재 페이지 스레드) */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
                {msgs.length === 0 && (
                    <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                        이 페이지에 무엇을 담을까요? 예: <span className="font-medium">&ldquo;분수 개념을 쉽게 설명해줘&rdquo;</span>
                        <br />
                        만든 뒤 &ldquo;더 쉽게&rdquo;, &ldquo;이미지 추가&rdquo; 처럼 이어서 고칠 수 있어요. 대화는 페이지마다 따로 저장돼요.
                    </div>
                )}
                {msgs.map((m) =>
                    m.role === "user" ? (
                        <div key={m.id} className="flex justify-end">
                            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                                {m.content}
                            </div>
                        </div>
                    ) : (
                        <div key={m.id} className="flex flex-col gap-1">
                            <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
                                <Markdown className="text-sm">{m.content}</Markdown>
                            </div>
                            {m.meta && (
                                <span className="px-1 text-[11px] text-muted-foreground">
                                    {m.meta.applied ? "✓ 이 페이지에 반영됨 · " : ""}
                                    {m.meta.free ? "무료" : `${formatCredits(m.meta.credits)} 크레딧`} ·{" "}
                                    {(m.meta.genMs / 1000).toFixed(1)}초
                                </span>
                            )}
                        </div>
                    ),
                )}
                {sendingHere && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> 페이지를 짜는 중…
                    </div>
                )}
            </div>

            {/* 입력 — Gemini 스타일 둥근 입력바 + 마이크 받아쓰기(ON/OFF) */}
            <div className="p-2">
                <div className="flex flex-col gap-1 rounded-[22px] border bg-background px-2.5 py-2 shadow-sm transition-colors focus-within:border-ring">
                    <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={
                            stt.listening
                                ? "듣고 있어요… 말해보세요"
                                : `${pageIndex + 1}페이지에 담을 내용을 말해보세요…`
                        }
                        rows={1}
                        className="max-h-28 min-h-8 resize-none border-0 bg-transparent px-1 py-0.5 text-sm shadow-none focus-visible:ring-0"
                        disabled={!!sendingPageId}
                        aria-label="AI에게 보낼 메시지"
                    />
                    <div className="flex items-center gap-1">
                        {stt.listening && (
                            <span className="mr-auto flex items-center gap-1.5 pl-1 text-[11px] font-medium text-red-500">
                                <span className="size-2 animate-pulse rounded-full bg-red-500" /> 듣는 중…
                            </span>
                        )}
                        <Button
                            type="button"
                            size="icon-sm"
                            variant={stt.listening ? "default" : "ghost"}
                            onClick={toggleMic}
                            disabled={!!sendingPageId}
                            className={cn(
                                "ml-auto rounded-full",
                                stt.listening && "animate-pulse bg-red-500 text-white hover:bg-red-600",
                                !stt.supported && "opacity-60",
                            )}
                            aria-label={stt.listening ? "받아쓰기 끄기" : "받아쓰기 켜기"}
                            aria-pressed={stt.listening}
                            title={
                                stt.supported
                                    ? "마이크로 받아쓰기"
                                    : "마이크는 localhost나 https에서만 돼요(눌러서 안내 보기)"
                            }
                        >
                            <Mic className="size-4" />
                        </Button>
                        <Button
                            type="button"
                            size="icon-sm"
                            onClick={() => void send()}
                            disabled={!!sendingPageId || !input.trim()}
                            className="rounded-full"
                            aria-label="보내기"
                        >
                            {sendingHere ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <ArrowUp className="size-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>
            </div>
        </>
    );
}

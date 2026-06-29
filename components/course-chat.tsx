/**
 * 강의 실시간 채팅 패널 — 강의 수강자들이 결과물을 공유하고 소통하는 클라이언트 컴포넌트.
 * 폴링(4초)으로 메시지를 동기화하며 이미지·영상·오디오 첨부 파일을 지원한다.
 */
"use client";

import * as React from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { getChat, postChat, reactToMessage } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { avatarSrc } from "@/lib/avatars";
import type { ChatMessage, ChatAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupTextarea,
} from "@/components/ui/input-group";
import { WorkPickerDialog } from "@/components/work-picker-dialog";
import { AttachmentPreview, PendingChip } from "@/components/chat-attachment";

// 말풍선 우클릭 시 고를 수 있는 이모지 반응 목록(좋아요 등).
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉", "🔥"] as const;

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function MessageBubble({
    message,
    isOwn,
    currentUserAvatar,
    viewerId,
    onOpenMenu,
    onToggleReaction,
    onNavigateToBlock,
}: {
    message: ChatMessage;
    isOwn: boolean;
    currentUserAvatar?: string | null;
    viewerId: string;
    onOpenMenu: (e: React.MouseEvent, messageId: string) => void;
    onToggleReaction: (messageId: string, emoji: string) => void;
    onNavigateToBlock?: (pageIdx: number, blockId: string) => void;
}) {
    // Own messages reflect the user's CURRENT avatar (live), so changing the
    // profile picture instantly updates one's own past messages too.
    const avatarKey = isOwn ? currentUserAvatar ?? message.avatar : message.avatar;
    // 이모지별 누른 사람 수가 1명 이상인 항목만 칩으로 보여 준다.
    const reactionEntries = Object.entries(message.reactions ?? {}).filter(
        ([, users]) => users.length > 0,
    );
    // 첨부가 있으면 버블을 넓혀 미디어/파일이 가로를 꽉 채우게 한다.
    const hasAttachment = message.attachments.length > 0;
    return (
        <div
            className={cn(
                "flex gap-2.5 px-3 py-2",
                isOwn ? "flex-row-reverse" : "flex-row"
            )}
        >
            <Avatar size="sm" className="shrink-0 mt-0.5">
                {avatarSrc(avatarKey) && (
                    <AvatarImage src={avatarSrc(avatarKey)!} alt="" />
                )}
                <AvatarFallback className="text-xs font-medium">
                    {message.nickname.charAt(0).toUpperCase()}
                </AvatarFallback>
            </Avatar>

            <div
                className={cn(
                    "flex min-w-0 flex-col gap-1",
                    hasAttachment ? "w-full max-w-[85%] sm:max-w-[440px]" : "max-w-[78%]",
                    isOwn ? "items-end" : "items-start"
                )}
            >
                {/* Header: nickname + badge + timestamp */}
                <div
                    className={cn(
                        "flex items-center gap-1.5 flex-wrap",
                        isOwn ? "flex-row-reverse" : "flex-row"
                    )}
                >
                    <span className="text-sm font-medium leading-none">
                        {message.nickname}
                    </span>
                    <Badge
                        variant={message.role === "instructor" ? "default" : "secondary"}
                        className="text-[10px] h-4 px-1.5"
                    >
                        {message.role === "instructor" ? "강사" : "학생"}
                    </Badge>
                    <span className="mono text-[10px] text-muted-foreground tabular-nums">
                        {formatTime(message.createdAt)}
                    </span>
                </div>

                {/* Bubble — 우클릭(또는 길게 눌러)하면 이모지 반응 메뉴가 열린다. */}
                <div
                    onContextMenu={(e) => onOpenMenu(e, message.id)}
                    className={cn(
                        "rounded-xl px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap cursor-default",
                        hasAttachment && "w-full",
                        isOwn
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted text-foreground rounded-tl-sm"
                    )}
                >
                    {message.text && <p>{message.text}</p>}

                    {message.attachments.length > 0 && (
                        <div
                            className={cn(
                                "flex flex-col gap-2",
                                message.text ? "mt-2" : ""
                            )}
                        >
                            {message.attachments.map((att, i) => (
                                <AttachmentPreview
                                    key={i}
                                    attachment={att}
                                    onNavigateToBlock={onNavigateToBlock}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Reaction chips — 누른 이모지·인원수. 다시 누르면 내 반응 취소. */}
                {reactionEntries.length > 0 && (
                    <div
                        className={cn(
                            "flex flex-wrap gap-1",
                            isOwn ? "justify-end" : "justify-start"
                        )}
                    >
                        {reactionEntries.map(([emoji, users]) => {
                            const mine = users.includes(viewerId);
                            return (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => onToggleReaction(message.id, emoji)}
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors",
                                        mine
                                            ? "border-primary/60 bg-primary/10 text-foreground"
                                            : "border-border bg-muted/60 text-muted-foreground hover:bg-muted"
                                    )}
                                    aria-label={`${emoji} ${users.length}명`}
                                >
                                    <span className="text-sm leading-none">{emoji}</span>
                                    <span className="tabular-nums">{users.length}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export function CourseChat({
    courseId,
    className,
    incoming,
    onIncomingConsumed,
    onNavigateToBlock,
}: {
    courseId: string;
    className?: string;
    /** 외부(강의 블럭 우클릭)에서 주입한 첨부 대기열 — 받으면 입력 칩으로 더하고 비운다. */
    incoming?: ChatAttachment[];
    /** incoming을 소비했음을 부모에 알린다(부모가 대기열을 비우게). */
    onIncomingConsumed?: () => void;
    /** 블럭 링크 칩 클릭 시 해당 페이지·블럭으로 이동 요청. */
    onNavigateToBlock?: (pageIdx: number, blockId: string) => void;
}) {
    const { userId, nickname, role, avatar, hydrated } = useIdentity();

    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [text, setText] = React.useState("");
    const [pending, setPending] = React.useState<ChatAttachment[]>([]);
    const [sending, setSending] = React.useState(false);
    const [pickerOpen, setPickerOpen] = React.useState(false);
    // 우클릭으로 연 이모지 반응 메뉴 — 대상 메시지 id와 화면 좌표(없으면 닫힘).
    const [reactionMenu, setReactionMenu] = React.useState<{
        messageId: string;
        x: number;
        y: number;
    } | null>(null);

    // 반응 주인을 식별할 안정적 뷰어 id — 계정 id가 없으면 닉네임으로 대체한다.
    const viewerId = (userId && userId.trim()) || nickname || "";

    const bottomRef = React.useRef<HTMLDivElement>(null);

    // 폴링 — 매 주기 전체를 다시 가져와(full fetch) 화면에 이미 있는 메시지도
    // 서버가 라이브로 해석한 프로필(아바타·표시 이름)을 반영하게 한다. 서버가
    // 진실의 원천이며, 서버가 아직 echo 하지 않은 낙관적 로컬 메시지는 보존한다.
    React.useEffect(() => {
        let cancelled = false;

        async function poll() {
            try {
                const { messages: serverMsgs } = await getChat(courseId, 0);
                if (cancelled) return;
                setMessages((prev) => {
                    const serverIds = new Set(serverMsgs.map((m) => m.id));
                    const optimistic = prev.filter((m) => !serverIds.has(m.id));
                    return [...serverMsgs, ...optimistic];
                });
            } catch {
                // silently ignore poll errors
            }
        }

        poll();
        const id = setInterval(poll, 4000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId]);

    // 새 메시지가 실제로 도착했을 때만 맨 아래로 스크롤한다. 주기적 프로필 갱신은
    // 목록을 다시 쓰지만 마지막 메시지 id는 그대로이므로 스크롤을 건드리지 않는다.
    const lastMsgIdRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        const tailId = messages.length ? messages[messages.length - 1].id : null;
        if (tailId !== lastMsgIdRef.current) {
            lastMsgIdRef.current = tailId;
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // 작품 가져오기 다이얼로그에서 고른 첨부(작품/업로드)를 대기 목록에 더한다.
    function addAttachments(atts: ChatAttachment[]) {
        if (atts.length === 0) return;
        setPending((prev) => [...prev, ...atts]);
    }

    // 외부에서 주입한 첨부(블럭 링크)를 대기 목록에 더하고 부모 대기열을 비우게 알린다.
    React.useEffect(() => {
        if (!incoming || incoming.length === 0) return;
        setPending((prev) => [...prev, ...incoming]);
        onIncomingConsumed?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [incoming]);

    // 말풍선 우클릭 — 기본 메뉴 대신 이모지 반응 메뉴를 말풍선 "아래쪽"에 연다(글 안 가리게).
    function openReactionMenu(e: React.MouseEvent, messageId: string) {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setReactionMenu({
            messageId,
            x: rect.left,
            y: rect.bottom + 6,
        });
    }

    // 메뉴가 열려 있는 동안 바깥 클릭·Esc·스크롤·창 크기 변경 시 닫는다.
    React.useEffect(() => {
        if (!reactionMenu) return;
        function close() {
            setReactionMenu(null);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") close();
        }
        window.addEventListener("click", close);
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("click", close);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
            window.removeEventListener("keydown", onKey);
        };
    }, [reactionMenu]);

    // 한 메시지의 이모지 반응을 토글한다. 낙관적으로 먼저 반영하고 서버 응답으로 재조정한다.
    async function handleToggleReaction(messageId: string, emoji: string) {
        if (!viewerId) {
            toast.error("먼저 닉네임을 정해 주세요.");
            return;
        }
        // 낙관적 갱신 — 내 반응을 즉시 토글한다.
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== messageId) return m;
                const reactions = { ...(m.reactions ?? {}) };
                const users = reactions[emoji] ?? [];
                const next = users.includes(viewerId)
                    ? users.filter((u) => u !== viewerId)
                    : [...users, viewerId];
                if (next.length === 0) delete reactions[emoji];
                else reactions[emoji] = next;
                return { ...m, reactions };
            }),
        );
        try {
            const updated = await reactToMessage(courseId, messageId, viewerId, emoji);
            setMessages((prev) =>
                prev.map((m) => (m.id === updated.id ? updated : m)),
            );
        } catch (err) {
            toast.error(`반응 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
        }
    }

    async function handleSend() {
        if (!hydrated) return;
        if (!nickname) {
            toast.error("먼저 닉네임을 정해 주세요.");
            return;
        }
        const trimmedText = text.trim();
        if (!trimmedText && pending.length === 0) return;

        setSending(true);
        try {
            const newMsg = await postChat(courseId, {
                nickname,
                userId: userId ?? "",
                role: role ?? "student",
                avatar: avatar ?? "",
                text: trimmedText,
                attachments: pending,
            });
            // 낙관적으로 추가; 다음 폴링이 서버 기준으로 재조정한다.
            setMessages((prev) => {
                const ids = new Set(prev.map((m) => m.id));
                if (ids.has(newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            setText("");
            setPending([]);
        } catch (err) {
            toast.error(`전송 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
        } finally {
            setSending(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    const messageCount = messages.length;

    return (
        <div
            className={cn(
                "flex flex-col h-full bg-background",
                className
            )}
        >
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow text-muted-foreground">
                        실시간 자랑방
                    </span>
                    {messageCount > 0 && (
                        <span className="mono text-[11px] tabular-nums text-muted-foreground">
                            {messageCount}개
                        </span>
                    )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                    이 강의를 보는 학생들과 결과물을 공유해요
                </p>
            </div>

            {/* Message list */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="py-2">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
                            <span className="text-2xl select-none">💬</span>
                            <p className="text-sm text-muted-foreground">
                                아직 메시지가 없어요.
                                <br />
                                첫 번째로 자랑해 보세요!
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                isOwn={
                                    msg.userId && userId
                                        ? msg.userId === userId
                                        : msg.nickname === nickname
                                }
                                currentUserAvatar={avatar}
                                viewerId={viewerId}
                                onOpenMenu={openReactionMenu}
                                onToggleReaction={handleToggleReaction}
                                onNavigateToBlock={onNavigateToBlock}
                            />
                        ))
                    )}
                    <div ref={bottomRef} />
                </div>
            </ScrollArea>

            {/* Composer */}
            <div className="shrink-0">
                {!hydrated || !nickname ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                        메시지를 보내려면{" "}
                        <span className="font-medium text-foreground">
                            닉네임을 정해 주세요.
                        </span>
                    </div>
                ) : (
                    <div className="p-3">
                        {/* Gemini 스타일 — 첨부 칩·입력창·버튼이 하나의 둥근 입력 박스 안에 모두 들어간다. */}
                        <InputGroup className="rounded-2xl">
                            {/* Pending attachment chips (입력 박스 상단) */}
                            {pending.length > 0 && (
                                <InputGroupAddon align="block-start" className="flex-wrap gap-1.5">
                                    {pending.map((att, i) => (
                                        <PendingChip
                                            key={i}
                                            attachment={att}
                                            onRemove={() =>
                                                setPending((prev) => prev.filter((_, idx) => idx !== i))
                                            }
                                        />
                                    ))}
                                </InputGroupAddon>
                            )}

                            <InputGroupTextarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="메시지를 입력해주세요"
                                className="min-h-[44px] max-h-[140px] text-sm"
                                disabled={sending}
                            />

                            {/* 하단 버튼 줄 — 첨부(좌) · 전송(우)이 입력 박스 안에 있다. */}
                            <InputGroupAddon align="block-end">
                                <InputGroupButton
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => setPickerOpen(true)}
                                    disabled={sending}
                                    aria-label="작품 가져오기 — 사진·영상·음악·글 첨부"
                                    className="rounded-full"
                                >
                                    <Paperclip className="size-4" />
                                </InputGroupButton>

                                <InputGroupButton
                                    size="icon-sm"
                                    variant="default"
                                    onClick={handleSend}
                                    disabled={sending || (!text.trim() && pending.length === 0)}
                                    aria-label="전송"
                                    className="ml-auto rounded-full"
                                >
                                    <ArrowUp className="size-4" />
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                    </div>
                )}
            </div>

            <WorkPickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                userId={userId ?? null}
                role={role}
                onPick={addAttachments}
            />

            {/* 우클릭 이모지 반응 메뉴 — 커서 위치에 떠 있는 작은 팔레트. */}
            {reactionMenu && (
                <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                        top: Math.min(reactionMenu.y, window.innerHeight - 56),
                        left: Math.min(reactionMenu.x, window.innerWidth - 320),
                    }}
                    className="fixed z-50 flex origin-top items-center gap-0.5 rounded-full border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150 ease-out"
                >
                    {REACTION_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                                handleToggleReaction(reactionMenu.messageId, emoji);
                                setReactionMenu(null);
                            }}
                            className="flex size-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-muted"
                            aria-label={`${emoji} 반응`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

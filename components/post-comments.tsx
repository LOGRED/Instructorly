/**
 * 게시물 댓글 패널 — 학습자/강사가 게시물에 댓글·대댓글(답글)을 남기는 클라이언트 컴포넌트.
 * 비밀 댓글은 작성자 본인과 강사에게만 보이며, 그 비밀 댓글에 달린 대댓글도 같은
 * 스레드 참여자(작성자·강사)에게만 보이고 다른 학생은 볼 수 없다(서버가 가시성 판정).
 */
"use client";

import * as React from "react";
import { Trash2, ArrowUp, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { getComments, addComment, deleteComment } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { avatarSrc } from "@/lib/avatars";
import type { PostComment, ChatAttachment } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupTextarea,
} from "@/components/ui/input-group";
import { WorkPickerDialog } from "@/components/work-picker-dialog";
import { AttachmentPreview, PendingChip } from "@/components/chat-attachment";

// 타임스탬프를 한국어 날짜·시각 문자열로 포맷한다.
function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function PostComments({ postId }: { postId: string }) {
    const userId = useIdentity((s) => s.userId);
    const nickname = useIdentity((s) => s.nickname);
    const role = useIdentity((s) => s.role);
    const avatar = useIdentity((s) => s.avatar);
    const hydrated = useIdentity((s) => s.hydrated);

    const [comments, setComments] = React.useState<PostComment[]>([]);
    const [text, setText] = React.useState("");
    const [secret, setSecret] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    // 전송 대기 중인 첨부(작품/업로드)와 작품 선택 다이얼로그 열림 상태 — 채팅과 동일.
    const [pending, setPending] = React.useState<ChatAttachment[]>([]);
    const [pickerOpen, setPickerOpen] = React.useState(false);

    // 대댓글 입력 상태: 어떤 댓글에 답글을 다는 중인지(null이면 닫힘), 입력 내용, 전송 중 여부.
    const [replyingTo, setReplyingTo] = React.useState<string | null>(null);
    const [replyText, setReplyText] = React.useState("");
    const [replySubmitting, setReplySubmitting] = React.useState(false);

    // 댓글 목록을 불러온다. 매 폴링마다 서버 응답으로 교체해 길이·id가 같고
    // 아바타·표시 이름만 바뀐 프로필 변경도 화면에 반영한다. 서버가 진실의 원천이며,
    // 아직 서버가 echo 하지 않은 낙관적 로컬 댓글은 보존한다.
    const load = React.useCallback(async () => {
        try {
            const data = await getComments(postId, { userId: userId ?? undefined, role: role ?? undefined });
            setComments((prev) => {
                const serverIds = new Set(data.map((c) => c.id));
                const optimistic = prev.filter((c) => !serverIds.has(c.id));
                return [...data, ...optimistic];
            });
        } catch {
            // silently ignore poll errors
        }
    }, [postId, userId, role]);

    // Initial load + poll every 5s
    React.useEffect(() => {
        load();
        const id = setInterval(load, 5000);
        return () => clearInterval(id);
    }, [load]);

    // 댓글을 최상위/대댓글로 나눠 부모별 답글 목록을 만든다(시간순 정렬).
    const { topLevel, repliesByParent } = React.useMemo(() => {
        const tops = comments
            .filter((c) => !c.parentId)
            .sort((a, b) => a.createdAt - b.createdAt);
        const map = new Map<string, PostComment[]>();
        for (const c of comments) {
            if (!c.parentId) continue;
            const arr = map.get(c.parentId) ?? [];
            arr.push(c);
            map.set(c.parentId, arr);
        }
        for (const arr of map.values()) arr.sort((a, b) => a.createdAt - b.createdAt);
        return { topLevel: tops, repliesByParent: map };
    }, [comments]);

    // 작품 가져오기 다이얼로그에서 고른 첨부(작품/업로드)를 대기 목록에 더한다.
    function addAttachments(atts: ChatAttachment[]) {
        if (atts.length === 0) return;
        setPending((prev) => [...prev, ...atts]);
    }

    // 최상위 댓글을 등록한다(비밀 토글·첨부 반영). 텍스트가 없어도 첨부가 있으면 등록한다.
    async function handleSubmit() {
        if (!hydrated || !userId) return;
        const trimmed = text.trim();
        if (!trimmed && pending.length === 0) return;

        setSubmitting(true);
        try {
            const newComment = await addComment({
                postId,
                userId,
                authorName: nickname ?? "익명",
                authorAvatar: avatar ?? "",
                role: role ?? "student",
                text: trimmed,
                secret,
                attachments: pending,
            });
            // Optimistic append + dedup
            setComments((prev) => {
                const ids = new Set(prev.map((c) => c.id));
                if (ids.has(newComment.id)) return prev;
                return [...prev, newComment];
            });
            setText("");
            setSecret(false);
            setPending([]);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "댓글 등록에 실패했습니다.");
        } finally {
            setSubmitting(false);
        }
    }

    // 대댓글을 등록한다. 비밀 여부는 서버가 부모(루트) 댓글에서 상속하므로 보내지 않는다.
    async function handleReply(parent: PostComment) {
        if (!hydrated || !userId) return;
        const trimmed = replyText.trim();
        if (!trimmed) return;

        setReplySubmitting(true);
        try {
            const newReply = await addComment({
                postId,
                userId,
                authorName: nickname ?? "익명",
                authorAvatar: avatar ?? "",
                role: role ?? "student",
                text: trimmed,
                parentId: parent.id,
            });
            setComments((prev) => {
                const ids = new Set(prev.map((c) => c.id));
                if (ids.has(newReply.id)) return prev;
                return [...prev, newReply];
            });
            setReplyText("");
            setReplyingTo(null);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "답글 등록에 실패했습니다.");
        } finally {
            setReplySubmitting(false);
        }
    }

    // 최상위 댓글 입력칸 키 처리: Enter 등록 · Shift+Enter 줄바꿈.
    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit();
        }
    }

    // 대댓글 입력칸 키 처리: Enter 등록 · Shift+Enter 줄바꿈.
    function handleReplyKeyDown(
        e: React.KeyboardEvent<HTMLTextAreaElement>,
        parent: PostComment,
    ) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleReply(parent);
        }
    }

    // 댓글(또는 대댓글)을 삭제한다. 최상위 댓글이면 화면에서 자식 답글도 함께 지운다.
    async function handleDelete(commentId: string) {
        if (!window.confirm("댓글을 삭제할까요?")) return;
        try {
            await deleteComment(postId, commentId, { userId: userId ?? undefined, role: role ?? undefined });
            setComments((prev) =>
                prev.filter((c) => c.id !== commentId && c.parentId !== commentId),
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다.");
        }
    }

    // 본인 댓글이거나 강사면 삭제할 수 있다.
    const canDelete = (c: PostComment) =>
        c.userId === userId || role === "instructor";

    // 댓글 한 건을 카드로 렌더한다. isReply면 대댓글 스타일(약간 작게)로 표시한다.
    function renderComment(c: PostComment, isReply: boolean) {
        const src = avatarSrc(c.authorAvatar);
        const firstChar = c.authorName.charAt(0).toUpperCase();
        return (
            <div
                className={`flex gap-3 rounded-xl px-4 py-3 ${
                    c.secret
                        ? "border border-warning/30 bg-warning/10"
                        : isReply
                          ? "bg-muted/30"
                          : "bg-muted/50"
                }`}
            >
                <Avatar size="sm" className="shrink-0 mt-0.5">
                    {src && <AvatarImage src={src} alt="" />}
                    <AvatarFallback className="text-xs font-medium">
                        {firstChar}
                    </AvatarFallback>
                </Avatar>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {/* Header row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium leading-none">
                            {c.authorName}
                        </span>
                        <Badge
                            variant={c.role === "instructor" ? "default" : "secondary"}
                            className="text-[10px] h-4 px-1.5"
                        >
                            {c.role === "instructor" ? "강사" : "학생"}
                        </Badge>
                        {c.secret && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                🔒 비밀
                            </Badge>
                        )}
                        <span className="mono text-[10px] text-muted-foreground tabular-nums ml-auto">
                            {formatDate(c.createdAt)}
                        </span>
                        {canDelete(c) && (
                            <button
                                type="button"
                                onClick={() => void handleDelete(c.id)}
                                aria-label="댓글 삭제"
                                className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Text */}
                    {c.text && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
                            {c.text}
                        </p>
                    )}

                    {/* 첨부 — 채팅과 동일한 미리보기(이미지·영상·오디오·파일·AI 글) */}
                    {c.attachments && c.attachments.length > 0 && (
                        <div className="mt-1 flex flex-col gap-2">
                            {c.attachments.map((att, i) => (
                                <AttachmentPreview key={i} attachment={att} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <section className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">댓글</span>
                {comments.length > 0 && (
                    <span className="mono text-xs tabular-nums text-muted-foreground">
                        {comments.length}
                    </span>
                )}
            </div>

            {/* Comment list */}
            {topLevel.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</p>
            ) : (
                <div className="flex flex-col gap-4">
                    {topLevel.map((c) => {
                        const replies = repliesByParent.get(c.id) ?? [];
                        return (
                            <div key={c.id} className="flex flex-col gap-2">
                                {renderComment(c, false)}

                                {/* 대댓글 목록 — 들여쓰기 + 왼쪽 세로선으로 스레드 표시 */}
                                {replies.length > 0 && (
                                    <div className="ml-8 flex flex-col gap-2 border-l-2 border-border/60 pl-3">
                                        {replies.map((r) => (
                                            <div key={r.id}>{renderComment(r, true)}</div>
                                        ))}
                                    </div>
                                )}

                                {/* 답글 affordance — 로그인 시에만 */}
                                {hydrated && userId && (
                                    <div className="ml-8">
                                        {replyingTo === c.id ? (
                                            <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
                                                {c.secret && (
                                                    <p className="text-[11px] text-warning">
                                                        🔒 비밀 댓글의 답글입니다. 스레드 참여자(작성자·강사)만 볼 수 있어요.
                                                    </p>
                                                )}
                                                <Textarea
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    onKeyDown={(e) => handleReplyKeyDown(e, c)}
                                                    placeholder="답글을 입력하세요... (Enter 등록 · Shift+Enter 줄바꿈)"
                                                    className="min-h-[56px] max-h-[140px] resize-none text-sm"
                                                    disabled={replySubmitting}
                                                    autoFocus
                                                />
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setReplyingTo(null);
                                                            setReplyText("");
                                                        }}
                                                        disabled={replySubmitting}
                                                    >
                                                        취소
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => void handleReply(c)}
                                                        disabled={replySubmitting || !replyText.trim()}
                                                    >
                                                        {replySubmitting ? "등록 중..." : "답글 등록"}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReplyingTo(c.id);
                                                    setReplyText("");
                                                }}
                                                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                ↳ 답글
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Composer — 채팅과 동일한 Gemini 스타일(첨부 칩·입력창·버튼이 한 둥근 박스 안). */}
            {hydrated && userId ? (
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
                        placeholder="댓글을 입력하세요"
                        className="min-h-[44px] max-h-[160px] text-sm"
                        disabled={submitting}
                    />

                    {/* 하단 버튼 줄 — 첨부(좌) · 비밀 토글 · 전송(우)이 입력 박스 안에 있다. */}
                    <InputGroupAddon align="block-end">
                        <InputGroupButton
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setPickerOpen(true)}
                            disabled={submitting}
                            aria-label="작품 가져오기 — 사진·영상·음악·글 첨부"
                            className="rounded-full"
                        >
                            <Paperclip className="size-4" />
                        </InputGroupButton>

                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
                            <Switch
                                checked={secret}
                                onCheckedChange={setSecret}
                                disabled={submitting}
                                aria-label="비밀 댓글"
                            />
                            비밀 댓글
                        </label>

                        <InputGroupButton
                            size="icon-sm"
                            variant="default"
                            onClick={() => void handleSubmit()}
                            disabled={submitting || (!text.trim() && pending.length === 0)}
                            aria-label="등록"
                            className="ml-auto rounded-full"
                        >
                            <ArrowUp className="size-4" />
                        </InputGroupButton>
                    </InputGroupAddon>
                </InputGroup>
            ) : (
                hydrated && (
                    <p className="text-sm text-muted-foreground">
                        댓글을 쓰려면 로그인하세요.
                    </p>
                )
            )}

            <WorkPickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                userId={userId ?? null}
                role={role}
                onPick={addAttachments}
            />
        </section>
    );
}

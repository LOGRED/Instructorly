import { NextResponse } from "next/server";
import { listComments, addComment, deleteComment, canViewComment } from "@/lib/db";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
    const { id } = await params;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? undefined;
    const rawRole = url.searchParams.get("role");
    const role: Role | undefined =
        rawRole === "instructor" || rawRole === "student" ? rawRole : undefined;
    return NextResponse.json({ comments: listComments(id, { userId, role }) });
}

export async function POST(req: Request, { params }: Params) {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const authorName = typeof body?.authorName === "string" ? body.authorName : "익명";
    const authorAvatar = typeof body?.authorAvatar === "string" ? body.authorAvatar : undefined;
    const role: Role = body?.role === "instructor" ? "instructor" : "student";
    const text = typeof body?.text === "string" ? body.text : "";
    const secret = !!body?.secret;
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : null;
    if (!text.trim() && attachments.length === 0) {
        return NextResponse.json({ error: "댓글 내용을 입력해 주세요." }, { status: 400 });
    }
    if (!userId) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 400 });
    }
    // 대댓글이면 작성자가 그 스레드를 볼 권한이 있는지 서버에서 검증한다.
    // (안 보이는 비밀 스레드에 답글을 끼워넣는 것을 막는다.)
    if (parentId && !canViewComment(parentId, { userId, role })) {
        return NextResponse.json({ error: "답글을 달 수 없는 댓글입니다." }, { status: 403 });
    }
    const comment = addComment({
        postId: id,
        userId,
        authorName,
        authorAvatar,
        role,
        text: text.trim(),
        secret,
        attachments,
        parentId,
    });
    return NextResponse.json({ comment }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
    const { id: _postId } = await params;
    const url = new URL(req.url);
    const commentId = url.searchParams.get("commentId") ?? "";
    const userId = url.searchParams.get("userId") ?? undefined;
    const rawRole = url.searchParams.get("role");
    const role: Role | undefined =
        rawRole === "instructor" || rawRole === "student" ? rawRole : undefined;
    if (!commentId) {
        return NextResponse.json({ error: "commentId가 필요합니다." }, { status: 400 });
    }
    const ok = deleteComment(commentId, { userId, role });
    if (!ok) {
        return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getMessages, addMessage, toggleReaction } from "@/lib/db";
import type { ChatAttachment, Role } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
    const { id } = await params;
    const url = new URL(req.url);
    const since = Number(url.searchParams.get("since") ?? 0) || 0;
    const messages = getMessages(id, since);
    return NextResponse.json({ messages, serverTime: Date.now() });
}

export async function POST(req: Request, { params }: Params) {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const nickname = typeof body?.nickname === "string" && body.nickname.trim() ? body.nickname.trim() : "익명";
    const role: Role = body?.role === "instructor" ? "instructor" : "student";
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const avatar = typeof body?.avatar === "string" ? body.avatar : "";
    const text = typeof body?.text === "string" ? body.text : "";
    const attachments: ChatAttachment[] = Array.isArray(body?.attachments) ? body.attachments : [];
    if (!text.trim() && attachments.length === 0) {
        return NextResponse.json({ error: "내용이나 첨부가 필요합니다." }, { status: 400 });
    }
    const message = addMessage({ courseId: id, userId, nickname, role, avatar, text, attachments });
    return NextResponse.json({ message }, { status: 201 });
}

// 말풍선 이모지 반응을 토글한다(같은 사용자가 같은 이모지를 다시 누르면 취소).
export async function PATCH(req: Request, { params }: Params) {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const messageId = typeof body?.messageId === "string" ? body.messageId : "";
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const emoji = typeof body?.emoji === "string" ? body.emoji : "";
    if (!messageId || !userId || !emoji) {
        return NextResponse.json({ error: "messageId·userId·emoji가 필요합니다." }, { status: 400 });
    }
    const message = toggleReaction(id, messageId, userId, emoji);
    if (!message) {
        return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ message });
}

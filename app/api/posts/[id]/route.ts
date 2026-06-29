import { NextResponse } from "next/server";
import { getPost, upsertPost, deletePost } from "@/lib/db";
import type { Post } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    const post = getPost(id);
    if (!post) {
        return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ post });
}

export async function PUT(req: Request, { params }: Params) {
    const { id } = await params;
    const existing = getPost(id);
    if (!existing) {
        return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
    }
    const body = (await req.json()) as Partial<Post>;
    const updated: Post = { ...existing, ...body, id };
    const saved = upsertPost(updated);
    return NextResponse.json({ post: saved });
}

export async function DELETE(_req: Request, { params }: Params) {
    const { id } = await params;
    deletePost(id);
    return NextResponse.json({ ok: true });
}

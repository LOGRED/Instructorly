import { NextResponse } from "next/server";
import { listPosts, createPost } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const programId = url.searchParams.get("programId") ?? undefined;
    return NextResponse.json({ posts: listPosts(programId) });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const programId = typeof body?.programId === "string" ? body.programId : "";
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "새 게시물";
    const authorId = typeof body?.authorId === "string" ? body.authorId : "";
    const authorName = typeof body?.authorName === "string" ? body.authorName : "익명";
    const post = createPost({ programId, title, authorId, authorName });
    return NextResponse.json({ post }, { status: 201 });
}

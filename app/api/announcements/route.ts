import { NextResponse } from "next/server";
import { listAnnouncements, createAnnouncement } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const programId = url.searchParams.get("programId") ?? undefined;
    return NextResponse.json({ announcements: listAnnouncements(programId) });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const programId = typeof body?.programId === "string" ? body.programId : "";
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "새 공지사항";
    const authorId = typeof body?.authorId === "string" ? body.authorId : "";
    const authorName = typeof body?.authorName === "string" ? body.authorName : "익명";
    const announcement = createAnnouncement({ programId, title, authorId, authorName });
    return NextResponse.json({ announcement }, { status: 201 });
}

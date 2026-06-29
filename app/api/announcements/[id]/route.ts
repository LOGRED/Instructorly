import { NextResponse } from "next/server";
import { getAnnouncement, upsertAnnouncement, deleteAnnouncement } from "@/lib/db";
import type { Announcement } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    const announcement = getAnnouncement(id);
    if (!announcement) {
        return NextResponse.json({ error: "공지사항을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ announcement });
}

export async function PUT(req: Request, { params }: Params) {
    const { id } = await params;
    const existing = getAnnouncement(id);
    if (!existing) {
        return NextResponse.json({ error: "공지사항을 찾을 수 없습니다." }, { status: 404 });
    }
    const body = (await req.json()) as Partial<Announcement>;
    const updated: Announcement = { ...existing, ...body, id };
    const saved = upsertAnnouncement(updated);
    return NextResponse.json({ announcement: saved });
}

export async function DELETE(_req: Request, { params }: Params) {
    const { id } = await params;
    deleteAnnouncement(id);
    return NextResponse.json({ ok: true });
}

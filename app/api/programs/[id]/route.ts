import { NextResponse } from "next/server";
import { getProgram, upsertProgram, deleteProgram } from "@/lib/db";
import type { Program } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    const program = getProgram(id);
    if (!program) {
        return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ program });
}

export async function PUT(req: Request, { params }: Params) {
    const { id } = await params;
    const existing = getProgram(id);
    if (!existing) {
        return NextResponse.json({ error: "강좌를 찾을 수 없습니다." }, { status: 404 });
    }
    const body = (await req.json()) as Partial<Program>;
    const updated: Program = {
        ...existing,
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        cover: body.cover !== undefined ? body.cover : existing.cover,
        inviteCode: body.inviteCode ?? existing.inviteCode,
        startDate: body.startDate !== undefined ? body.startDate : existing.startDate,
        endDate: body.endDate !== undefined ? body.endDate : existing.endDate,
        weekDays: body.weekDays ?? existing.weekDays,
        weeks: body.weeks ?? existing.weeks,
        id,
    };
    const saved = upsertProgram(updated);
    return NextResponse.json({ program: saved });
}

export async function DELETE(_req: Request, { params }: Params) {
    const { id } = await params;
    deleteProgram(id);
    return NextResponse.json({ ok: true });
}

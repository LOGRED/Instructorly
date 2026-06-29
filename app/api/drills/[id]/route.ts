import { NextResponse } from "next/server";
import { getDrill, upsertDrill, deleteDrill } from "@/lib/db";
import type { Drill } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// 드릴 한 건을 조회한다.
export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    const drill = getDrill(id);
    if (!drill) {
        return NextResponse.json({ error: "시험/연습을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ drill });
}

// 드릴을 수정한다(제목·미션 등).
export async function PUT(req: Request, { params }: Params) {
    const { id } = await params;
    const existing = getDrill(id);
    if (!existing) {
        return NextResponse.json({ error: "시험/연습을 찾을 수 없습니다." }, { status: 404 });
    }
    const body = (await req.json()) as Partial<Drill>;
    const updated: Drill = { ...existing, ...body, id };
    const saved = upsertDrill(updated);
    return NextResponse.json({ drill: saved });
}

// 드릴을 삭제한다.
export async function DELETE(_req: Request, { params }: Params) {
    const { id } = await params;
    deleteDrill(id);
    return NextResponse.json({ ok: true });
}

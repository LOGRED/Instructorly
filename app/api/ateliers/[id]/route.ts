import { NextResponse } from "next/server";
import { getAtelier, upsertAtelier, deleteAtelier } from "@/lib/db";
import type { Atelier } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// 창작 실습 한 건(강사 시범본 포함)을 조회한다.
export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    const atelier = getAtelier(id);
    if (!atelier) {
        return NextResponse.json({ error: "창작 실습을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ atelier });
}

// 창작 실습을 수정한다(제목·안내문·강사 시범본 등).
export async function PUT(req: Request, { params }: Params) {
    const { id } = await params;
    const existing = getAtelier(id);
    if (!existing) {
        return NextResponse.json({ error: "창작 실습을 찾을 수 없습니다." }, { status: 404 });
    }
    const body = (await req.json().catch(() => ({}))) as Partial<Atelier>;
    const updated: Atelier = { ...existing, ...body, id };
    const saved = upsertAtelier(updated);
    return NextResponse.json({ atelier: saved });
}

// 창작 실습을 삭제한다.
export async function DELETE(_req: Request, { params }: Params) {
    const { id } = await params;
    deleteAtelier(id);
    return NextResponse.json({ ok: true });
}

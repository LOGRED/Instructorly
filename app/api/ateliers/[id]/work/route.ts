import { NextResponse } from "next/server";
import {
    getAtelier,
    getAtelierWork,
    saveAtelierWork,
    listAtelierWorks,
} from "@/lib/db";
import type { AtelierDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// 학생 작품 조회 — all=1이면 전체(강사용), userId면 단건(없으면 null).
export async function GET(req: Request, { params }: Params) {
    const { id } = await params;
    const url = new URL(req.url);
    if (url.searchParams.get("all") === "1") {
        return NextResponse.json({ works: listAtelierWorks(id) });
    }
    const userId = url.searchParams.get("userId") ?? "";
    return NextResponse.json({ work: userId ? getAtelierWork(id, userId) : null });
}

// 학생 작품을 저장(있으면 갱신)한다.
export async function PUT(req: Request, { params }: Params) {
    const { id } = await params;
    if (!getAtelier(id)) {
        return NextResponse.json({ error: "창작 실습을 찾을 수 없습니다." }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const userName = typeof body?.userName === "string" ? body.userName : "익명";
    const doc = body?.doc as AtelierDoc;
    if (!userId || !doc || !Array.isArray(doc.pages)) {
        return NextResponse.json(
            { error: "저장할 작품 정보가 올바르지 않습니다." },
            { status: 400 },
        );
    }
    const work = saveAtelierWork({ atelierId: id, userId, userName, doc });
    return NextResponse.json({ work });
}

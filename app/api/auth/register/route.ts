import { NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const role: Role = body?.role === "instructor" ? "instructor" : "student";
    if (!id || !password) {
        return NextResponse.json(
            { error: "아이디와 비밀번호를 입력해 주세요." },
            { status: 400 },
        );
    }
    try {
        const user = createUser({ id, password, name, role });
        return NextResponse.json({ user }, { status: 201 });
    } catch (e) {
        const message = e instanceof Error ? e.message : "회원가입에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 409 });
    }
}

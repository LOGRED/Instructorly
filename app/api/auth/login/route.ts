import { NextResponse } from "next/server";
import { verifyUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const user = verifyUser(id, password);
    if (!user) {
        return NextResponse.json(
            { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
            { status: 401 },
        );
    }
    return NextResponse.json({ user });
}

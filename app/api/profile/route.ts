import { NextResponse } from "next/server";
import { updateUserProfile } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const name = typeof body?.name === "string" ? body.name : undefined;
    const avatar = typeof body?.avatar === "string" ? body.avatar : undefined;
    if (!userId) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const user = updateUserProfile(userId, { name, avatar });
    if (!user) {
        return NextResponse.json(
            { error: "사용자를 찾을 수 없습니다." },
            { status: 404 },
        );
    }
    return NextResponse.json({ user });
}

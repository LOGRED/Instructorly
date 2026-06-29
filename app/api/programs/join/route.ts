import { NextResponse } from "next/server";
import { enrollByInvite } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code : "";
    const userId = typeof body?.userId === "string" ? body.userId : "";
    if (!userId) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const program = enrollByInvite(code, userId);
    if (!program) {
        return NextResponse.json(
            { error: "초대 코드에 해당하는 강좌가 없습니다." },
            { status: 404 },
        );
    }
    return NextResponse.json({ program });
}

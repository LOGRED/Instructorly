/**
 * AI 스튜디오 사용량 API — 요청자 "본인"의 생성 기록만 내려준다(프라이버시: 남의 사용량은
 * 보지 못한다). userId가 없으면 빈 목록을 반환한다. 결과물 본문은 빠진 가벼운 목록이며,
 * 본문은 /api/studio/usage/record 단건 조회로 따로 가져온다.
 */
import { NextResponse } from "next/server";
import { listUserUsage } from "@/lib/usage";

export const runtime = "nodejs";

// GET /api/studio/usage?userId=... — 해당 사용자 본인의 기록만 반환한다.
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId") ?? "";
        const records = userId ? listUserUsage(userId, 2000) : [];
        return NextResponse.json({ records });
    } catch (e) {
        const message = e instanceof Error ? e.message : "사용량을 불러오지 못했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

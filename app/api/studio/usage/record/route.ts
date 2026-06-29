/**
 * AI 스튜디오 단일 사용 기록 상세 API — id로 한 기록을 결과물(output) 본문까지 포함해
 * 내려준다. 목록 API는 용량 큰 결과물(이미지·오디오 data URL)을 빼고 가볍게 주므로,
 * 기록을 클릭해 결과물을 열어 볼 때만 이 엔드포인트로 본문을 따로 가져온다.
 */
import { NextResponse } from "next/server";
import { getUsageRecord } from "@/lib/usage";

export const runtime = "nodejs";

// GET /api/studio/usage/record?id=...&userId=... — 본인 기록의 결과물 본문까지 반환한다.
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id") ?? "";
        const userId = searchParams.get("userId") ?? "";
        if (!id) {
            return NextResponse.json({ error: "기록 id가 필요합니다." }, { status: 400 });
        }
        const record = getUsageRecord(id);
        if (!record) {
            return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
        }
        // 프라이버시 — 본인 기록만 결과물을 볼 수 있다(남의 id로 결과 열람 차단).
        if (!userId || record.userId !== userId) {
            return NextResponse.json({ error: "본인 기록만 볼 수 있습니다." }, { status: 403 });
        }
        return NextResponse.json({ record });
    } catch (e) {
        const message = e instanceof Error ? e.message : "기록을 불러오지 못했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

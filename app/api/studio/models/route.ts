/**
 * AI 스튜디오 모델 카탈로그 API — 모델 목록(라이브 단가·크레딧 환산), 실시간 USD→KRW
 * 환율, 서버의 API 키 보유 여부를 한 번에 내려준다.
 */
import { NextResponse } from "next/server";
import { buildCatalog, hasKey } from "@/lib/openrouter";
import { getUsdKrw } from "@/lib/fx";
import { KRW_PER_CREDIT } from "@/lib/credits";
import type { StudioCatalog } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/studio/models — 모델 카탈로그 + 환율 + 키 보유 여부를 반환한다.
export async function GET() {
    try {
        const fx = await getUsdKrw();
        const models = await buildCatalog(fx.krwPerUsd);
        const body: StudioCatalog = {
            models,
            fx: {
                krwPerUsd: fx.krwPerUsd,
                updatedAt: fx.updatedAt,
                source: fx.source,
                stale: fx.stale,
            },
            krwPerCredit: KRW_PER_CREDIT,
            hasKey: hasKey(),
            fetchedAt: Date.now(),
        };
        return NextResponse.json(body);
    } catch (e) {
        const message = e instanceof Error ? e.message : "모델 목록을 불러오지 못했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

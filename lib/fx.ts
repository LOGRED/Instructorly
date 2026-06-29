/**
 * 실시간 환율(USD→KRW) 조회 — 키 없이 쓰는 open.er-api.com 공개 엔드포인트.
 * 1시간 메모리 캐시로 호출을 아끼고, 실패 시 합리적인 폴백 환율로 폴백한다.
 * 서버 전용 모듈(라우트 핸들러에서만 import).
 */

const FX_ENDPOINT = "https://open.er-api.com/v6/latest/USD";
/** 캐시 수명(ms) — 1시간. 공개 환율 API가 시간 단위로 갱신되므로 충분하다. */
const TTL_MS = 60 * 60 * 1000;
/** 외부 API가 죽었을 때 쓰는 폴백 환율(1 USD = 약 1,450원). stale=true로 표시된다. */
const FALLBACK_RATE = 1450;

export interface FxRate {
    /** 1 USD 당 원화. */
    krwPerUsd: number;
    /** 환율 기준 시각(Unix 초). 폴백이면 0. */
    updatedAt: number;
    /** 데이터 출처 표시. */
    source: string;
    /** 폴백(외부 API 실패)으로 채워진 값이면 true. */
    stale: boolean;
}

let cache: { value: FxRate; fetchedAt: number } | null = null;

interface ErApiResponse {
    result?: string;
    time_last_update_unix?: number;
    rates?: Record<string, number>;
}

/** USD→KRW 환율을 반환한다(1시간 캐시, 실패 시 폴백). */
export async function getUsdKrw(): Promise<FxRate> {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < TTL_MS) {
        return cache.value;
    }
    try {
        const res = await fetch(FX_ENDPOINT, { cache: "no-store" });
        if (!res.ok) throw new Error(`환율 API 응답 오류 (${res.status})`);
        const data = (await res.json()) as ErApiResponse;
        const krw = data?.rates?.KRW;
        if (data.result !== "success" || typeof krw !== "number" || krw <= 0) {
            throw new Error("환율 데이터 형식 오류");
        }
        const value: FxRate = {
            krwPerUsd: krw,
            updatedAt: data.time_last_update_unix ?? Math.floor(now / 1000),
            source: "open.er-api.com",
            stale: false,
        };
        cache = { value, fetchedAt: now };
        return value;
    } catch {
        // 외부 API 실패 — 마지막 캐시가 있으면 그것을, 없으면 폴백을 stale로 반환.
        if (cache) return { ...cache.value, stale: true };
        const fallback: FxRate = {
            krwPerUsd: FALLBACK_RATE,
            updatedAt: 0,
            source: "fallback",
            stale: true,
        };
        return fallback;
    }
}

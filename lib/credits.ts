/**
 * 크레딧 환산 유틸 — USD ↔ 원(KRW) ↔ 크레딧 변환 및 표시 포맷.
 *
 * 규칙: 1 크레딧 = 0.1원. OpenRouter 비용은 USD로 오므로 실시간 환율(USD→KRW)을
 * 곱해 원으로 바꾼 뒤 0.1로 나눠 크레딧을 구한다. 서버·클라이언트 양쪽에서 쓰는
 * 순수 모듈이라 "use client"/"use server" 지시문을 두지 않는다.
 */

/** 1 크레딧의 원화 가치(원). 1 크레딧 = 0.1원. */
export const KRW_PER_CREDIT = 0.1;

/** USD 금액을 실시간 환율로 원화(KRW)로 바꾼다. */
export function usdToKrw(usd: number, krwPerUsd: number): number {
    return usd * krwPerUsd;
}

/** 원화(KRW) 금액을 크레딧으로 바꾼다(1크레딧=0.1원). */
export function krwToCredits(krw: number): number {
    return krw / KRW_PER_CREDIT;
}

/** USD 금액을 실시간 환율을 거쳐 크레딧으로 바꾼다. */
export function usdToCredits(usd: number, krwPerUsd: number): number {
    return krwToCredits(usdToKrw(usd, krwPerUsd));
}

/** 크레딧을 원화(KRW)로 되돌린다. */
export function creditsToKrw(credits: number): number {
    return credits * KRW_PER_CREDIT;
}

/** 크레딧 수를 사람이 읽기 좋게 포맷한다(크기에 따라 소수 자릿수 조절). */
export function formatCredits(credits: number): string {
    if (!Number.isFinite(credits)) return "0";
    const abs = Math.abs(credits);
    let digits: number;
    if (abs === 0) digits = 0;
    else if (abs >= 100) digits = 0;
    else if (abs >= 1) digits = 1;
    else if (abs >= 0.01) digits = 2;
    else digits = 4;
    return credits.toLocaleString("ko-KR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    });
}

/** 원화 금액을 "₩1,234" 형태로 포맷한다(작은 금액은 소수까지). */
export function formatKrw(krw: number): string {
    if (!Number.isFinite(krw)) return "₩0";
    const abs = Math.abs(krw);
    const digits = abs >= 100 ? 0 : abs >= 1 ? 1 : abs >= 0.01 ? 2 : 4;
    return `₩${krw.toLocaleString("ko-KR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    })}`;
}

/** USD 금액을 "$0.0123" 형태로 포맷한다(아주 작은 값까지 보이게). */
export function formatUsd(usd: number): string {
    if (!Number.isFinite(usd)) return "$0";
    const abs = Math.abs(usd);
    const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
    return `$${usd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: digits,
    })}`;
}

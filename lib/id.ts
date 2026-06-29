/**
 * 어느 실행 컨텍스트에서나 안전하게 UUID v4를 만드는 ID 유틸.
 * crypto.randomUUID()는 "보안 컨텍스트"(HTTPS 또는 localhost/127.0.0.1)에서만 제공된다.
 * LAN IP의 평문 HTTP 접속처럼 비보안 컨텍스트에서는 호출 시 "crypto.randomUUID is not a function"
 * 예외가 나므로, 같은 컨텍스트에서도 동작하는 getRandomValues 기반 폴백을 둔다.
 */

// 보안/비보안 컨텍스트, 브라우저/Node 어디서든 UUID v4 문자열을 반환한다.
export function newId(): string {
    const c: Crypto | undefined = globalThis.crypto;

    // 1) 보안 컨텍스트: 네이티브 randomUUID 사용.
    if (c && typeof c.randomUUID === "function") {
        return c.randomUUID();
    }

    // 2) getRandomValues는 비보안 컨텍스트에서도 동작 → 암호학적으로 안전한 폴백.
    if (c && typeof c.getRandomValues === "function") {
        const b = c.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 0x0f) | 0x40; // 버전 4
        b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
        const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }

    // 3) 최후 폴백: crypto 자체가 없는 극단적 환경 대비(Math.random 기반).
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0;
        const v = ch === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

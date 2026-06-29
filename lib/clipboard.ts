/**
 * 비보안 컨텍스트(LAN IP 평문 HTTP 등)에서도 동작하는 클립보드 복사 유틸.
 * navigator.clipboard는 "보안 컨텍스트"(HTTPS·localhost)에서만 제공되므로,
 * 없을 때는 화면 밖 textarea + execCommand("copy") 폴백으로 복사한다.
 */

// 텍스트를 클립보드에 복사한다. 성공하면 true를 반환한다.
export async function copyText(text: string): Promise<boolean> {
    // 1) 보안 컨텍스트: 표준 Clipboard API.
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // 권한 거부 등 → 폴백으로 진행.
        }
    }

    // 2) 폴백: 임시 textarea를 선택해 execCommand("copy"). 비보안 컨텍스트에서도 동작.
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
        ok = document.execCommand("copy");
    } catch {
        ok = false;
    }
    document.body.removeChild(ta);
    return ok;
}

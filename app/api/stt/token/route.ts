/**
 * Soniox 임시 API 키 발급 — 브라우저 실시간 STT(받아쓰기)가 WebSocket을 열 때 쓸
 * 단기 키를 서버에서 만들어 내려준다. 실제 SONIOX_API_KEY는 브라우저에 노출하지 않는다.
 * 참고: POST https://api.soniox.com/v1/auth/temporary-api-key (Bearer 인증).
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** 클라이언트가 쓸 실시간 STT 모델 id(없으면 기본값). */
function sttModel(): string {
    return process.env.SONIOX_STT_MODEL?.trim() || "stt-rt-preview";
}

// POST /api/stt/token — 단기 임시 키 + 모델 id를 발급한다.
export async function POST() {
    const key = process.env.SONIOX_API_KEY?.trim();
    if (!key) {
        return NextResponse.json(
            {
                error:
                    "SONIOX_API_KEY가 없습니다. 프로젝트 루트 .env.local에 Soniox 키를 넣고 서버를 다시 시작해 주세요.",
            },
            { status: 400 },
        );
    }

    try {
        const res = await fetch("https://api.soniox.com/v1/auth/temporary-api-key", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "content-type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
                usage_type: "transcribe_websocket",
                expires_in_seconds: 600, // 10분이면 받아쓰기 세션에 충분.
            }),
        });
        const data = (await res.json().catch(() => null)) as
            | { api_key?: string; expires_at?: string; message?: string }
            | null;
        if (!res.ok || !data?.api_key) {
            const msg = data?.message ?? `임시 키 발급 실패 (${res.status})`;
            return NextResponse.json({ error: `Soniox: ${msg}` }, { status: 502 });
        }
        return NextResponse.json({
            apiKey: data.api_key,
            expiresAt: data.expires_at ?? null,
            model: sttModel(),
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "임시 키 발급에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

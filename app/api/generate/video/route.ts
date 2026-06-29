/**
 * AI 동영상 생성 API 라우트 — 프롬프트를 받아 샘플 MP4 URL과 생성 소요 시간을 반환한다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/generate/video — 동영상 생성 요청을 처리하고 결과 URL을 반환한다.
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const prompt: unknown = body?.prompt;
        if (typeof prompt !== "string" || !prompt.trim()) {
            return NextResponse.json({ error: "프롬프트를 입력해 주세요." }, { status: 400 });
        }
        const start = Date.now();
        await new Promise((r) => setTimeout(r, 1500));
        return NextResponse.json({ url: "/samples/ai-video-sample.mp4", genMs: Date.now() - start });
    } catch (e) {
        const message = e instanceof Error ? e.message : "동영상 생성에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

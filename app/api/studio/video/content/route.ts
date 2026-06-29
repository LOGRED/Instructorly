/**
 * 동영상 콘텐츠 프록시 — OpenRouter의 동영상 콘텐츠는 인증 헤더가 필요해 브라우저가 직접
 * 못 받는다. 잡 id로 서버가 인증해 바이트를 받아 그대로 스트리밍한다.
 */
import { fetchVideoContent } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/studio/video/content?id=JOB&index=0 — 동영상 바이트를 프록시한다.
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const index = Number(searchParams.get("index") ?? "0") || 0;
        if (!id) {
            return new Response("작업 id가 필요합니다.", { status: 400 });
        }
        const { buffer, contentType } = await fetchVideoContent(id, index);
        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "동영상을 불러오지 못했습니다.";
        return new Response(message, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { generateImage } from "@/lib/pollinations";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const prompt: unknown = body?.prompt;
        if (typeof prompt !== "string" || !prompt.trim()) {
            return NextResponse.json({ error: "프롬프트를 입력해 주세요." }, { status: 400 });
        }
        const seed = Number.isFinite(body?.seed)
            ? Number(body.seed)
            : Math.floor(Math.random() * 1_000_000);
        const width = Number.isFinite(body?.width) ? Number(body.width) : 768;
        const height = Number.isFinite(body?.height) ? Number(body.height) : 768;
        const result = await generateImage(prompt.trim(), seed, width, height);
        return NextResponse.json(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : "이미지 생성에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

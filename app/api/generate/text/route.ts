import { NextResponse } from "next/server";
import { generateText } from "@/lib/pollinations";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const prompt: unknown = body?.prompt;
        if (typeof prompt !== "string" || !prompt.trim()) {
            return NextResponse.json({ error: "프롬프트를 입력해 주세요." }, { status: 400 });
        }
        const result = await generateText(prompt.trim());
        return NextResponse.json(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : "텍스트 생성에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * 연습·시험 클론의 실제 AI 응답 라우트 — provider와 대화 메시지를 받아 OpenRouter로 답을 만든다.
 * 외부 LLM(브랜드별 모델)을 호출하므로 서버에서만 동작한다.
 */
import { NextResponse } from "next/server";
import { hasKey, chatCompleteMessages } from "@/lib/openrouter";
import { PROVIDER_MODEL, buildDrillMessages, type DrillChatTurn } from "@/lib/drill-chat";
import type { LlmProvider } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS: LlmProvider[] = ["chatgpt", "claude", "gemini", "grok"];

// 클론 화면의 사용자 질문에 대해 실제 OpenRouter 응답 텍스트를 생성해 반환한다.
export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const provider: LlmProvider = PROVIDERS.includes(body?.provider)
        ? body.provider
        : "chatgpt";

    // 안전: role/content 형식이 맞는 턴만 통과시킨다.
    const rawMessages: unknown[] = Array.isArray(body?.messages) ? body.messages : [];
    const history: DrillChatTurn[] = [];
    for (const m of rawMessages) {
        if (m && typeof m === "object") {
            const role = (m as { role?: unknown }).role;
            const content = (m as { content?: unknown }).content;
            if ((role === "user" || role === "assistant") && typeof content === "string") {
                history.push({ role, content });
            }
        }
    }

    if (history.length === 0) {
        return NextResponse.json({ error: "보낼 메시지가 없습니다." }, { status: 400 });
    }
    if (!hasKey()) {
        return NextResponse.json(
            { error: "AI 연결이 설정되지 않았습니다. 관리자에게 문의해 주세요." },
            { status: 400 },
        );
    }

    const model = PROVIDER_MODEL[provider];
    const messages = buildDrillMessages(provider, history);
    try {
        const result = await chatCompleteMessages({ model, messages });
        return NextResponse.json({ text: result.text });
    } catch (err) {
        console.error("[drills/chat] OpenRouter 호출 실패:", err);
        return NextResponse.json(
            { error: "지금은 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." },
            { status: 500 },
        );
    }
}

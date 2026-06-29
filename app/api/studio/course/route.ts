/**
 * 강의 페이지 생성 채팅 API — 대화 이력 + "현재 페이지"를 받아 OpenRouter로 그 페이지를
 * 만들거나 고치고(JSON), usage.cost를 크레딧으로 환산해 사용량을 기록한 뒤 { reply, page }를
 * 돌려준다. 실제 페이지 적용(런타임 Page 변환)은 클라이언트의 docToPage가 맡는다.
 */
import { NextResponse } from "next/server";
import { chatCompleteMessages, hasKey } from "@/lib/openrouter";
import { getUsdKrw } from "@/lib/fx";
import { creditsToKrw, usdToCredits } from "@/lib/credits";
import { recordUsage } from "@/lib/usage";
import { DEFAULT_BLOCK_MODEL } from "@/lib/blocks";
import {
    buildPageMessages,
    parsePageGenReply,
    type ChatTurn,
    type CurrentPageContext,
} from "@/lib/course-ai";
import { PAGE_GEN_JSON_SCHEMA } from "@/lib/course-schema";

export const runtime = "nodejs";
export const maxDuration = 120;

/** 임의의 messages 입력을 안전한 ChatTurn[]로 정리한다(user/assistant만, 빈 내용 제거). */
function sanitizeHistory(raw: unknown): ChatTurn[] {
    if (!Array.isArray(raw)) return [];
    const out: ChatTurn[] = [];
    for (const m of raw) {
        const role = (m as { role?: unknown })?.role;
        const content = (m as { content?: unknown })?.content;
        if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
            out.push({ role, content });
        }
    }
    return out;
}

/** 임의의 currentPage 입력을 안전한 맥락 객체로 정리한다(없으면 null). */
function sanitizeCurrentPage(raw: unknown): CurrentPageContext | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title : "";
    const blocks = Array.isArray(r.blocks) ? r.blocks : [];
    return { title, blocks };
}

// POST /api/studio/course — 대화로 "현재 페이지"를 생성/수정한다.
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const history = sanitizeHistory(body?.messages);
        const currentPage = sanitizeCurrentPage(body?.currentPage);
        const courseTitle = typeof body?.courseTitle === "string" ? body.courseTitle : "";
        const model =
            typeof body?.model === "string" && body.model.trim()
                ? body.model.trim()
                : DEFAULT_BLOCK_MODEL.llm.id;
        const modelLabel =
            typeof body?.modelLabel === "string" && body.modelLabel.trim()
                ? body.modelLabel.trim()
                : DEFAULT_BLOCK_MODEL.llm.label;
        const userId = typeof body?.userId === "string" ? body.userId : "";
        const userName =
            typeof body?.userName === "string" && body.userName.trim()
                ? body.userName.trim()
                : "익명";

        if (history.length === 0) {
            return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
        }
        if (!hasKey()) {
            return NextResponse.json(
                {
                    error:
                        "OpenRouter API 키가 없습니다. 프로젝트 루트 .env.local의 OPENROUTER_API_KEY에 키를 넣고 서버를 다시 시작해 주세요.",
                },
                { status: 400 },
            );
        }

        const fx = await getUsdKrw();
        const messages = buildPageMessages(history, courseTitle, currentPage);
        const r = await chatCompleteMessages({
            model,
            messages,
            jsonSchema: { name: "instructorly_page", schema: PAGE_GEN_JSON_SCHEMA },
        });
        const { reply, page } = parsePageGenReply(r.text);

        const credits = usdToCredits(r.costUsd, fx.krwPerUsd);
        const krw = creditsToKrw(credits);

        // 사용량 기록 — 마지막 사용자 발화를 프롬프트로, AI 답변을 결과물로 남긴다.
        const lastUser = [...history].reverse().find((m) => m.role === "user");
        recordUsage({
            userId,
            userName,
            category: "text",
            model,
            modelLabel,
            prompt: lastUser?.content ?? "",
            costUsd: r.costUsd,
            krwPerUsd: fx.krwPerUsd,
            credits,
            genMs: r.genMs,
            ok: true,
            output: reply,
            kind: "text",
        });

        return NextResponse.json({
            reply,
            page,
            model,
            modelLabel,
            credits,
            krw,
            costUsd: r.costUsd,
            genMs: r.genMs,
            free: r.costUsd === 0,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "페이지 생성에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

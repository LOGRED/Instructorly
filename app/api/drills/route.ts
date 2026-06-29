import { NextResponse } from "next/server";
import { listDrills, createDrill } from "@/lib/db";
import type { DrillKind, LlmProvider } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS: LlmProvider[] = ["chatgpt", "claude", "gemini", "grok"];

// 한 강좌(programId)의 시험·연습 목록을 반환한다.
export async function GET(req: Request) {
    const url = new URL(req.url);
    const programId = url.searchParams.get("programId") ?? undefined;
    return NextResponse.json({ drills: listDrills(programId) });
}

// 새 시험/연습을 생성한다. kind(exam|practice)와 provider(LLM 종류)를 받는다.
export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const programId = typeof body?.programId === "string" ? body.programId : "";
    const kind: DrillKind = body?.kind === "exam" ? "exam" : "practice";
    const provider: LlmProvider = PROVIDERS.includes(body?.provider)
        ? body.provider
        : "chatgpt";
    const title =
        typeof body?.title === "string" && body.title.trim()
            ? body.title.trim()
            : kind === "exam"
              ? "새 시험"
              : "새 연습";
    const mission = typeof body?.mission === "string" ? body.mission : "";
    const authorId = typeof body?.authorId === "string" ? body.authorId : "";
    const authorName = typeof body?.authorName === "string" ? body.authorName : "익명";
    const drill = createDrill({
        programId,
        kind,
        provider,
        title,
        mission,
        authorId,
        authorName,
    });
    return NextResponse.json({ drill }, { status: 201 });
}

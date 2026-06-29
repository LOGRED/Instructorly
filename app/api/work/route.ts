import { NextResponse } from "next/server";
import {
    getStudentWork,
    getLessonWork,
    getAllStudentWork,
    saveStudentWork,
} from "@/lib/db";
import type { BlockRun } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const lessonId = url.searchParams.get("lessonId");
    // userId만 있고 강의 미지정이면 그 학생이 모든 강의에서 만든 작품 전체(자랑방 보관함).
    if (userId && !lessonId) {
        return NextResponse.json({ work: getAllStudentWork(userId) });
    }
    if (!lessonId) return NextResponse.json({ work: [] });
    if (userId) {
        return NextResponse.json({ work: getStudentWork(userId, lessonId) });
    }
    return NextResponse.json({ work: getLessonWork(lessonId) });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const lessonId = typeof body?.lessonId === "string" ? body.lessonId : "";
    const blockId = typeof body?.blockId === "string" ? body.blockId : "";
    const ALLOWED_TYPES = ["image", "video", "audio", "llm"] as const;
    const blockType: "image" | "video" | "audio" | "llm" =
        (ALLOWED_TYPES as readonly string[]).includes(body?.blockType)
            ? (body.blockType as "image" | "video" | "audio" | "llm")
            : "image";
    const run = body?.run as BlockRun | undefined;
    const appendHistory = !!body?.appendHistory;
    if (!userId || !lessonId || !blockId || !run) {
        return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const work = saveStudentWork({
        userId,
        lessonId,
        blockId,
        blockType,
        run,
        appendHistory,
    });
    return NextResponse.json({ work }, { status: 201 });
}

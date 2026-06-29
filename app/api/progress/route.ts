import { NextResponse } from "next/server";
import {
    recordProgress,
    getStudentProgress,
    getProgramProgress,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const programId = url.searchParams.get("programId");
    if (userId) {
        return NextResponse.json({
            progress: getStudentProgress(userId, programId ?? undefined),
        });
    }
    if (programId) {
        return NextResponse.json({ progress: getProgramProgress(programId) });
    }
    return NextResponse.json({ progress: [] });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const lessonId = typeof body?.lessonId === "string" ? body.lessonId : "";
    const programId =
        typeof body?.programId === "string" ? body.programId : undefined;
    const page = Number.isFinite(body?.page) ? Number(body.page) : 0;
    const totalPages = Number.isFinite(body?.totalPages)
        ? Number(body.totalPages)
        : 0;
    if (!userId || !lessonId) {
        return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const progress = recordProgress({
        userId,
        lessonId,
        programId,
        page,
        totalPages,
    });
    return NextResponse.json({ progress });
}

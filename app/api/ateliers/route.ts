import { NextResponse } from "next/server";
import { listAteliers, createAtelier } from "@/lib/db";
import type { AtelierGenre } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENRES: AtelierGenre[] = ["poem", "storybook", "essay"];

// 한 강좌(programId)의 창작 실습 목록을 반환한다.
export async function GET(req: Request) {
    const url = new URL(req.url);
    const programId = url.searchParams.get("programId") ?? undefined;
    return NextResponse.json({ ateliers: listAteliers(programId) });
}

// 새 창작 실습을 생성한다. 장르·템플릿으로 강사 시범본을 자동 구성한다.
export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const programId = typeof body?.programId === "string" ? body.programId : "";
    const genre: AtelierGenre = GENRES.includes(body?.genre) ? body.genre : "poem";
    const templateId = typeof body?.templateId === "string" ? body.templateId : undefined;
    const title =
        typeof body?.title === "string" && body.title.trim()
            ? body.title.trim()
            : "새 창작 실습";
    const brief = typeof body?.brief === "string" ? body.brief : "";
    const authorId = typeof body?.authorId === "string" ? body.authorId : "";
    const authorName = typeof body?.authorName === "string" ? body.authorName : "익명";
    const atelier = createAtelier({
        programId,
        genre,
        templateId,
        title,
        brief,
        authorId,
        authorName,
    });
    return NextResponse.json({ atelier }, { status: 201 });
}

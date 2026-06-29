import { NextResponse } from "next/server";
import { getCourse, upsertCourse, deleteCourse } from "@/lib/db";
import type { Course } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    const course = getCourse(id);
    if (!course) {
        return NextResponse.json({ error: "강의를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ course });
}

export async function PUT(req: Request, { params }: Params) {
    const { id } = await params;
    const existing = getCourse(id);
    if (!existing) {
        return NextResponse.json({ error: "강의를 찾을 수 없습니다." }, { status: 404 });
    }
    const body = (await req.json()) as Partial<Course>;
    const updated: Course = {
        ...existing,
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        cover: body.cover !== undefined ? body.cover : existing.cover,
        authorNickname: body.authorNickname ?? existing.authorNickname,
        maxWidth: body.maxWidth ?? existing.maxWidth,
        pages: body.pages ?? existing.pages,
        id,
    };
    const saved = upsertCourse(updated);
    return NextResponse.json({ course: saved });
}

export async function DELETE(_req: Request, { params }: Params) {
    const { id } = await params;
    deleteCourse(id);
    return NextResponse.json({ ok: true });
}

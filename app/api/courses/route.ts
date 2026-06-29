import { NextResponse } from "next/server";
import { listCourses, upsertCourse } from "@/lib/db";
import type { Course } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({ courses: listCourses() });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "새 강의";
    const description = typeof body?.description === "string" ? body.description : "";
    const authorNickname = typeof body?.authorNickname === "string" ? body.authorNickname : "익명 강사";
    const now = Date.now();
    const course: Course = {
        id: crypto.randomUUID(),
        title,
        description,
        cover: null,
        authorNickname,
        pages: [{ id: crypto.randomUUID(), title: "1페이지", blocks: [] }],
        createdAt: now,
        updatedAt: now,
    };
    const saved = upsertCourse(course);
    return NextResponse.json({ course: saved }, { status: 201 });
}

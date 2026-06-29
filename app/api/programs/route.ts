import { NextResponse } from "next/server";
import {
    listProgramsForInstructor,
    listProgramsForStudent,
    listAllPrograms,
    createProgram,
} from "@/lib/db";
import type { ProgramSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    const ownerId = url.searchParams.get("ownerId");
    const userId = url.searchParams.get("userId");
    let programs: ProgramSummary[];
    if (role === "instructor" && ownerId) {
        programs = listProgramsForInstructor(ownerId);
    } else if (role === "student" && userId) {
        programs = listProgramsForStudent(userId);
    } else {
        programs = listAllPrograms();
    }
    return NextResponse.json({ programs });
}

// "YYYY-MM-DD" 형식의 날짜 문자열만 통과시키고 나머지는 null로 정규화한다.
function normalizeDate(v: unknown): string | null {
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

// 0~6 정수만 남기고 중복을 제거한 수업 요일 배열을 만든다.
function normalizeWeekDays(v: unknown): number[] {
    if (!Array.isArray(v)) return [];
    const days = v.filter(
        (n): n is number => Number.isInteger(n) && n >= 0 && n <= 6,
    );
    return Array.from(new Set(days)).sort((a, b) => a - b);
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title : "";
    const description =
        typeof body?.description === "string" ? body.description : "";
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "";
    const ownerName = typeof body?.ownerName === "string" ? body.ownerName : "";
    const startDate = normalizeDate(body?.startDate);
    const endDate = normalizeDate(body?.endDate);
    const weekDays = normalizeWeekDays(body?.weekDays);
    if (!ownerId) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const program = createProgram({
        title,
        description,
        ownerId,
        ownerName,
        startDate,
        endDate,
        weekDays,
    });
    return NextResponse.json({ program }, { status: 201 });
}

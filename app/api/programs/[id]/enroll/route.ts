import { NextResponse } from "next/server";
import {
    listEnrollments,
    enrollStudent,
    unenrollStudent,
    getProgramProgress,
} from "@/lib/db";
import type { Enrollment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    return NextResponse.json({
        enrollments: listEnrollments(id),
        progress: getProgramProgress(id),
    });
}

export async function POST(req: Request, { params }: Params) {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body?.userIds)
        ? body.userIds.filter((u: unknown) => typeof u === "string")
        : [];
    const enrolled: Enrollment[] = [];
    const failed: string[] = [];
    for (const uid of userIds) {
        const e = enrollStudent(id, uid);
        if (e) enrolled.push(e);
        else failed.push(uid);
    }
    return NextResponse.json({ enrolled, failed }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId : "";
    if (userId) unenrollStudent(id, userId);
    return NextResponse.json({ ok: true });
}

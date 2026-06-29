import { NextResponse } from "next/server";
import { searchUsers } from "@/lib/db";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const roleParam = url.searchParams.get("role");
    const role: Role | undefined =
        roleParam === "instructor" || roleParam === "student"
            ? roleParam
            : undefined;
    const users = searchUsers(q, role);
    return NextResponse.json({ users });
}

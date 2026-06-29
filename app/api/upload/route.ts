import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import type { ChatAttachmentType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function detectType(mime: string): ChatAttachmentType {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "file";
}

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
            return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
        }
        const bytes = Buffer.from(await file.arrayBuffer());
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const id = crypto.randomUUID();
        const filename = `${id}${ext ? "." + ext : ""}`;
        const dir = path.join(process.cwd(), "public", "uploads");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, filename), bytes);
        return NextResponse.json({
            url: `/uploads/${filename}`,
            type: detectType(file.type),
            name: file.name,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "업로드에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

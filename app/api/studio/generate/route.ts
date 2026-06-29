/**
 * AI 스튜디오 생성 API — 카테고리(text/image/video/audio)에 맞춰 OpenRouter를 호출하고,
 * 응답의 usage.cost(USD)를 실시간 환율로 크레딧(1크레딧=0.1원)으로 환산해 사용량을 기록한
 * 뒤 결과를 돌려준다. 동영상은 비동기 잡이라 서버에서 완료까지 폴링한다.
 */
import { NextResponse } from "next/server";
import {
    chatComplete,
    generateAudio,
    generateImage,
    hasKey,
    submitVideo,
    pollVideo,
} from "@/lib/openrouter";
import { getUsdKrw } from "@/lib/fx";
import { creditsToKrw, usdToCredits } from "@/lib/credits";
import { recordUsage } from "@/lib/usage";
import type { StudioCategory, StudioGenResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 지정 ms만큼 대기한다(동영상 폴링용). */
function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** 동영상 잡을 완료까지 폴링하고 {kind, output(프록시 URL), costUsd, genMs}를 만든다. */
async function runVideo(
    model: string,
    prompt: string,
    resolution: string | undefined,
    aspectRatio: string | undefined,
): Promise<{ output: string; costUsd: number; genMs: number }> {
    const start = Date.now();
    const { jobId } = await submitVideo({ model, prompt, resolution, aspectRatio });
    const deadline = start + 240_000; // 최대 4분 대기
    while (Date.now() < deadline) {
        await sleep(4000);
        const s = await pollVideo(jobId);
        if (s.status === "completed") {
            const output = `/api/studio/video/content?id=${encodeURIComponent(jobId)}&index=0`;
            return { output, costUsd: s.costUsd, genMs: Date.now() - start };
        }
        if (s.status === "failed") {
            throw new Error("동영상 생성에 실패했습니다.");
        }
    }
    throw new Error(
        `동영상 생성이 시간 내에 끝나지 않았습니다(작업 id: ${jobId}). 잠시 후 다시 시도해 주세요.`,
    );
}

// POST /api/studio/generate — 카테고리별 생성을 실행하고 사용량을 기록한다.
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const category = body?.category as StudioCategory;
        const model = typeof body?.model === "string" ? body.model.trim() : "";
        const modelLabel =
            typeof body?.modelLabel === "string" && body.modelLabel.trim()
                ? body.modelLabel.trim()
                : model;
        const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
        const userId = typeof body?.userId === "string" ? body.userId : "";
        const userName =
            typeof body?.userName === "string" && body.userName.trim()
                ? body.userName.trim()
                : "익명";
        const system = typeof body?.system === "string" ? body.system : undefined;
        const voice = typeof body?.voice === "string" ? body.voice : undefined;
        const resolution =
            typeof body?.resolution === "string" ? body.resolution : undefined;
        const aspectRatio =
            typeof body?.aspectRatio === "string" ? body.aspectRatio : undefined;

        if (!model) {
            return NextResponse.json({ error: "모델을 선택해 주세요." }, { status: 400 });
        }
        if (!prompt) {
            return NextResponse.json(
                { error: "프롬프트를 입력해 주세요." },
                { status: 400 },
            );
        }
        if (!["text", "image", "video", "audio"].includes(category)) {
            return NextResponse.json(
                { error: "알 수 없는 생성 종류입니다." },
                { status: 400 },
            );
        }
        if (!hasKey()) {
            return NextResponse.json(
                {
                    error:
                        "OpenRouter API 키가 없습니다. 프로젝트 루트 .env.local의 OPENROUTER_API_KEY에 키를 넣고 서버를 다시 시작해 주세요.",
                },
                { status: 400 },
            );
        }

        const fx = await getUsdKrw();

        let kind: StudioGenResult["kind"] = "text";
        let output = "";
        let costUsd = 0;
        let genMs = 0;

        if (category === "text") {
            const r = await chatComplete({ model, prompt, system });
            kind = "text";
            output = r.text;
            costUsd = r.costUsd;
            genMs = r.genMs;
        } else if (category === "image") {
            const r = await generateImage({ model, prompt, resolution, aspectRatio });
            kind = "image";
            output = r.dataUrl;
            costUsd = r.costUsd;
            genMs = r.genMs;
        } else if (category === "audio") {
            const r = await generateAudio({ model, prompt, voice });
            kind = "audio";
            output = r.dataUrl;
            costUsd = r.costUsd;
            genMs = r.genMs;
        } else {
            const r = await runVideo(model, prompt, resolution, aspectRatio);
            kind = "video";
            output = r.output;
            costUsd = r.costUsd;
            genMs = r.genMs;
        }

        const credits = usdToCredits(costUsd, fx.krwPerUsd);
        const krw = creditsToKrw(credits);

        // 사용량 기록(사용자별 과금 집계 + 결과물 다시 보기용).
        recordUsage({
            userId,
            userName,
            category,
            model,
            modelLabel,
            prompt,
            costUsd,
            krwPerUsd: fx.krwPerUsd,
            credits,
            genMs,
            ok: true,
            output,
            kind,
        });

        const result: StudioGenResult = {
            category,
            model,
            modelLabel,
            kind,
            output,
            credits,
            krw,
            costUsd,
            genMs,
            free: costUsd === 0,
        };
        return NextResponse.json(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : "생성에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

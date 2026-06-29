// Pollinations free generation helpers (no API key required).
// Image bytes are inlined as a data URL so a saved lecture keeps its generated
// images even if the external service is later unavailable.

const IMAGE_BASE = "https://image.pollinations.ai/prompt/";
const TEXT_BASE = "https://text.pollinations.ai/";

export interface ImageResult {
    dataUrl: string;
    genMs: number;
    seed: number;
}

export async function generateImage(
    prompt: string,
    seed: number,
    width = 768,
    height = 768,
): Promise<ImageResult> {
    const url = `${IMAGE_BASE}${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
    const start = Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`이미지 생성 실패 (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    const genMs = Date.now() - start;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return {
        dataUrl: `data:${contentType};base64,${buf.toString("base64")}`,
        genMs,
        seed,
    };
}

export interface TextResult {
    output: string;
    genMs: number;
}

export async function generateText(prompt: string): Promise<TextResult> {
    const url = `${TEXT_BASE}${encodeURIComponent(prompt)}`;
    const start = Date.now();
    const res = await fetch(url, {
        cache: "no-store",
        headers: { accept: "text/plain" },
    });
    if (!res.ok) throw new Error(`텍스트 생성 실패 (${res.status})`);
    const output = (await res.text()).trim();
    const genMs = Date.now() - start;
    return { output, genMs };
}

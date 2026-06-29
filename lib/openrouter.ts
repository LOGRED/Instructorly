/**
 * OpenRouter 서버 클라이언트 — OpenAI 규격으로 텍스트/이미지/동영상/오디오를 생성하고,
 * 모델 가격표(라이브 단가)를 제공한다. 모든 비용은 응답의 usage.cost(USD)에서 읽는다.
 *
 * 엔드포인트(2026-06 기준):
 *  - 텍스트: POST /chat/completions          (usage.cost 인라인 반환)
 *  - 이미지: POST /images                     (data[].b64_json, usage.cost)
 *  - 동영상: POST /videos → GET /videos/{id}  (비동기 잡, unsigned_urls, usage.cost)
 *  - 오디오: POST /chat/completions + modalities:["text","audio"]
 *  - 카탈로그: GET /models, /images/models, /videos/models
 *
 * 서버 전용 모듈(라우트 핸들러에서만 import). 키는 .env.local의 OPENROUTER_API_KEY.
 */
import { usdToCredits } from "./credits";
import type { ModelPricing, StudioCategory, StudioModel } from "./types";

const BASE = "https://openrouter.ai/api/v1";
/** 모델 디스커버리(가격표) 캐시 수명 — 10분. */
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

// ─────────────────────────── 인증/헤더 ───────────────────────────

/** 서버에 OpenRouter API 키가 설정돼 있는지 확인한다. */
export function hasKey(): boolean {
    return !!process.env.OPENROUTER_API_KEY?.trim();
}

/** API 키를 읽는다(없으면 명확한 에러). */
function apiKey(): string {
    const k = process.env.OPENROUTER_API_KEY?.trim();
    if (!k) {
        throw new Error(
            "OPENROUTER_API_KEY가 설정되지 않았습니다. 프로젝트 루트 .env.local에 키를 넣고 서버를 다시 시작해 주세요.",
        );
    }
    return k;
}

/** OpenRouter 호출용 인증 헤더를 만든다. */
function authHeaders(json = true): Record<string, string> {
    const h: Record<string, string> = {
        Authorization: `Bearer ${apiKey()}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_SITE_NAME ?? "Instructorly AI Studio",
    };
    if (json) h["Content-Type"] = "application/json";
    return h;
}

/** OpenRouter 에러 응답에서 사람이 읽을 메시지를 뽑는다(provider 원본 사유 포함). */
function orError(data: unknown, status: number): string {
    const err = (data as { error?: { message?: string; metadata?: unknown } })?.error;
    const msg = err?.message;
    // "Provider returned error"처럼 모호할 때 metadata.raw에 실제 사유가 있다.
    const meta = err?.metadata as
        | { raw?: unknown; provider_name?: string; provider?: string }
        | undefined;
    let detail = "";
    if (meta?.raw != null) {
        detail =
            typeof meta.raw === "string" ? meta.raw : JSON.stringify(meta.raw);
    }
    const provider = meta?.provider_name ?? meta?.provider;
    const parts: string[] = [];
    if (msg) parts.push(msg);
    if (provider) parts.push(`provider=${provider}`);
    if (detail) parts.push(detail.slice(0, 600));
    return parts.length
        ? `OpenRouter: ${parts.join(" — ")}`
        : `OpenRouter 요청 실패 (${status})`;
}

/** 응답의 usage.cost(USD)를 읽는다. 없으면 0. */
function readCost(data: unknown): number {
    const c = (data as { usage?: { cost?: number } })?.usage?.cost;
    return typeof c === "number" && Number.isFinite(c) ? c : 0;
}

// ─────────────────────────── 큐레이션 카탈로그 ───────────────────────────
// 라이브 디스커버리가 단가/존재 여부를 채우고, 여기서는 한국어 라벨·설명·폴백 단가만 둔다.

interface Curated {
    id: string;
    label: string;
    description: string;
    free?: boolean;
    badges?: string[];
    /** 라이브 단가가 없을 때 표시용으로 쓰는 폴백 USD 단가(토큰/장/요청당). */
    usd?: {
        prompt?: number;
        completion?: number;
        image?: number;
        request?: number;
        audio?: number;
    };
}

/** 카테고리별 큐레이션 모델 — 텍스트 10개(무료 3), 이미지/동영상/오디오 3~5개씩. */
const CURATED: Record<StudioCategory, Curated[]> = {
    text: [
        {
            id: "openai/gpt-5.5",
            label: "GPT-5.5",
            description: "OpenAI 최신 대형 모델 — 가장 똑똑한 범용. 이미지·파일 입력 지원.",
            badges: ["추천", "멀티모달"],
            usd: { prompt: 0.000005, completion: 0.00003 },
        },
        {
            id: "anthropic/claude-opus-4.8",
            label: "Claude Opus 4.8",
            description: "앤트로픽 최상위 — 길고 정교한 글, 복잡한 추론에 강함.",
            badges: ["추천", "멀티모달"],
            usd: { prompt: 0.000005, completion: 0.000025 },
        },
        {
            id: "google/gemini-3.5-flash",
            label: "Gemini 3.5 Flash",
            description: "구글 — 빠르고 저렴. 텍스트·이미지·음성·영상 입력을 모두 받는다.",
            badges: ["멀티모달", "가성비"],
            usd: { prompt: 0.0000015, completion: 0.000009 },
        },
        {
            id: "anthropic/claude-fable-5",
            label: "Claude Fable 5",
            description: "앤트로픽 — 이야기·창작 글쓰기에 특화된 모델.",
            usd: { prompt: 0.00001, completion: 0.00005 },
        },
        {
            id: "deepseek/deepseek-v4-pro",
            label: "DeepSeek V4 Pro",
            description: "초저가 고성능 추론 모델 — 가격 대비 성능이 뛰어나다.",
            badges: ["가성비"],
            usd: { prompt: 0.000000435, completion: 0.00000087 },
        },
        {
            id: "qwen/qwen3.7-max",
            label: "Qwen3.7 Max",
            description: "알리바바 — 다국어(한·중·영)에 강한 대형 모델.",
            usd: { prompt: 0.00000125, completion: 0.00000375 },
        },
        {
            id: "openai/gpt-chat-latest",
            label: "GPT Chat Latest",
            description: "ChatGPT가 실제로 쓰는 최신 채팅 모델.",
            usd: { prompt: 0.000005, completion: 0.00003 },
        },
        {
            id: "cohere/north-mini-code:free",
            label: "North Mini Code (무료)",
            description: "Cohere — 코딩에 적합한 무료 모델. 비용 0원.",
            free: true,
            badges: ["무료"],
            usd: { prompt: 0, completion: 0 },
        },
        {
            id: "nvidia/nemotron-3-ultra-550b-a55b:free",
            label: "Nemotron 3 Ultra (무료)",
            description: "엔비디아 초대형 무료 모델 — 무료로 강력한 성능.",
            free: true,
            badges: ["무료"],
            usd: { prompt: 0, completion: 0 },
        },
        {
            id: "poolside/laguna-m.1:free",
            label: "Laguna M.1 (무료)",
            description: "Poolside — 코드 생성 특화 무료 모델.",
            free: true,
            badges: ["무료"],
            usd: { prompt: 0, completion: 0 },
        },
    ],
    image: [
        {
            id: "google/gemini-3.1-flash-image",
            label: "Nano Banana 2",
            description: "구글 초고속 이미지 생성 — 빠르고 저렴.",
            badges: ["추천", "빠름"],
            usd: { image: 0.003 },
        },
        {
            id: "google/gemini-3-pro-image",
            label: "Nano Banana Pro",
            description: "구글 고품질 이미지 생성 — 디테일이 좋다.",
            badges: ["고품질"],
            usd: { image: 0.012 },
        },
        {
            id: "openai/gpt-5.4-image-2",
            label: "GPT-5.4 Image 2",
            description: "OpenAI 이미지 생성 — 지시 이해력이 뛰어나다.",
            usd: { image: 0.015 },
        },
        {
            id: "bytedance-seed/seedream-4.5",
            label: "Seedream 4.5",
            description: "바이트댄스 — 고해상도(2K) 이미지 생성.",
            usd: { image: 0.04 },
        },
    ],
    video: [
        {
            id: "openai/sora-2-pro",
            label: "Sora 2 Pro",
            description: "OpenAI 플래그십 — 물리적으로 자연스러운 고품질 영상 + 동기 오디오.",
            badges: ["추천", "고품질"],
        },
        {
            id: "google/veo-3.1",
            label: "Veo 3.1",
            description: "구글 — 텍스트·이미지로 고품질 영상 생성, 네이티브 오디오 포함.",
            badges: ["멀티모달"],
        },
        {
            id: "google/veo-3.1-fast",
            label: "Veo 3.1 Fast",
            description: "구글 — 품질과 속도의 균형. Veo 3.1보다 빠르고 저렴.",
            badges: ["빠름"],
        },
        {
            id: "google/veo-3.1-lite",
            label: "Veo 3.1 Lite",
            description: "구글 — 가장 저렴. 720p/1080p 대량 생성에 적합.",
            badges: ["가성비"],
        },
    ],
    audio: [
        {
            id: "openai/gpt-audio",
            label: "GPT Audio",
            description: "OpenAI — 자연스러운 목소리의 음성·오디오 생성.",
            badges: ["추천"],
        },
        {
            id: "openai/gpt-audio-mini",
            label: "GPT Audio Mini",
            description: "OpenAI — 가벼운 음성 생성.",
        },
    ],
};

// ─────────────────────────── 라이브 디스커버리(가격표) ───────────────────────────

interface LiveModel {
    id: string;
    name?: string;
    pricing?: Record<string, string>;
    architecture?: {
        input_modalities?: string[];
        output_modalities?: string[];
    };
}

const discoveryCache: Record<string, { models: Map<string, LiveModel>; at: number }> = {};

/** OpenRouter 디스커버리 엔드포인트에서 모델 목록을 Map<id, LiveModel>으로 받는다(10분 캐시). */
async function fetchDiscovery(path: string): Promise<Map<string, LiveModel>> {
    const cached = discoveryCache[path];
    if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) return cached.models;
    const map = new Map<string, LiveModel>();
    try {
        // /models는 공개지만, /images/models·/videos/models는 키가 필요할 수 있어 있으면 같이 보낸다.
        const headers = hasKey() ? authHeaders(false) : undefined;
        const res = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
        if (res.ok) {
            const data = (await res.json()) as { data?: LiveModel[]; models?: LiveModel[] };
            const arr = data?.data ?? data?.models ?? [];
            for (const m of arr) if (m?.id) map.set(m.id, m);
        }
    } catch {
        // 네트워크 실패 — 빈 맵으로 폴백(폴백 단가가 표시됨).
    }
    discoveryCache[path] = { models: map, at: Date.now() };
    return map;
}

/** 문자열 단가를 숫자로(파싱 실패면 undefined). */
function num(s?: string): number | undefined {
    if (s == null) return undefined;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
}

/** pricing 객체의 모든 숫자 단가가 0이면 true(무료 모델 판정용). */
function isAllZero(p: Record<string, string>): boolean {
    const vals = Object.values(p).map(num).filter((v): v is number => v != null);
    return vals.length > 0 && vals.every((v) => v === 0);
}

/** 라이브/폴백 단가를 크레딧 단가(ModelPricing)로 환산한다. */
function toPricing(
    raw: Record<string, string> | undefined,
    fb: Curated["usd"],
    category: StudioCategory,
    rate: number,
): ModelPricing {
    const prompt = num(raw?.prompt) ?? fb?.prompt;
    const completion = num(raw?.completion) ?? fb?.completion;
    const image = num(raw?.image) ?? fb?.image;
    const request = num(raw?.request) ?? fb?.request;
    const audio = num(raw?.audio) ?? fb?.audio;
    const pricing: ModelPricing = {
        usd: { prompt, completion, image, request, audio },
    };
    if (prompt != null) pricing.inputPerMTokCredits = usdToCredits(prompt * 1e6, rate);
    if (completion != null)
        pricing.outputPerMTokCredits = usdToCredits(completion * 1e6, rate);
    if (category === "image") {
        const per = image ?? request;
        if (per != null) pricing.perImageCredits = usdToCredits(per, rate);
    }
    if (category === "video" || category === "audio") {
        const per = request ?? image ?? audio;
        if (per != null) pricing.perRequestCredits = usdToCredits(per, rate);
    }
    return pricing;
}

/** 큐레이션 항목 + 라이브 모델 → 클라이언트용 StudioModel. */
function makeModel(
    c: Curated,
    category: StudioCategory,
    live: LiveModel | undefined,
    rate: number,
    liveOk: boolean,
): StudioModel {
    const raw = live?.pricing;
    const pricing = toPricing(raw, c.usd, category, rate);
    const free =
        c.free === true || c.id.endsWith(":free") || (raw ? isAllZero(raw) : false);
    // 디스커버리가 정상 동작했으면 실제 존재 여부로, 실패했으면 폴백 단가로 표시(available=true).
    const available = liveOk ? !!live : true;
    return {
        id: c.id,
        label: c.label,
        description: c.description,
        category,
        free,
        available,
        pricing,
        badges: c.badges,
    };
}

/** 라이브 오디오 모델에서 표시용 이름을 만든다. */
function prettyName(m: LiveModel): string {
    return m.name ?? m.id.split("/").pop() ?? m.id;
}

/** 실제 오디오 출력 모델을 최대 5개 고른다(큐레이션 우선, 부족하면 라이브로 채움). */
function pickAudio(real: LiveModel[], curated: Curated[]): LiveModel[] {
    const byId = new Map(real.map((m) => [m.id, m]));
    const picked: LiveModel[] = [];
    for (const c of curated) {
        const m = byId.get(c.id);
        if (m) {
            picked.push(m);
            byId.delete(m.id);
        }
    }
    for (const m of byId.values()) {
        if (picked.length >= 5) break;
        picked.push(m);
    }
    return picked.slice(0, 5);
}

/** 전체 모델 카탈로그(텍스트/이미지/동영상/오디오)를 크레딧 단가까지 채워 만든다. */
export async function buildCatalog(krwPerUsd: number): Promise<StudioModel[]> {
    const [textLive, imageLive, videoLive] = await Promise.all([
        fetchDiscovery("/models"),
        fetchDiscovery("/images/models"),
        fetchDiscovery("/videos/models"),
    ]);
    const out: StudioModel[] = [];

    for (const c of CURATED.text) {
        out.push(makeModel(c, "text", textLive.get(c.id), krwPerUsd, textLive.size > 0));
    }
    for (const c of CURATED.image) {
        out.push(
            makeModel(c, "image", imageLive.get(c.id), krwPerUsd, imageLive.size > 0),
        );
    }
    for (const c of CURATED.video) {
        out.push(
            makeModel(c, "video", videoLive.get(c.id), krwPerUsd, videoLive.size > 0),
        );
    }

    // 오디오 — 라이브 /models에서 출력 모달리티에 audio가 있는 실제 모델을 우선 사용.
    const audioReal = [...textLive.values()].filter((m) =>
        m.architecture?.output_modalities?.includes("audio"),
    );
    const picks = pickAudio(audioReal, CURATED.audio);
    if (picks.length > 0) {
        const curMap = new Map(CURATED.audio.map((c) => [c.id, c]));
        for (const m of picks) {
            const c: Curated =
                curMap.get(m.id) ?? {
                    id: m.id,
                    label: prettyName(m),
                    description: "오디오·음성 생성 모델.",
                };
            out.push(makeModel(c, "audio", m, krwPerUsd, true));
        }
    } else {
        // 라이브에서 못 찾으면 큐레이션 폴백(available은 디스커버리 성공 여부에 따름).
        for (const c of CURATED.audio) {
            out.push(makeModel(c, "audio", textLive.get(c.id), krwPerUsd, false));
        }
    }
    return out;
}

/** 모델 id로 카테고리를 추정한다(생성 라우트에서 분기용). 카탈로그에 없으면 null. */
export function categoryOf(modelId: string): StudioCategory | null {
    for (const [cat, list] of Object.entries(CURATED) as [StudioCategory, Curated[]][]) {
        if (list.some((c) => c.id === modelId)) return cat;
    }
    return null;
}

// ─────────────────────────── 생성 함수 ───────────────────────────

export interface ChatResult {
    text: string;
    costUsd: number;
    genMs: number;
}

/** 텍스트 생성 — OpenAI 규격 /chat/completions 호출. usage.cost로 실제 비용을 읽는다. */
export async function chatComplete(opts: {
    model: string;
    prompt: string;
    system?: string;
}): Promise<ChatResult> {
    const start = Date.now();
    const messages: { role: string; content: string }[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push({ role: "user", content: opts.prompt });
    const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: authHeaders(),
        cache: "no-store",
        body: JSON.stringify({ model: opts.model, messages }),
    });
    const data = (await res.json()) as {
        choices?: { message?: { content?: unknown } }[];
    };
    if (!res.ok) throw new Error(orError(data, res.status));
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : JSON.stringify(content ?? "");
    return { text, costUsd: readCost(data), genMs: Date.now() - start };
}

/**
 * 다중 메시지(대화) 텍스트 생성 — 강의 채팅 생성에 쓴다.
 * jsonSchema를 주면 response_format=json_schema로 구조를 강제하고, 그 모델이
 * 미지원이면 json_object로 1회 폴백한다. usage.cost로 실제 비용을 읽는다.
 */
export async function chatCompleteMessages(opts: {
    model: string;
    messages: { role: string; content: string }[];
    jsonSchema?: { name: string; schema: unknown };
}): Promise<ChatResult> {
    const start = Date.now();

    // 1차: 구조화 출력(json_schema) 시도(있으면).
    const body1: Record<string, unknown> = { model: opts.model, messages: opts.messages };
    if (opts.jsonSchema) {
        body1.response_format = {
            type: "json_schema",
            json_schema: { name: opts.jsonSchema.name, schema: opts.jsonSchema.schema, strict: false },
        };
    }
    let res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: authHeaders(),
        cache: "no-store",
        body: JSON.stringify(body1),
    });
    let data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };

    // 2차 폴백: json_schema가 거부되면(구조화 출력 미지원 모델) json_object로 재시도.
    if (!res.ok && opts.jsonSchema) {
        const body2 = {
            model: opts.model,
            messages: opts.messages,
            response_format: { type: "json_object" },
        };
        res = await fetch(`${BASE}/chat/completions`, {
            method: "POST",
            headers: authHeaders(),
            cache: "no-store",
            body: JSON.stringify(body2),
        });
        data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    }

    if (!res.ok) throw new Error(orError(data, res.status));
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : JSON.stringify(content ?? "");
    return { text, costUsd: readCost(data), genMs: Date.now() - start };
}

export interface ImageResult {
    dataUrl: string;
    costUsd: number;
    genMs: number;
}

/** 이미지 생성 — POST /images. b64_json을 data URL로 감싸 돌려준다. */
export async function generateImage(opts: {
    model: string;
    prompt: string;
    resolution?: string;
    aspectRatio?: string;
}): Promise<ImageResult> {
    const start = Date.now();
    const body: Record<string, unknown> = { model: opts.model, prompt: opts.prompt };
    if (opts.resolution) body.resolution = opts.resolution;
    if (opts.aspectRatio) body.aspect_ratio = opts.aspectRatio;
    const res = await fetch(`${BASE}/images`, {
        method: "POST",
        headers: authHeaders(),
        cache: "no-store",
        body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
        data?: { b64_json?: string; url?: string }[];
    };
    if (!res.ok) throw new Error(orError(data, res.status));
    const first = data?.data?.[0];
    let dataUrl: string;
    if (first?.b64_json) dataUrl = `data:image/png;base64,${first.b64_json}`;
    else if (first?.url) dataUrl = first.url;
    else throw new Error("이미지 응답에 데이터가 없습니다.");
    return { dataUrl, costUsd: readCost(data), genMs: Date.now() - start };
}

export interface AudioResult {
    dataUrl: string;
    transcript: string;
    costUsd: number;
    genMs: number;
}

/** OpenAI gpt-audio pcm16 출력 기본 샘플레이트(24kHz mono 16-bit LE). */
const PCM_SAMPLE_RATE = 24000;

/** raw PCM16(mono LE) 버퍼에 WAV 헤더를 씌워 재생 가능한 WAV 버퍼로 만든다. */
function pcm16ToWav(pcm: Buffer, sampleRate = PCM_SAMPLE_RATE): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcm.length;
    const header = Buffer.alloc(44);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(36 + dataSize, 4);
    header.write("WAVE", 8, "ascii");
    header.write("fmt ", 12, "ascii");
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36, "ascii");
    header.writeUInt32LE(dataSize, 40);
    return Buffer.concat([header, pcm]);
}

/**
 * 오디오 생성 — /chat/completions에 modalities:["text","audio"]로 요청(OpenAI 규격).
 * OpenRouter는 오디오 출력 시 stream:true를 강제하므로 SSE로 받아 audio.data(base64)와
 * transcript 델타를 누적하고, include_usage로 마지막 청크의 usage.cost를 읽는다.
 */
export async function generateAudio(opts: {
    model: string;
    prompt: string;
    voice?: string;
}): Promise<AudioResult> {
    const start = Date.now();
    const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { ...authHeaders(), Accept: "text/event-stream" },
        cache: "no-store",
        body: JSON.stringify({
            model: opts.model,
            modalities: ["text", "audio"],
            // stream=true에서는 OpenAI가 pcm16만 허용(wav 불가). 받은 PCM은 아래서 WAV로 래핑한다.
            audio: { voice: opts.voice ?? "alloy", format: "pcm16" },
            messages: [{ role: "user", content: opts.prompt }],
            stream: true,
            stream_options: { include_usage: true },
        }),
    });

    // 에러 응답은 SSE가 아니라 JSON이므로 그대로 파싱해 메시지를 뽑는다.
    if (!res.ok) {
        let errData: unknown = null;
        try {
            errData = await res.json();
        } catch {
            errData = null;
        }
        throw new Error(orError(errData, res.status));
    }
    if (!res.body) throw new Error("오디오 스트림 응답이 비어 있습니다.");

    // SSE 청크에서 audio.data(base64), transcript, usage.cost를 누적.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fmt = "wav";
    let transcript = "";
    const audioParts: string[] = [];
    let costUsd = 0;
    const rawSamples: string[] = []; // 진단용 원본 청크 일부

    // 파싱된 청크 객체 어디에 있든 audio.data / format / transcript를 깊이 탐색해 누적한다.
    const collectAudio = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const item of node) collectAudio(item);
            return;
        }
        const o = node as Record<string, unknown>;
        const a = o.audio;
        if (a && typeof a === "object") {
            const ao = a as Record<string, unknown>;
            if (typeof ao.data === "string" && ao.data) audioParts.push(ao.data);
            if (typeof ao.format === "string" && ao.format) fmt = ao.format;
            if (typeof ao.transcript === "string" && ao.transcript)
                transcript += ao.transcript;
        }
        // input_audio/content 배열 등 다른 위치에 박힌 audio도 탐색.
        for (const v of Object.values(o)) {
            if (v && typeof v === "object") collectAudio(v);
        }
    };

    // 한 SSE data 줄(JSON)을 파싱해 오디오/자막/비용 델타를 누적한다.
    const ingest = (json: string): void => {
        if (json === "[DONE]") return;
        if (rawSamples.length < 8) rawSamples.push(json.slice(0, 400));
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return;
        }
        const obj = parsed as {
            usage?: { cost?: number };
            error?: { message?: string };
        };
        if (obj.error) throw new Error(orError(parsed, res.status));
        collectAudio(parsed);
        const c = obj.usage?.cost;
        if (typeof c === "number" && Number.isFinite(c)) costUsd = c;
    };

    // 버퍼에서 완성된 "data:" 줄들을 꺼내 처리한다.
    const drain = (): void => {
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line.startsWith("data:")) ingest(line.slice(5).trim());
        }
    };

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drain();
    }
    buffer += decoder.decode();
    buffer += "\n";
    drain();

    if (audioParts.length === 0) {
        const sample = rawSamples.join("\n").slice(0, 1200) || "(빈 스트림)";
        throw new Error(`오디오 응답에 데이터가 없습니다. 원본: ${sample}`);
    }

    // 청크별 base64를 각각 디코드해 PCM 바이트를 이어 붙인다(base64 경계 깨짐 방지).
    const pcm = Buffer.concat(audioParts.map((p) => Buffer.from(p, "base64")));
    // pcm16이면 WAV로 래핑, 그 외(이미 컨테이너 포함) 형식은 그대로 둔다.
    if (fmt === "pcm16" || fmt === "pcm" || fmt === "wav") {
        const wav = pcm16ToWav(pcm);
        return {
            dataUrl: `data:audio/wav;base64,${wav.toString("base64")}`,
            transcript,
            costUsd,
            genMs: Date.now() - start,
        };
    }
    return {
        dataUrl: `data:audio/${fmt};base64,${pcm.toString("base64")}`,
        transcript,
        costUsd,
        genMs: Date.now() - start,
    };
}

export interface VideoJob {
    jobId: string;
    status: string;
}

/** 동영상 생성 시작 — POST /videos. 잡 id와 상태를 돌려준다(비동기). */
export async function submitVideo(opts: {
    model: string;
    prompt: string;
    resolution?: string;
    aspectRatio?: string;
}): Promise<VideoJob> {
    const body: Record<string, unknown> = { model: opts.model, prompt: opts.prompt };
    if (opts.resolution) body.resolution = opts.resolution;
    if (opts.aspectRatio) body.aspect_ratio = opts.aspectRatio;
    const res = await fetch(`${BASE}/videos`, {
        method: "POST",
        headers: authHeaders(),
        cache: "no-store",
        body: JSON.stringify(body),
    });
    const data = (await res.json()) as { id?: string; status?: string };
    if (!res.ok) throw new Error(orError(data, res.status));
    if (!data.id) throw new Error("동영상 작업 id를 받지 못했습니다.");
    return { jobId: data.id, status: data.status ?? "pending" };
}

export interface VideoStatus {
    status: string;
    urls: string[];
    costUsd: number;
}

/** 동영상 잡 상태 폴링 — GET /videos/{id}. 완료 시 unsigned_urls와 비용을 돌려준다. */
export async function pollVideo(jobId: string): Promise<VideoStatus> {
    const res = await fetch(`${BASE}/videos/${jobId}`, {
        headers: authHeaders(false),
        cache: "no-store",
    });
    const data = (await res.json()) as {
        status?: string;
        unsigned_urls?: string[];
        error?: { message?: string };
    };
    if (!res.ok) throw new Error(orError(data, res.status));
    return {
        status: data.status ?? "pending",
        urls: data.unsigned_urls ?? [],
        costUsd: readCost(data),
    };
}

/** 동영상 콘텐츠 바이트를 가져온다(인증 필요 — 프록시 라우트가 사용). */
export async function fetchVideoContent(
    jobId: string,
    index = 0,
): Promise<{ buffer: Buffer; contentType: string }> {
    const res = await fetch(`${BASE}/videos/${jobId}/content?index=${index}`, {
        headers: authHeaders(false),
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`동영상 콘텐츠 조회 실패 (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "video/mp4";
    return { buffer, contentType };
}

/**
 * AI 오디오 생성 API 라우트 — 프롬프트를 받아 순수 Node로 합성한 WAV를 base64 data URL로 반환한다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// 프롬프트 문자코드 합을 기반으로 WAV PCM 버퍼를 합성하여 반환한다.
function synthWav(prompt: string): Buffer {
    const sampleRate = 22050;
    const durationSec = 3;
    const numSamples = sampleRate * durationSec;
    const bitsPerSample = 16;
    const numChannels = 1;
    const blockAlign = numChannels * (bitsPerSample / 8); // 2
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const buf = Buffer.alloc(totalSize);

    // RIFF 청크
    buf.write("RIFF", 0, "ascii");
    buf.writeUInt32LE(totalSize - 8, 4);
    buf.write("WAVE", 8, "ascii");

    // fmt 청크
    buf.write("fmt ", 12, "ascii");
    buf.writeUInt32LE(16, 16);          // PCM 서브청크 크기
    buf.writeUInt16LE(1, 20);           // AudioFormat = PCM
    buf.writeUInt16LE(numChannels, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(byteRate, 28);
    buf.writeUInt16LE(blockAlign, 32);
    buf.writeUInt16LE(bitsPerSample, 34);

    // data 청크 헤더
    buf.write("data", 36, "ascii");
    buf.writeUInt32LE(dataSize, 40);

    // 프롬프트 해시로 기본 주파수 결정 (220~660 Hz)
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
        hash = (hash + prompt.charCodeAt(i)) & 0xffff;
    }
    const baseFreq = 220 + (hash % 441); // 220~660

    // 음 배열 비율과 지속 시간
    const ratios = [1, 1.25, 1.5, 2];
    const noteDurSamples = Math.floor(sampleRate * 0.4); // 약 0.4초
    const attackSamples = Math.floor(sampleRate * 0.02); // 20ms attack
    const decaySamples = Math.floor(sampleRate * 0.02);  // 20ms decay
    const amplitude = 0.3 * 32767;

    let offset = headerSize;
    for (let i = 0; i < numSamples; i++) {
        const noteIndex = Math.floor(i / noteDurSamples) % ratios.length;
        const freq = baseFreq * ratios[noteIndex];
        const posInNote = i % noteDurSamples;

        // attack/decay 엔벌로프
        let env = 1.0;
        if (posInNote < attackSamples) {
            env = posInNote / attackSamples;
        } else if (posInNote > noteDurSamples - decaySamples) {
            env = (noteDurSamples - posInNote) / decaySamples;
        }

        const sample = Math.round(amplitude * env * Math.sin(2 * Math.PI * freq * i / sampleRate));
        buf.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), offset);
        offset += 2;
    }

    return buf;
}

// POST /api/generate/audio — 오디오 합성 요청을 처리하고 base64 WAV data URL을 반환한다.
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const prompt: unknown = body?.prompt;
        if (typeof prompt !== "string" || !prompt.trim()) {
            return NextResponse.json({ error: "프롬프트를 입력해 주세요." }, { status: 400 });
        }
        const start = Date.now();
        const buf = synthWav(prompt.trim());
        const url = `data:audio/wav;base64,${buf.toString("base64")}`;
        return NextResponse.json({ url, genMs: Date.now() - start });
    } catch (e) {
        const message = e instanceof Error ? e.message : "오디오 생성에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

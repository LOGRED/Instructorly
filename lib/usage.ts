/**
 * AI 스튜디오 사용량 기록 데이터 계층 — usage_log 테이블에 한 건의 생성을 적고,
 * 사용자별 집계/최근 기록/전체 기록을 읽는다. 결과물(output)은 이미지·오디오의 경우
 * data URL이라 용량이 커서, 목록·집계 조회에서는 빼고 has_output 플래그만 내려 가볍게
 * 유지한다. 실제 결과물 본문은 getUsageRecord(id) 단건 조회로만 가져온다.
 * (테이블 스키마는 lib/db.ts createDb에 정의) 서버 전용.
 */
import { db } from "./db";
import { creditsToKrw } from "./credits";
import type {
    StudioCategory,
    UsageRecord,
    UsageReport,
    UsageSummary,
} from "./types";

/** 결과물(output)을 제외한 가벼운 목록/집계용 조회 컬럼 + has_output 플래그. */
const LIST_COLUMNS = `
    id, user_id, user_name, category, model, model_label, prompt,
    cost_usd, krw_per_usd, credits, gen_ms, ok, created_at, kind,
    CASE WHEN output IS NOT NULL AND output <> '' THEN 1 ELSE 0 END AS has_output
`;

/** 목록/집계 조회 행(결과물 본문 없음, has_output 플래그만). */
interface UsageListRow {
    id: string;
    user_id: string;
    user_name: string;
    category: string;
    model: string;
    model_label: string;
    prompt: string;
    cost_usd: number;
    krw_per_usd: number;
    credits: number;
    gen_ms: number;
    ok: number;
    created_at: number;
    kind: string;
    has_output: number;
}

/** 단건 상세 조회 행(결과물 본문 output 포함). */
interface UsageFullRow extends Omit<UsageListRow, "has_output"> {
    output: string | null;
}

/** 목록 행을 UsageRecord(결과물 본문 없음)로 변환한다. */
function rowToRecord(r: UsageListRow): UsageRecord {
    return {
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        category: r.category as StudioCategory,
        model: r.model,
        modelLabel: r.model_label,
        prompt: r.prompt,
        costUsd: r.cost_usd,
        krwPerUsd: r.krw_per_usd,
        credits: r.credits,
        genMs: r.gen_ms,
        ok: !!r.ok,
        createdAt: r.created_at,
        kind: (r.kind as StudioCategory) || "",
        hasOutput: !!r.has_output,
    };
}

/** 상세 행을 결과물 본문(output)까지 채운 UsageRecord로 변환한다. */
function rowToRecordFull(r: UsageFullRow): UsageRecord {
    const output = r.output ?? null;
    return {
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        category: r.category as StudioCategory,
        model: r.model,
        modelLabel: r.model_label,
        prompt: r.prompt,
        costUsd: r.cost_usd,
        krwPerUsd: r.krw_per_usd,
        credits: r.credits,
        genMs: r.gen_ms,
        ok: !!r.ok,
        createdAt: r.created_at,
        kind: (r.kind as StudioCategory) || "",
        hasOutput: !!output,
        output,
    };
}

/** 한 번의 생성 사용 기록을 저장하고 저장된 레코드를 반환한다. */
export function recordUsage(input: {
    userId: string;
    userName: string;
    category: StudioCategory;
    model: string;
    modelLabel: string;
    prompt: string;
    costUsd: number;
    krwPerUsd: number;
    credits: number;
    genMs: number;
    ok?: boolean;
    /** 결과물 본문/URL(텍스트 본문, 이미지·오디오 data URL, 동영상 프록시 URL). */
    output?: string | null;
    /** 결과물 종류(미디어 종류). 미지정이면 category를 따른다. */
    kind?: StudioCategory | "";
}): UsageRecord {
    const id = crypto.randomUUID();
    const row = {
        id,
        user_id: input.userId || "",
        user_name: input.userName || "익명",
        category: input.category,
        model: input.model,
        model_label: input.modelLabel,
        prompt: input.prompt.slice(0, 500),
        cost_usd: input.costUsd,
        krw_per_usd: input.krwPerUsd,
        credits: input.credits,
        gen_ms: input.genMs,
        ok: input.ok === false ? 0 : 1,
        created_at: Date.now(),
        output: input.output ?? "",
        kind: input.kind ?? input.category,
    };
    db.prepare(
        `INSERT INTO usage_log
           (id, user_id, user_name, category, model, model_label, prompt,
            cost_usd, krw_per_usd, credits, gen_ms, ok, created_at, output, kind)
         VALUES
           (@id, @user_id, @user_name, @category, @model, @model_label, @prompt,
            @cost_usd, @krw_per_usd, @credits, @gen_ms, @ok, @created_at, @output, @kind)`,
    ).run(row);
    return getUsageRecord(id)!;
}

/** 단일 사용 기록을 결과물 본문까지 포함해 조회한다. 없으면 null. */
export function getUsageRecord(id: string): UsageRecord | null {
    const row = db
        .prepare("SELECT * FROM usage_log WHERE id = ?")
        .get(id) as UsageFullRow | undefined;
    return row ? rowToRecordFull(row) : null;
}

/** 한 사용자의 최근 사용 기록을 최신순으로 가져온다(결과물 본문 제외). */
export function listUserUsage(userId: string, limit = 500): UsageRecord[] {
    const rows = db
        .prepare(
            `SELECT ${LIST_COLUMNS} FROM usage_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .all(userId, limit) as UsageListRow[];
    return rows.map(rowToRecord);
}

/** 전체 최근 사용 기록을 최신순으로 가져온다(결과물 본문 제외). */
export function recentUsage(limit = 50): UsageRecord[] {
    const rows = db
        .prepare(`SELECT ${LIST_COLUMNS} FROM usage_log ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as UsageListRow[];
    return rows.map(rowToRecord);
}

/** 빈 카테고리별 집계 버킷을 만든다. */
function emptyByCategory(): UsageSummary["byCategory"] {
    return {
        text: { credits: 0, count: 0 },
        image: { credits: 0, count: 0 },
        video: { credits: 0, count: 0 },
        audio: { credits: 0, count: 0 },
    };
}

/** 전체 사용량 리포트(사용자별 집계 + 최근 기록 + 전체 기록 + 총계)를 만든다.
 *  records에는 결과물 본문을 뺀 전체 기록(최신순)을 담아, 클라이언트가 날짜 필터·
 *  차트 집계를 직접 계산할 수 있게 한다. */
export function usageReport(limit = 2000): UsageReport {
    const rows = db
        .prepare(`SELECT ${LIST_COLUMNS} FROM usage_log ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as UsageListRow[];

    const byUser = new Map<string, UsageSummary>();
    const totals = { credits: 0, krw: 0, usd: 0, count: 0 };

    for (const r of rows) {
        const key = r.user_id || r.user_name || "익명";
        let s = byUser.get(key);
        if (!s) {
            s = {
                userId: r.user_id,
                userName: r.user_name || "익명",
                totalCredits: 0,
                totalKrw: 0,
                totalUsd: 0,
                count: 0,
                byCategory: emptyByCategory(),
                lastAt: 0,
            };
            byUser.set(key, s);
        }
        s.totalCredits += r.credits;
        s.totalKrw += creditsToKrw(r.credits);
        s.totalUsd += r.cost_usd;
        s.count += 1;
        const cat = (r.category as StudioCategory) ?? "text";
        if (s.byCategory[cat]) {
            s.byCategory[cat].credits += r.credits;
            s.byCategory[cat].count += 1;
        }
        if (r.created_at > s.lastAt) s.lastAt = r.created_at;

        totals.credits += r.credits;
        totals.usd += r.cost_usd;
        totals.count += 1;
    }
    totals.krw = creditsToKrw(totals.credits);

    const summaries = [...byUser.values()].sort(
        (a, b) => b.totalCredits - a.totalCredits,
    );
    const records = rows.map(rowToRecord);
    return { summaries, recent: records.slice(0, 50), records, totals };
}

/**
 * 링크 미리보기(Open Graph 메타) 추출 API — 북마크 블럭이 URL을 카드로 꾸밀 때 호출한다.
 * 서버에서 대상 페이지 HTML을 받아 og:title·og:description·og:image·favicon·site_name을
 * 정규식으로 긁어 돌려준다. 외부 라이브러리 없이 가볍게 처리하고, 실패해도 URL/호스트만으로
 * 최소한의 카드를 그릴 수 있게 폴백 값을 채워 응답한다.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/** HTML에서 주어진 og/name 메타 태그의 content 값을 찾는다(없으면 빈 문자열). */
function metaContent(html: string, key: string): string {
    // property="og:xxx" 또는 name="xxx" — content가 앞/뒤 어디 와도 잡는다.
    const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) return decodeEntities(m[1].trim());
    }
    return "";
}

/** <title>…</title> 텍스트를 찾는다(og:title 폴백용). */
function titleTag(html: string): string {
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return m?.[1] ? decodeEntities(m[1].trim()) : "";
}

/** <link rel="icon" …> href를 찾는다(파비콘). 없으면 빈 문자열. */
function faviconHref(html: string): string {
    const m = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)
        ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["']/i);
    return m?.[1] ? m[1].trim() : "";
}

/** 자주 쓰는 HTML 엔티티만 가볍게 디코드한다(메타 텍스트용). */
function decodeEntities(s: string): string {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&nbsp;/g, " ");
}

/** 상대 경로 URL을 페이지 기준 절대 URL로 바꾼다(이미지/파비콘용). 실패하면 원본 반환. */
function absolutize(href: string, base: string): string {
    if (!href) return "";
    try {
        return new URL(href, base).toString();
    } catch {
        return href;
    }
}

/** URL의 Open Graph 메타를 긁어 북마크 카드용 필드로 돌려준다. */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const raw: unknown = body?.url;
        if (typeof raw !== "string" || !raw.trim()) {
            return NextResponse.json({ error: "URL을 입력해 주세요." }, { status: 400 });
        }
        // 스킴이 없으면 https://를 붙여 준다.
        const url = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return NextResponse.json({ error: "올바른 URL이 아니에요." }, { status: 400 });
        }

        const host = parsed.hostname.replace(/^www\./, "");
        // 외부 요청 — 일부 사이트는 UA 없으면 막으므로 브라우저 UA를 흉내 낸다. 6초 타임아웃.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        let html = "";
        try {
            const res = await fetch(url, {
                headers: {
                    "user-agent":
                        "Mozilla/5.0 (compatible; InstructorlyBot/1.0; +https://instructorly.app)",
                    accept: "text/html,application/xhtml+xml",
                },
                signal: controller.signal,
                redirect: "follow",
            });
            if (res.ok) {
                const ct = res.headers.get("content-type") ?? "";
                if (ct.includes("text/html") || ct === "") {
                    // 메타는 <head>에 있으니 앞부분만 읽어 과대 응답을 막는다(최대 ~512KB).
                    html = (await res.text()).slice(0, 512_000);
                }
            }
        } finally {
            clearTimeout(timer);
        }

        const ogImage = metaContent(html, "og:image") || metaContent(html, "twitter:image");
        const favicon = faviconHref(html);

        const result = {
            url,
            title: metaContent(html, "og:title") || titleTag(html) || host,
            description:
                metaContent(html, "og:description") || metaContent(html, "description") || "",
            image: ogImage ? absolutize(ogImage, url) : null,
            favicon: favicon
                ? absolutize(favicon, url)
                : `${parsed.protocol}//${parsed.host}/favicon.ico`,
            siteName: metaContent(html, "og:site_name") || host,
        };
        return NextResponse.json(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : "링크 정보를 가져오지 못했어요.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

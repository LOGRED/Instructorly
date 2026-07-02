/**
 * 설명서 '단계별' 화면 사진(FHD)을 흐름이 있는 섹션마다 한 단계씩 찍는다.
 * public/guide/shots/steps/{role}-{섹션}-s{N}.png 로 저장 → '사진으로 따라 하기'(동영상 느낌) 슬라이드에 들어간다.
 * AI 결과물은 만들지 않는다(과금 X). 비어 있는 프롬프트 상태 그대로 찍는다.
 * 실행:  node scripts/capture-step-shots.cjs   (개발 서버가 3000에 떠 있어야 함)
 */
const path = require("node:path");
const puppeteer = require(path.join(process.cwd(), "node_modules", "puppeteer"));

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "guide", "shots", "steps");
const VIEWPORT = { width: 1920, height: 1080, deviceScaleFactor: 1 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
require("node:fs").mkdirSync(OUT, { recursive: true });

async function snap(page, name) {
    try {
        await page.screenshot({ path: path.join(OUT, name + ".png") });
        console.log("  ✓", name);
    } catch (e) {
        console.log("  ✗", name, "—", e.message);
    }
}

// 글자가 같은(또는 포함) 버튼/탭/메뉴를 누른다.
async function clickText(page, text, opts = {}) {
    const role = opts.role;
    const nth = opts.nth || 0;
    return page.evaluate(
        (text, role, nth) => {
            const sel = role ? `[role="${role}"]` : 'button, a, [role="tab"], [role="menuitem"]';
            const all = [...document.querySelectorAll(sel)];
            let el = all.filter((e) => e.textContent.trim() === text || e.getAttribute("aria-label") === text)[nth];
            if (!el) el = all.filter((e) => e.textContent.includes(text))[nth];
            if (el) { el.scrollIntoView({ block: "center" }); el.click(); return true; }
            return false;
        },
        text, role, nth,
    );
}

// 글자가 들어간 첫 요소를 화면 위쪽으로 스크롤한다.
async function scrollToText(page, text, offset = 130) {
    await page.evaluate((text, offset) => {
        const el = [...document.querySelectorAll("body *")].find((e) => e.children.length < 6 && (e.textContent || "").includes(text));
        if (el) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset));
    }, text, offset);
    await sleep(450);
}

// 기대 글자 + 골격 사라짐 대기.
async function waitReady(page, text) {
    if (text) await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 15000 }, text).catch(() => {});
    await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 8000 }).catch(() => {});
}

// 열린 다이얼로그/메뉴 닫기.
async function escape(page) {
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(300);
}

async function login(page, id, pw) {
    for (let a = 1; a <= 3; a++) {
        await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
        await page.waitForSelector("#login-id", { timeout: 10000 }).catch(() => {});
        await sleep(300);
        await page.click("#login-id", { clickCount: 3 }).catch(() => {});
        await page.type("#login-id", id, { delay: 15 });
        await page.click("#login-pw", { clickCount: 3 }).catch(() => {});
        await page.type("#login-pw", pw, { delay: 15 });
        await page.evaluate(() => { const el = [...document.querySelectorAll('button:not([role="tab"])')].find((b) => b.textContent.trim() === "로그인"); if (el) el.click(); });
        const ok = await page.waitForFunction(() => {
            try { const r = JSON.parse(localStorage.getItem("maketor-identity") || "{}"); return !!(r.state && r.state.role); } catch { return false; }
        }, { timeout: 12000 }).then(() => true).catch(() => false);
        if (ok) { await sleep(700); return true; }
        console.log("   로그인 재시도", a, id);
    }
    return false;
}

function autoDialogs(page) {
    page.on("dialog", async (d) => { try { await d.accept(); } catch {} });
}

// 회원가입 화면을 역할별(강사/학생)로 단계 촬영한다(로그인 전).
async function captureSignup(browser, role) {
    const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(VIEWPORT);
    const r = role === "instructor" ? "instructor" : "student";
    const card = role === "instructor" ? "강사" : "학생";

    await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
    await sleep(600);
    await snap(page, `${r}-start-s1`); // 로그인 화면(회원가입 탭 보임)

    await clickText(page, "회원가입", { role: "tab" });
    await sleep(600);
    await snap(page, `${r}-start-s2`); // 회원가입 빈 양식

    await page.type("#reg-id", role === "instructor" ? "hong_sam" : "kim_young", { delay: 12 }).catch(() => {});
    await page.type("#reg-pw", "1234", { delay: 12 }).catch(() => {});
    await page.type("#reg-name", role === "instructor" ? "홍길동 강사" : "김영희", { delay: 12 }).catch(() => {});
    await page.evaluate((card) => {
        const b = [...document.querySelectorAll("button")].find((x) => x.textContent.replace(/\s+/g, "").includes(card + "강의를"));
        if (b) b.click();
    }, card);
    await sleep(400);
    await snap(page, `${r}-start-s3`); // 정보 입력 + 역할 선택됨

    await page.evaluate(() => { const b = [...document.querySelectorAll('button:not([role="tab"])')].find((x) => x.textContent.trim() === "회원가입"); if (b) b.focus(); });
    await sleep(300);
    await snap(page, `${r}-start-s4`); // 회원가입 단추

    await ctx.close();
}

// 강사 흐름(로그인 후) 단계 촬영.
async function captureInstructor(browser) {
    const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(VIEWPORT);
    autoDialogs(page);
    await login(page, "hongmun", "1234");
    const HUB = BASE + "/programs/hongmun-ai-2026";

    // ── 2. 새 강좌 만들기 (5)
    await page.goto(BASE + "/programs", { waitUntil: "networkidle2" });
    await waitReady(page, "강좌 목록");
    await clickText(page, "새 강좌 만들기"); await sleep(700);
    await snap(page, "instructor-create-course-s1");
    const t1 = await page.$('[role="dialog"] input'); if (t1) await t1.type("스마트폰으로 사진 잘 찍기", { delay: 13 });
    await sleep(300); await snap(page, "instructor-create-course-s2");
    const d1 = await page.$('[role="dialog"] textarea'); if (d1) await d1.type("스마트폰 카메라로 일상을 예쁘게 담는 방법을 배웁니다.", { delay: 6 });
    await sleep(300); await snap(page, "instructor-create-course-s3");
    await page.evaluate(() => { const dlg = document.querySelector('[role="dialog"]'); if (dlg) { const b = [...dlg.querySelectorAll("button")].find((x) => x.textContent.trim() === "화"); if (b) b.click(); } });
    await sleep(300); await snap(page, "instructor-create-course-s4");
    await page.evaluate(() => { const dlg = document.querySelector('[role="dialog"]'); if (dlg) dlg.scrollTop = dlg.scrollHeight; const mk = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === "만들기"); if (mk) mk.focus(); });
    await sleep(300); await snap(page, "instructor-create-course-s5");
    await escape(page);

    // ── 3. 학생 초대하기 (4)
    await page.goto(HUB, { waitUntil: "networkidle2" }); await waitReady(page, "수강 현황 요약");
    await scrollToText(page, "초대 링크 복사", 150); await snap(page, "instructor-invite-s1");
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); await snap(page, "instructor-invite-s2");
    await clickText(page, "수강생 등록"); await sleep(800); await snap(page, "instructor-invite-s3"); await escape(page);
    await clickText(page, "수강생 명단", { role: "tab" }); await waitReady(page, "내보내기"); await scrollToText(page, "내보내기", 200); await snap(page, "instructor-invite-s4");

    // ── 4. 주차 짜기 (4)
    await page.goto(HUB, { waitUntil: "networkidle2" }); await waitReady(page, "강의 추가");
    await scrollToText(page, "주차 추가", 150); await snap(page, "instructor-weeks-s1");
    await clickText(page, "주차 관리"); await sleep(500); await snap(page, "instructor-weeks-s2"); await escape(page);
    await scrollToText(page, "강의 추가", 150); await snap(page, "instructor-weeks-s3");
    await clickText(page, "1주차 — 생성형 AI", { nth: 0 }); await sleep(500); await snap(page, "instructor-weeks-s4");

    // ── 5. 강의 만들기(블럭 편집기) (5)
    await page.goto(BASE + "/build/hm-w01", { waitUntil: "domcontentloaded" }); await waitReady(page, "페이지 추가"); await sleep(1500);
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); await snap(page, "instructor-builder-s1");
    await scrollToText(page, "블럭 추가", 90); await snap(page, "instructor-builder-s2");
    await scrollToText(page, "강조 박스", 200); await snap(page, "instructor-builder-s3");
    await page.evaluate(() => { const c = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "1/2"); if (c) { c.scrollIntoView({ block: "center" }); c.click(); } });
    await sleep(500); await snap(page, "instructor-builder-s4");
    await clickText(page, "미리보기"); await sleep(900); await snap(page, "instructor-builder-s5");

    // ── 7. AI로 만들기 (4)
    await page.goto(BASE + "/build/hm-w01", { waitUntil: "domcontentloaded" }); await waitReady(page, "페이지 추가"); await sleep(1200);
    await clickText(page, "AI에게 인사해 보기"); await sleep(700);
    await scrollToText(page, "AI 글쓰기", 120); await snap(page, "instructor-ai-content-s1");
    await scrollToText(page, "실행", 260); await snap(page, "instructor-ai-content-s2");
    await page.evaluate(() => { const s = [...document.querySelectorAll("button, [role=combobox]")].find((b) => /모델을 선택|FLUX|모델/.test(b.textContent || "")); if (s) { s.scrollIntoView({ block: "center" }); s.click(); } });
    await sleep(500); await snap(page, "instructor-ai-content-s3"); await escape(page);
    await scrollToText(page, "고정", 200); await snap(page, "instructor-ai-content-s4");

    // ── 11. 창작 실습(아틀리에) (4)
    await page.goto(BASE + "/atelier/hm-atelier-w03", { waitUntil: "networkidle2" }); await waitReady(page, "기본 설정");
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); await snap(page, "instructor-atelier-s1");
    await scrollToText(page, "표지", 130); await snap(page, "instructor-atelier-s2");
    await scrollToText(page, "색 테마", 130); await snap(page, "instructor-atelier-s3");
    await page.evaluate(() => { window.scrollTo(0, 0); const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "PDF"); if (b) b.focus(); }); await sleep(300); await snap(page, "instructor-atelier-s4");

    // ── 10. 시험·연습 만들기 (4)
    await page.goto(HUB, { waitUntil: "networkidle2" }); await waitReady(page, "시험 추가");
    await clickText(page, "시험 추가", { nth: 0 }); await sleep(800); await snap(page, "instructor-drills-s1");
    await scrollToText(page, "어떤 AI 화면", 120); await snap(page, "instructor-drills-s2");
    const dm = await page.$('[role="dialog"] textarea'); if (dm) await dm.type("‘누가·무엇을·어떻게’가 들어간 질문을 하나 만들어 AI에게 물어보세요.", { delay: 5 });
    await sleep(300); await snap(page, "instructor-drills-s3"); await escape(page);
    await page.goto(BASE + "/drill/hm-drill-w03", { waitUntil: "networkidle2" }); await sleep(1500); await snap(page, "instructor-drills-s4");

    await ctx.close();
}

// 학생 흐름(로그인 후) 단계 촬영.
async function captureStudent(browser) {
    const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(VIEWPORT);
    autoDialogs(page);
    await login(page, "gildong", "1234");
    const HUB = BASE + "/programs/hongmun-ai-2026";

    // ── 2. 강좌에 들어가기 (3)
    await page.goto(BASE + "/programs", { waitUntil: "networkidle2" }); await waitReady(page, "내 강좌");
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); await snap(page, "student-join-s1");
    await snap(page, "student-join-s2");
    await scrollToText(page, "초대 코드로 참여", 200).catch(() => {}); await snap(page, "student-join-s3");

    // ── 3. 강의 듣기 (4)
    await page.goto(HUB, { waitUntil: "networkidle2" }); await waitReady(page, "내 수강 현황");
    await scrollToText(page, "학습하기", 200); await snap(page, "student-player-s1");
    await page.goto(BASE + "/learn/hm-w01", { waitUntil: "networkidle2" }); await waitReady(page, "다음"); await sleep(700); await snap(page, "student-player-s2");
    await page.evaluate(() => { const a = [...document.querySelectorAll("nav a, aside a, button")].find((e) => /처음 만나는 생성형 AI/.test(e.textContent || "")); if (a) a.click(); }); await sleep(700); await snap(page, "student-player-s3");
    await clickText(page, "다음"); await sleep(800); await snap(page, "student-player-s4");

    // ── 4. AI 직접 해보기 (3)
    await page.goto(BASE + "/learn/hm-w01", { waitUntil: "networkidle2" }); await waitReady(page, "다음"); await sleep(600);
    await scrollToText(page, "이미지 생성", 120).catch(() => {}); await snap(page, "student-ai-blocks-s1");
    await scrollToText(page, "실행", 260).catch(() => {}); await snap(page, "student-ai-blocks-s2");
    await snap(page, "student-ai-blocks-s3");

    // ── 5. 실시간 자랑방(채팅) (4)
    await page.goto(BASE + "/learn/hm-w01", { waitUntil: "networkidle2" }); await waitReady(page, "다음"); await sleep(700);
    await snap(page, "student-chat-s1");
    await page.evaluate(() => { const i = document.querySelector('textarea[placeholder*="메시지"]'); if (i) i.scrollIntoView({ block: "center" }); }); await sleep(300); await snap(page, "student-chat-s2");
    await clickText(page, "작품 가져오기"); await sleep(800); await snap(page, "student-chat-s3"); await escape(page);
    await snap(page, "student-chat-s4");

    // ── 6. 창작 실습(내 책 만들기) (4)
    await page.goto(BASE + "/atelier/hm-atelier-w03", { waitUntil: "networkidle2" }); await waitReady(page, "기본 설정");
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); await snap(page, "student-atelier-s1");
    await scrollToText(page, "표지", 130); await snap(page, "student-atelier-s2");
    await scrollToText(page, "색 테마", 130); await snap(page, "student-atelier-s3");
    await page.evaluate(() => { window.scrollTo(0, 0); const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "PDF"); if (b) b.focus(); }); await sleep(300); await snap(page, "student-atelier-s4");

    // ── 7. 시험·연습 보기 (3)
    await page.goto(BASE + "/drill/hm-drill-w02", { waitUntil: "networkidle2" }); await sleep(1500);
    await snap(page, "student-drills-s1");
    await page.evaluate(() => { const i = document.querySelector("textarea"); if (i) i.scrollIntoView({ block: "center" }); }); await sleep(300); await snap(page, "student-drills-s2");
    await scrollToText(page, "새 채팅", 150).catch(() => {}); await snap(page, "student-drills-s3");

    // ── 8. 게시물 읽고 댓글 (3)
    await page.goto(BASE + "/posts/hm-post-intro", { waitUntil: "networkidle2" }); await waitReady(page, "댓글");
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); await snap(page, "student-posts-s1");
    await scrollToText(page, "댓글을 입력", 250).catch(() => {}); await snap(page, "student-posts-s2");
    await scrollToText(page, "답글", 250).catch(() => {}); await snap(page, "student-posts-s3");

    await ctx.close();
}

async function main() {
    const browser = await puppeteer.launch({ headless: "new", defaultViewport: VIEWPORT, args: ["--no-sandbox", "--window-size=1920,1080"] });
    console.log("회원가입(강사/학생) 단계 촬영…");
    await captureSignup(browser, "instructor");
    await captureSignup(browser, "student");
    console.log("강사 흐름 단계 촬영…");
    await captureInstructor(browser);
    console.log("학생 흐름 단계 촬영…");
    await captureStudent(browser);
    await browser.close();
    console.log("완료! public/guide/shots/steps/");
}
main().catch((e) => { console.error(e); process.exit(1); });

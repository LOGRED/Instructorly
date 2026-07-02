/**
 * 사용 설명서용 FHD(1920×1080) 스크린샷 자동 촬영 스크립트(수동 실행용).
 *
 * 강사 hongmun / 학생 gildong 으로 각각 로그인해 주요 화면을 찍어
 * public/guide/shots/{role}-{섹션}.png 로 저장한다. 설명서 화면(guide-article)이
 * 이 파일들을 그대로 보여 준다. AI 결과물은 비어 있는 상태(프롬프트만) 그대로 찍는다.
 *
 * 핵심: 화면이 '진짜로' 다 그려질 때까지 기다린다 — 기대하는 글자(waitText)가 나타나고,
 * 로딩 골격(.animate-pulse)이 사라질 때까지. 이렇게 안 하면 빈 골격이 찍힌다.
 *
 * 사전: 개발 서버가 http://localhost:3000 에서 실행 중, 데모 시드(seed-demo-hongmun)가 적용됨.
 * 실행:  node scripts/capture-guide-shots.cjs
 */
const path = require("node:path");
const puppeteer = require(path.join(process.cwd(), "node_modules", "puppeteer"));

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "guide", "shots");
const VIEWPORT = { width: 1920, height: 1080, deviceScaleFactor: 1 };

// 잠깐 멈춘다(애니메이션·렌더 안정화용).
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// 화면의 버튼/링크/탭/메뉴 중 글자가 text 와 같은(또는 포함하는) 것을 눌러 준다.
async function clickText(page, text, opts = {}) {
    const role = opts.role;
    const nth = opts.nth || 0;
    return await page.evaluate(
        (text, role, nth) => {
            const sel = role
                ? `[role="${role}"]`
                : 'button, a, [role="tab"], [role="menuitem"], [role="button"]';
            const all = [...document.querySelectorAll(sel)];
            const exact = all.filter(
                (e) => e.textContent.trim() === text || e.getAttribute("aria-label") === text,
            );
            let el = exact[nth] || all.filter((e) => e.textContent.includes(text))[nth];
            if (el) {
                el.scrollIntoView({ block: "center" });
                el.click();
                return true;
            }
            return false;
        },
        text,
        role,
        nth,
    );
}

// 기대 글자가 나타나고 로딩 골격이 사라질 때까지 기다린다.
async function waitReady(page, waitText) {
    if (waitText) {
        await page
            .waitForFunction(
                (t) => document.body && document.body.innerText.includes(t),
                { timeout: 15000 },
                waitText,
            )
            .catch(() => {});
    }
    await page
        .waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 8000 })
        .catch(() => {});
}

// 한 화면을 찍는다. build=true 면 /build 전용(domcontentloaded + 긴 대기).
async function shot(page, name, url, { action, waitText, afterText, build = false } = {}) {
    try {
        if (url) {
            await page.goto(BASE + url, {
                waitUntil: build ? "domcontentloaded" : "networkidle2",
                timeout: 30000,
            });
        }
        await waitReady(page, waitText);
        await sleep(build ? 1800 : 700);
        if (action) {
            await action(page);
            if (afterText) await waitReady(page, afterText);
            await sleep(800);
        }
        await page.screenshot({ path: path.join(OUT, name + ".png") });
        console.log("  ✓", name);
    } catch (e) {
        console.log("  ✗", name, "—", e.message);
    }
}

// 아이디/비밀번호로 로그인한다. 실제 키 입력(page.type)으로 React 입력칸을 채우고,
// localStorage 에 신원이 저장됐는지 확인한 뒤에야 다음으로 넘어간다(안 되면 재시도).
async function login(page, id, pw) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        await page.goto(BASE + "/login", { waitUntil: "networkidle2" });
        await page.waitForSelector("#login-id", { timeout: 10000 }).catch(() => {});
        await sleep(300);
        // 기존 값 비우고 진짜 타이핑(키 입력 → React onChange 가 정확히 반영됨).
        await page.click("#login-id", { clickCount: 3 }).catch(() => {});
        await page.type("#login-id", id, { delay: 15 });
        await page.click("#login-pw", { clickCount: 3 }).catch(() => {});
        await page.type("#login-pw", pw, { delay: 15 });
        // '로그인'은 탭에도 있고 제출 버튼에도 있다. 탭(role=tab)이 아닌 '제출 버튼'만 콕 집어 누른다.
        await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button:not([role="tab"])')];
            const el = btns.find(
                (b) => b.textContent.trim() === "로그인" || b.textContent.trim() === "로그인 중…",
            );
            if (el) el.click();
        });
        // localStorage("maketor-identity") 에 역할이 들어왔는지(=로그인 성공) 확인.
        const ok = await page
            .waitForFunction(
                () => {
                    try {
                        const r = JSON.parse(localStorage.getItem("maketor-identity") || "{}");
                        return !!(r.state && r.state.role);
                    } catch {
                        return false;
                    }
                },
                { timeout: 12000 },
            )
            .then(() => true)
            .catch(() => false);
        if (ok) {
            await page
                .waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 8000 })
                .catch(() => {});
            await sleep(700);
            return true;
        }
        console.log("   로그인 재시도", attempt, "—", id);
    }
    console.log("   ✗ 로그인 실패:", id);
    return false;
}

// 어떤 확인창이 떠도 자동으로 '확인'을 눌러 이동이 막히지 않게 한다(저장 안 한 변경 경고 포함).
function autoAcceptDialogs(page) {
    page.on("dialog", async (d) => {
        try {
            await d.accept();
        } catch {}
    });
}

// 강사(hongmun) 화면들을 찍는다.
async function captureInstructor(browser) {
    const ctx = browser.createBrowserContext
        ? await browser.createBrowserContext()
        : await browser.createIncognitoBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(VIEWPORT);
    autoAcceptDialogs(page);

    // 1) 가입 화면(역할 선택) — 로그인 전
    await shot(page, "instructor-start", "/login", {
        action: async (p) => {
            await clickText(p, "회원가입", { role: "tab" });
        },
        afterText: "어떤 분이신가요",
    });

    await login(page, "hongmun", "1234");

    // 2) 내 강좌 목록 + 새 강좌 만들기
    await shot(page, "instructor-create-course", "/programs", { waitText: "강좌 목록" });
    // 3) 새 강좌 만들기 대화상자(입력 항목)
    await shot(page, "instructor-create-course-2", "/programs", {
        waitText: "강좌 목록",
        action: async (p) => {
            await clickText(p, "새 강좌 만들기");
            await sleep(600);
            // 대화상자의 '제목'(input)·'설명'(textarea)에 진짜 키 입력으로 예시를 채운다.
            const titleInput = await p.$('[role="dialog"] input');
            if (titleInput) await titleInput.type("스마트폰으로 사진 잘 찍기", { delay: 10 });
            const descBox = await p.$('[role="dialog"] textarea');
            if (descBox) await descBox.type("스마트폰 카메라로 일상을 예쁘게 담는 방법을 배웁니다.", { delay: 5 });
        },
        afterText: "수업 요일",
    });

    // 4) 강좌 허브(초대 링크 복사 · 수강 현황 요약 · 주차/추가 단추)
    await shot(page, "instructor-invite", "/programs/hongmun-ai-2026", { waitText: "수강 현황 요약" });
    // 5) 주차 짜기 — 주차 관리(⋯) 메뉴(이름 변경) 펼친 모습 + 종류별 추가 단추
    await shot(page, "instructor-weeks", "/programs/hongmun-ai-2026", {
        waitText: "강의 추가",
        action: async (p) => {
            await clickText(p, "주차 관리");
        },
        afterText: "이름 변경",
    });
    // 6) 진도 — 강의별 수강생 진도(첫 강의 '수강생')
    await shot(page, "instructor-progress", "/programs/hongmun-ai-2026", {
        waitText: "수강 현황 요약",
        action: async (p) => {
            await clickText(p, "수강생", { nth: 0 });
            await sleep(1200);
        },
    });
    // 7) 수강생 명단(내보내기)
    await shot(page, "instructor-roster", "/programs/hongmun-ai-2026", {
        waitText: "수강 현황 요약",
        action: async (p) => {
            await clickText(p, "수강생 명단", { role: "tab" });
        },
        afterText: "내보내기",
    });
    // 8) 시험/연습 만들기 대화상자(AI 종류·미션)
    await shot(page, "instructor-drills", "/programs/hongmun-ai-2026", {
        waitText: "강의 추가",
        action: async (p) => {
            await clickText(p, "시험 추가", { nth: 0 });
            await sleep(800);
        },
    });

    // 12) 창작 실습(아틀리에) 시범본 편집기
    await shot(page, "instructor-atelier", "/atelier/hm-atelier-w03", { waitText: "기본 설정" });
    // 13) AI 스튜디오 · 사용량
    await shot(page, "instructor-studio", "/studio", { waitText: "스튜디오" });
    // 14) 보기 설정 · 내 정보 — '설정' 탭
    await shot(page, "instructor-settings", "/settings", {
        waitText: "설정",
        action: async (p) => {
            await clickText(p, "설정", { role: "tab" });
        },
        afterText: "글자 크기",
    });

    // 9~11) 강의 만들기(블럭 편집기) 계열 — 맨 마지막(빌더의 '저장 안 함' 경고 영향 차단)
    await shot(page, "instructor-builder", "/build/hm-w01", { build: true, waitText: "페이지 추가" });
    await shot(page, "instructor-ai-content", "/build/hm-w01", {
        build: true,
        waitText: "페이지 추가",
        action: async (p) => {
            await clickText(p, "AI에게 인사해 보기");
        },
        afterText: "실행",
    });
    await shot(page, "instructor-blocks", "/build/hm-w01", {
        build: true,
        waitText: "블럭 추가",
        action: async (p) => {
            await clickText(p, "AI", { role: "tab" });
        },
    });

    await ctx.close();
}

// 학생(gildong) 화면들을 찍는다.
async function captureStudent(browser) {
    const ctx = browser.createBrowserContext
        ? await browser.createBrowserContext()
        : await browser.createIncognitoBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(VIEWPORT);
    autoAcceptDialogs(page);

    await login(page, "gildong", "1234");

    // 1) 내 강좌(초대 코드로 참여)
    await shot(page, "student-join", "/programs", { waitText: "내 강좌" });
    // 2) 강의 듣기(페이지 넘김 바 · 목차)
    await shot(page, "student-player", "/learn/hm-w01", { waitText: "다음" });
    // 3) AI 직접 해보기 — 2페이지 AI 글쓰기(실행)
    await shot(page, "student-ai-blocks", "/learn/hm-w01", {
        waitText: "다음",
        action: async (p) => {
            await clickText(p, "다음");
            await sleep(700);
        },
        afterText: "실행",
    });
    // 4) 선생님과 대화(실시간 자랑방) — 채팅 패널 열기
    await shot(page, "student-chat", "/learn/hm-w01", {
        waitText: "다음",
        action: async (p) => {
            await clickText(p, "채팅 보이기");
            await sleep(300);
            await clickText(p, "채팅 열기");
            await sleep(300);
        },
    });
    // 5) 창작 실습(내 책 만들기) — 강사 예시 버튼
    await shot(page, "student-atelier", "/atelier/hm-atelier-w03", { waitText: "기본 설정" });
    // 6) 시험·연습 보기 — ChatGPT 화면(새 채팅·보내기)
    await shot(page, "student-drills", "/drill/hm-drill-w02", { waitText: "ChatGPT" });
    // 7) 게시물 읽고 댓글 달기(비밀 댓글·답글·삭제)
    await shot(page, "student-posts", "/posts/hm-post-intro", { waitText: "댓글" });
    // 8) 내 작품 · 사용량
    await shot(page, "student-studio", "/studio", { waitText: "스튜디오" });
    // 9) 내 진도(내 수강 현황)
    await shot(page, "student-progress", "/programs/hongmun-ai-2026", { waitText: "내 수강 현황" });
    // 10) 보기 설정 · 내 정보 — '설정' 탭
    await shot(page, "student-settings", "/settings", {
        waitText: "설정",
        action: async (p) => {
            await clickText(p, "설정", { role: "tab" });
        },
        afterText: "글자 크기",
    });

    await ctx.close();
}

// 전체 촬영을 수행한다.
async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: VIEWPORT,
        args: ["--no-sandbox", "--window-size=1920,1080"],
    });
    console.log("강사(hongmun) 화면 촬영…");
    await captureInstructor(browser);
    console.log("학생(gildong) 화면 촬영…");
    await captureStudent(browser);
    await browser.close();
    console.log("완료! public/guide/shots/ 에 저장되었습니다.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

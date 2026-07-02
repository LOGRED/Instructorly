/**
 * 사용 설명 동영상 녹화용 데모 시드(수동 실행용).
 *
 * 강사 "홍문" 1명 + 학생 "홍길동"(+ 고전소설 인물 4명)으로 4주차 강좌
 * "처음 만나는 생성형 AI — 4주 완성"을 data/maketor.db 에 직접 넣는다.
 *
 * 핵심 규칙(요청 사항):
 *   - AI 블럭(이미지·LLM·동영상)은 **프롬프트만** 채우고 결과물은 비운다.
 *     → 화면에서 [실행]을 누르면 그 자리에서 진짜 생성된다(과금은 녹화자가 직접).
 *   - 기존 데모 데이터(정현주·박성현 등)는 건드리지 않고 **추가**만 한다(비파괴).
 *   - 학생 홍길동은 진도·채팅·작성 중인 프롬프트를 살짝 채워 '수강 중'인 느낌을 준다.
 *
 * 같은 id 를 upsert 하므로 여러 번 돌려도 안전하다(멱등).
 * 실행:  node scripts/seed-demo-hongmun.cjs
 */
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require(path.join(process.cwd(), "node_modules", "better-sqlite3"));

const DB_PATH = path.join(process.cwd(), "data", "maketor.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// ---------- 시간 헬퍼 ----------
// 강좌 시작(2026-06-16 화) 기준으로 주차별 타임스탬프를 만든다. 오늘(2026-06-30)이
// 3주차 즈음이 되도록 잡아 '진행 중'인 강좌처럼 보이게 한다.
const COURSE_START = new Date("2026-06-16T10:00:00+09:00").getTime();
const WEEK = 7 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
// n주차(1-base)의 수업 시각을 반환한다.
function weekTime(n) {
    return COURSE_START + (n - 1) * WEEK;
}
// 짧은 유일 id를 만든다(아틀리에 페이지·블럭처럼 내부용 id에 쓴다).
function uid() {
    return crypto.randomUUID().slice(0, 8);
}

// ---------- 블럭 헬퍼 ----------
// 일반 블럭 팩토리. id 는 호출부에서 강의별로 유일하게 준다.
function H(id, level, text) {
    return { id, type: "heading", level, text };
}
function T(id, markdown) {
    return { id, type: "text", markdown };
}
function C(id, emoji, text) {
    return { id, type: "callout", emoji, text };
}
function Q(id, text) {
    return { id, type: "quote", text };
}
function TBL(id, headers, rows) {
    return { id, type: "table", headers, rows };
}
// AI 이미지 블럭(생성 모드) — 프롬프트만 채우고 결과는 비운다(녹화자가 직접 생성).
// 모델은 일부러 지정하지 않아 런타임 기본 모델이 쓰이게 한다.
function IMG(id, prompt, seed) {
    return { id, type: "image", mode: "gen", prompt, imageUrl: null, seed: seed ?? 42, genMs: null, locked: false };
}
// AI 글쓰기(LLM) 블럭 — 프롬프트만 채우고 출력은 비운다(녹화자가 직접 생성).
function LLM(id, prompt) {
    return { id, type: "llm", prompt, output: null, genMs: null, locked: false };
}
// AI 동영상 블럭(생성 모드) — 프롬프트만 채우고 url 은 비운다(녹화자가 직접 생성).
function VID(id, prompt, caption) {
    return { id, type: "video", mode: "gen", prompt, url: "", caption: caption ?? "", genMs: null, locked: false };
}

// ---------- 계정 ----------
// 강사 홍문 + 학생 5명(홍길동이 녹화용 주인공, 나머지는 명단·댓글·채팅을 살리는 조연).
const PROGRAM_ID = "hongmun-ai-2026";
const INSTRUCTOR = { id: "hongmun", password: "1234", name: "홍문", role: "instructor", avatar: "fox" };
const STUDENTS = [
    { id: "gildong", name: "홍길동", avatar: "panda" },
    { id: "chunhyang", name: "성춘향", avatar: "rose" },
    { id: "mongryong", name: "이몽룡", avatar: "bear" },
    { id: "simcheong", name: "심청", avatar: "lotus" },
    { id: "heungbu", name: "흥부", avatar: "frog" },
];

// 계정을 넣는다(있으면 덮어씀). 비밀번호는 프로토타입용 평문.
function seedUsers() {
    const stmt = db.prepare(
        "INSERT INTO users (id, password, name, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT(id) DO UPDATE SET password=excluded.password, name=excluded.name, role=excluded.role, avatar=excluded.avatar",
    );
    const base = COURSE_START - 5 * DAY;
    stmt.run(INSTRUCTOR.id, INSTRUCTOR.password, INSTRUCTOR.name, INSTRUCTOR.role, INSTRUCTOR.avatar, base);
    STUDENTS.forEach((s, i) => {
        stmt.run(s.id, "1234", s.name, "student", s.avatar, base + i * HOUR);
    });
    console.log(`  계정: 강사 1(${INSTRUCTOR.name}) + 학생 ${STUDENTS.length}명(주인공 ${STUDENTS[0].name})`);
}

// ---------- 강의(주차별 1개) ----------
// 4개 강의(course)를 만들어 upsert 하고, 강의 id 배열을 돌려준다.
function buildLessons() {
    const lessons = [];

    // 1주차 ── 생성형 AI 첫 만남
    lessons.push({
        id: "hm-w01",
        title: "1주차 · 생성형 AI, 처음 만나요",
        description: "어렵지 않아요. 오늘은 AI가 무엇인지 천천히 알아봅니다.",
        pages: [
            {
                id: "p1",
                title: "환영합니다",
                blocks: [
                    H("w01-1", 1, "처음 만나는 생성형 AI"),
                    T("w01-2", "안녕하세요. 4주 동안 함께할 **홍문 강사**입니다. 😊\n\n이 수업은 **스마트폰 하나로 AI와 친구가 되는** 수업이에요. 글씨가 작으면 오른쪽 위 **글자 크기** 버튼을 눌러 크게 키우세요."),
                    C("w01-3", "💡", "오늘은 아무것도 외우지 않아도 됩니다. 아래 [실행] 버튼만 한번 눌러 보세요. 진짜로 그림과 글이 만들어집니다!"),
                    IMG("w01-4", "따뜻한 햇살이 들어오는 아늑한 교실, 사람들이 환하게 웃으며 스마트폰을 보는 모습, 친근한 수채화풍", 101),
                ],
            },
            {
                id: "p2",
                title: "AI에게 인사해 보기",
                blocks: [
                    H("w01-5", 2, "AI는 똑똑한 비서예요"),
                    T("w01-6", "AI는 우리가 묻는 말에 **대답해 주는 컴퓨터 비서**예요. 아래 칸에 인사를 적고 **실행**을 눌러 보세요."),
                    LLM("w01-7", "안녕하세요! 저는 AI가 처음입니다. 친구처럼 따뜻하게 인사해 주시고, 무엇을 도와줄 수 있는지 세 가지만 쉽게 알려주세요."),
                    C("w01-8", "✅", "말을 걸면 대답이 옵니다. 이게 전부예요. 다음 주에 또 만나요!"),
                ],
            },
        ],
    });

    // 2주차 ── 질문 잘하는 법(프롬프트)
    lessons.push({
        id: "hm-w02",
        title: "2주차 · 질문 잘하는 법 (프롬프트)",
        description: "똑같은 AI도 어떻게 묻느냐에 따라 대답이 달라져요.",
        pages: [
            {
                id: "p1",
                title: "좋은 질문의 비밀",
                blocks: [
                    H("w02-1", 1, "구체적으로 물으면 똑똑하게 답해요"),
                    T("w02-2", "AI에게 묻는 말을 **프롬프트**라고 해요. 어렵지 않아요. 그냥 **자세히** 부탁하면 됩니다."),
                    TBL("w02-3", ["이렇게 말고", "이렇게 하세요"], [
                        ["편지 써줘", "환갑 맞은 친구에게 보낼 따뜻한 축하 편지를 5줄로 써줘"],
                        ["운동 알려줘", "무릎이 안 좋은 70대가 집에서 할 수 있는 가벼운 운동 3가지를 알려줘"],
                    ]),
                    C("w02-4", "🔑", "비법: ‘누가 · 무엇을 · 어떻게(몇 개·몇 줄)’를 넣으면 답이 좋아져요."),
                ],
            },
            {
                id: "p2",
                title: "직접 느껴 보기",
                blocks: [
                    H("w02-5", 2, "자세히 물어볼수록 친절해져요"),
                    T("w02-6", "아래 프롬프트를 그대로 **실행**해 보고, 칸의 내용을 내 상황에 맞게 바꿔서 또 실행해 보세요."),
                    LLM("w02-7", "70대 어르신이 집에서 무릎에 무리 없이 할 수 있는 가벼운 운동 3가지를, 각 동작의 방법과 주의사항을 곁들여 아주 쉽게 알려줘."),
                ],
            },
        ],
    });

    // 3주차 ── AI로 만들기(그림·영상·글)
    lessons.push({
        id: "hm-w03",
        title: "3주차 · AI로 만들기 (그림·영상·글)",
        description: "말로 설명하면 AI가 그림과 영상, 글을 만들어 줍니다.",
        pages: [
            {
                id: "p1",
                title: "그림을 말로 그려요",
                blocks: [
                    H("w03-1", 1, "상상한 장면을 말로 그려요"),
                    T("w03-2", "그리고 싶은 장면을 **글로 설명**하면 AI가 그림으로 만들어 줍니다. 멋진 풍경이나 카드 그림은 척척이에요."),
                    IMG("w03-3", "벚꽃이 흩날리는 시골 마을 돌담길, 따뜻한 봄 햇살, 평화로운 한국 수채화 풍경", 303),
                    C("w03-4", "🎨", "‘무엇을 + 어떤 분위기로 + 무슨 색으로’를 적으면 더 예쁘게 나와요."),
                ],
            },
            {
                id: "p2",
                title: "영상과 글도 척척",
                blocks: [
                    H("w03-5", 2, "영상도, 편지도 만들어 줘요"),
                    T("w03-6", "그림뿐 아니라 짧은 **영상**도, 마음을 담은 **글**도 부탁할 수 있어요. 아래 [실행]을 눌러 보세요."),
                    VID("w03-7", "잔잔한 파도가 밀려오는 해 질 녘 바닷가의 짧고 평화로운 영상 클립", "노을 지는 바닷가"),
                    LLM("w03-8", "사랑하는 손주의 초등학교 입학을 축하하는 따뜻한 편지를 5줄로 써줘. 다정하고 정겨운 말투로."),
                ],
            },
        ],
    });

    // 4주차 ── 똑똑하게 쓰고 마무리
    lessons.push({
        id: "hm-w04",
        title: "4주차 · 똑똑하게 쓰고 마무리",
        description: "AI도 가끔 틀려요. 똑똑하게 걸러 듣는 법과 수료식.",
        pages: [
            {
                id: "p1",
                title: "AI를 믿어도 될까요?",
                blocks: [
                    H("w04-1", 1, "AI는 ‘아는 척’ 할 때가 있어요"),
                    T("w04-2", "AI는 똑똑하지만 가끔 **그럴듯하게 틀린 말**을 해요. 특히 **숫자·날짜·법·돈** 이야기는 꼭 한 번 더 확인하세요."),
                    TBL("w04-3", ["믿어도 되는 것", "꼭 확인할 것"], [
                        ["요리법, 글쓰기 도움", "병원·약 정보"],
                        ["일반 상식, 아이디어", "법률·세금·연금 액수"],
                        ["번역, 말동무", "최신 뉴스·날짜·통계"],
                    ]),
                    C("w04-4", "🚨", "특히 조심: 송금 요청, 비밀번호, ‘당첨됐다’는 말은 AI든 문자든 무조건 의심하세요!"),
                ],
            },
            {
                id: "p2",
                title: "마지막 한마디",
                blocks: [
                    H("w04-5", 2, "끝이 아니라 시작이에요"),
                    Q("w04-6", "“나이는 숫자일 뿐, 배움에는 끝이 없다.”"),
                    LLM("w04-7", "4주 동안 생성형 AI 수업을 끝까지 들은 분들에게 전할 따뜻한 수료 축하 인사말을 5줄로 써줘."),
                    C("w04-8", "🎓", "수료를 진심으로 축하드립니다. 그동안 함께해 주셔서 고맙습니다 — 홍문 드림"),
                ],
            },
        ],
    });

    const stmt = db.prepare(
        `INSERT INTO courses (id, title, description, cover, author_nickname, data, created_at, updated_at)
         VALUES (@id, @title, @description, NULL, @author, @data, @created, @updated)
         ON CONFLICT(id) DO UPDATE SET title=@title, description=@description,
           author_nickname=@author, data=@data, updated_at=@updated`,
    );
    lessons.forEach((l, i) => {
        const t = weekTime(i + 1) - 2 * DAY; // 강의는 수업 이틀 전 준비
        stmt.run({
            id: l.id,
            title: l.title,
            description: l.description,
            author: INSTRUCTOR.name,
            data: JSON.stringify({ pages: l.pages, maxWidth: "4xl" }),
            created: t,
            updated: t,
        });
    });
    console.log(`  강의: ${lessons.length}개 주차(모든 AI 블럭은 프롬프트만, 결과물 비움)`);
    return lessons.map((l) => l.id);
}

// ---------- 공지사항 ----------
// 개강·수료 공지 2건.
function seedAnnouncements() {
    const items = [
        {
            id: "hm-ann-open",
            week: 1,
            title: "[개강 안내] 생성형 AI 4주 과정을 시작합니다",
            blocks: [
                H("hao-1", 2, "환영합니다, 여러분!"),
                T("hao-2", "오늘부터 매주 **화요일 오전 10시**, 총 4주 동안 함께합니다. 준비물은 **충전된 스마트폰** 하나면 충분해요.\n\n글씨가 작으면 화면 오른쪽 위 글자 크기 버튼을 눌러 키우세요. 모르는 건 언제든 손 들어 주세요!"),
                C("hao-3", "📞", "결석하시거나 도움이 필요하면 사무실(02-000-0000)으로 연락 주세요."),
            ],
        },
        {
            id: "hm-ann-grad",
            week: 4,
            title: "[수료식 안내] 4주차 발표회와 수료증 수여",
            blocks: [
                H("hag-1", 2, "드디어 수료식입니다 🎓"),
                T("hag-2", "마지막 주차에는 **각자 만든 작품 발표**와 **수료증 수여식**이 있습니다. 그동안 만든 작품 중 가장 마음에 드는 하나를 골라 와 주세요.\n\n간단한 다과도 준비되어 있습니다. 가족과 함께 오셔도 좋아요!"),
                Q("hag-3", "“끝까지 함께해 주신 여러분 모두가 주인공입니다.”"),
            ],
        },
    ];
    const stmt = db.prepare(
        `INSERT INTO announcements (id, program_id, title, author_id, author_name, data, created_at, updated_at)
         VALUES (@id, @pid, @title, @aid, @aname, @data, @t, @t)
         ON CONFLICT(id) DO UPDATE SET title=@title, data=@data, updated_at=@t`,
    );
    for (const a of items) {
        const t = weekTime(a.week) - 1 * DAY;
        stmt.run({
            id: a.id,
            pid: PROGRAM_ID,
            title: a.title,
            aid: INSTRUCTOR.id,
            aname: INSTRUCTOR.name,
            data: JSON.stringify({ blocks: a.blocks }),
            t,
        });
    }
    console.log(`  공지: ${items.length}건`);
}

// ---------- 게시물 + 댓글 ----------
// 자기소개·작품자랑 게시물과 학생 댓글(비밀댓글 포함)을 만든다.
function seedPosts() {
    const posts = [
        {
            id: "hm-post-intro",
            week: 1,
            title: "[자기소개] 돌아가며 인사 나눠요 🙋",
            blocks: [
                H("hpi-1", 2, "서로 인사하는 시간"),
                T("hpi-2", "댓글로 **성함**과 **이번 수업에서 배우고 싶은 것**을 적어 주세요. 천천히 한 줄이면 충분해요!"),
            ],
            comments: [
                { who: "gildong", text: "홍길동입니다! AI로 멋진 편지랑 그림 만들어 보고 싶어요. 잘 부탁드립니다 ㅎㅎ", off: 2 * HOUR },
                { who: "chunhyang", text: "성춘향이에요~ 손주한테 카톡으로 예쁜 카드 보내는 게 소원이에요.", off: 5 * HOUR },
                { who: "mongryong", text: "이몽룡입니다. 아내한테 AI로 시 한 편 써주고 싶습니다 허허.", off: 1 * DAY },
                { who: "simcheong", text: "심청이에요. 글씨가 잘 안 보여서 걱정인데 천천히 따라가 볼게요.", off: 1 * DAY + 3 * HOUR },
            ],
        },
        {
            id: "hm-post-gallery",
            week: 4,
            title: "[작품 자랑방] 내가 만든 AI 작품을 올려요 🎨",
            blocks: [
                H("hpg-1", 2, "그동안 만든 작품 자랑"),
                T("hpg-2", "수업에서 만든 AI 그림·글을 댓글로 자랑해 주세요. 서로 칭찬 댓글도 잊지 마세요!"),
                C("hpg-3", "💬", "비밀댓글로 강사에게만 질문할 수도 있어요."),
            ],
            comments: [
                { who: "gildong", text: "벚꽃길 그림 만들었어요! 생각보다 너무 예쁘게 나와서 깜짝 놀랐네요 ㅎㅎ", off: 3 * HOUR },
                { who: "simcheong", text: "와 길동님 그림 너무 곱네요~ 저는 연꽃 그림 그렸어요. 가족들이 좋아하더라고요!", off: 5 * HOUR },
                { who: "heungbu", text: "흥부입니다. 영상이 자꾸 안 만들어지는데 비밀로 강사님께 여쭤봅니다…", off: 1 * DAY, secret: true },
            ],
        },
    ];
    const pstmt = db.prepare(
        `INSERT INTO posts (id, program_id, title, author_id, author_name, data, created_at, updated_at)
         VALUES (@id, @pid, @title, @aid, @aname, @data, @t, @t)
         ON CONFLICT(id) DO UPDATE SET title=@title, data=@data, updated_at=@t`,
    );
    const cstmt = db.prepare(
        `INSERT INTO post_comments (id, post_id, parent_id, user_id, author_name, author_avatar, role, text, secret, created_at)
         VALUES (@id, @post, '', @uid, @name, @av, 'student', @text, @secret, @t)`,
    );
    const clearC = db.prepare("DELETE FROM post_comments WHERE post_id = ?");
    const sById = Object.fromEntries(STUDENTS.map((s) => [s.id, s]));
    let cCount = 0;
    for (const p of posts) {
        const base = weekTime(p.week);
        pstmt.run({
            id: p.id,
            pid: PROGRAM_ID,
            title: p.title,
            aid: INSTRUCTOR.id,
            aname: INSTRUCTOR.name,
            data: JSON.stringify({ blocks: p.blocks }),
            t: base - 1 * HOUR,
        });
        clearC.run(p.id);
        let n = 0;
        for (const c of p.comments) {
            const s = sById[c.who];
            cstmt.run({
                id: `${p.id}-c${++n}`,
                post: p.id,
                uid: s.id,
                name: s.name,
                av: s.avatar,
                text: c.text,
                secret: c.secret ? 1 : 0,
                t: base + c.off,
            });
            cCount++;
        }
    }
    console.log(`  게시물: ${posts.length}개, 댓글: ${cCount}건`);
}

// ---------- 드릴(시험·연습) ----------
// 실제 LLM 화면을 따라 하는 연습/시험 항목을 만든다.
function seedDrills() {
    const drills = [
        {
            id: "hm-drill-w02",
            week: 2,
            kind: "practice",
            provider: "chatgpt",
            title: "ChatGPT에 직접 말 걸어 보기 (자유 연습)",
            mission: "",
        },
        {
            id: "hm-drill-w03",
            week: 3,
            kind: "exam",
            provider: "chatgpt",
            title: "[미션] 좋은 질문 만들기 시험",
            mission: "‘누가·무엇을·어떻게’가 모두 들어간 질문을 하나 만들어 AI에게 물어보세요. 예: ‘무릎 안 좋은 70대가 집에서 할 수 있는 운동 3가지를 알려줘’. 받은 답을 보고 제출하면 됩니다.",
        },
    ];
    const stmt = db.prepare(
        `INSERT INTO drills (id, program_id, kind, provider, title, mission, author_id, author_name, created_at, updated_at)
         VALUES (@id, @pid, @kind, @provider, @title, @mission, @aid, @aname, @t, @t)
         ON CONFLICT(id) DO UPDATE SET kind=@kind, provider=@provider, title=@title, mission=@mission, updated_at=@t`,
    );
    for (const d of drills) {
        const t = weekTime(d.week) - 1 * DAY;
        stmt.run({
            id: d.id,
            pid: PROGRAM_ID,
            kind: d.kind,
            provider: d.provider,
            title: d.title,
            mission: d.mission,
            aid: INSTRUCTOR.id,
            aname: INSTRUCTOR.name,
            t,
        });
    }
    console.log(`  드릴(시험/연습): ${drills.length}건`);
}

// ---------- 창작 실습(아틀리에) ----------
// 강사 시범본(그림동화)을 만든다. 표지·본문 그림은 프롬프트만, 결과물은 비운다.
function seedAtelier() {
    const ATELIER_ID = "hm-atelier-w03";
    // bloom 테마(동화책 기본) — atelier-templates.ts 의 값과 동일.
    const theme = { key: "bloom", accent: "#db2777", coverBg: "#ffe4ef", coverText: "#831843", pageBg: "#fffafc", pageText: "#4a223a" };
    const sample = {
        genre: "storybook",
        cover: { title: "길동이의 첫 그림책", subtitle: "그림동화", author: "홍문", image: null },
        theme,
        ratio: "square",
        font: "round",
        pages: [
            {
                id: uid(),
                title: "1쪽",
                blocks: [
                    IMG(uid(), "햇살 가득한 숲속 오솔길을 씩씩하게 걷는 작은 아이, 따뜻하고 귀여운 동화 일러스트", 11),
                    T(uid(), "옛날 옛적, 작은 길동이가 새로운 길을 떠났어요."),
                ],
            },
            {
                id: uid(),
                title: "2쪽",
                blocks: [
                    IMG(uid(), "노을 지는 집으로 다정한 친구와 함께 돌아오는 아이, 포근한 동화 일러스트", 12),
                    T(uid(), "다정한 친구를 만나, 둘은 무사히 집으로 돌아왔답니다. 끝."),
                ],
            },
        ],
    };
    db.prepare(
        `INSERT INTO ateliers (id, program_id, genre, title, brief, author_id, author_name, data, created_at, updated_at)
         VALUES (@id, @pid, @genre, @title, @brief, @aid, @aname, @data, @t, @t)
         ON CONFLICT(id) DO UPDATE SET genre=@genre, title=@title, brief=@brief, data=@data, updated_at=@t`,
    ).run({
        id: ATELIER_ID,
        pid: PROGRAM_ID,
        genre: "storybook",
        title: "나만의 그림동화 만들기",
        brief: "AI 그림과 글로 짧은 그림동화 한 권을 만들어 보세요. 표지와 두 장면을 채우면 책이 완성됩니다. 강사 시범본을 참고하세요!",
        aid: INSTRUCTOR.id,
        aname: INSTRUCTOR.name,
        // 앱의 upsertAtelier 와 동일한 래퍼 형태로 저장한다({sample, templateId}).
        // 직렬화 형태가 다르면 rowToAtelier 의 parseSample 이 .sample 을 못 찾아 빈 작품으로 폴백한다.
        data: JSON.stringify({ sample, templateId: "story-two" }),
        t: weekTime(3) - 1 * DAY,
    });
    console.log("  창작 실습(아틀리에): 그림동화 1건(강사 시범본, 그림은 프롬프트만)");
    return ATELIER_ID;
}

// ---------- 프로그램(강좌) ----------
// 4주차 주차 구성을 만들어 프로그램을 upsert 한다.
function seedProgram(lessonIds, atelierId) {
    // 주차별 항목 구성: 모든 주차에 강의 1개 + 일부 주차에 공지/게시물/드릴/실습 추가.
    const extraByWeek = {
        1: [
            { type: "announcement", id: "hm-ann-open" },
            { type: "post", id: "hm-post-intro" },
        ],
        2: [{ type: "practice", id: "hm-drill-w02" }],
        3: [
            { type: "exam", id: "hm-drill-w03" },
            { type: "atelier", id: atelierId },
        ],
        4: [
            { type: "announcement", id: "hm-ann-grad" },
            { type: "post", id: "hm-post-gallery" },
        ],
    };
    const titles = [
        "생성형 AI, 처음 만나요",
        "질문 잘하는 법",
        "AI로 만들기",
        "똑똑하게 쓰고 마무리",
    ];
    const weeks = lessonIds.map((lid, i) => {
        const n = i + 1;
        const items = [{ type: "lesson", id: lid }, ...(extraByWeek[n] ?? [])];
        return { id: `hm-wk${n}`, weekNo: n, title: `${n}주차 — ${titles[i]}`, items, lessonIds: [lid] };
    });
    const now = Date.now();
    const data = JSON.stringify({
        weeks,
        startDate: "2026-06-16",
        endDate: "2026-07-07",
        weekDays: [2], // 화요일
    });
    db.prepare(
        `INSERT INTO programs (id, title, description, cover, owner_id, owner_name, invite_code, data, created_at, updated_at)
         VALUES (@id, @title, @desc, NULL, @oid, @oname, @code, @data, @created, @updated)
         ON CONFLICT(id) DO UPDATE SET title=@title, description=@desc, owner_id=@oid,
           owner_name=@oname, invite_code=@code, data=@data, updated_at=@updated`,
    ).run({
        id: PROGRAM_ID,
        title: "처음 만나는 생성형 AI — 4주 완성",
        desc: "생성형 AI를 처음 접하는 분들을 위한 4주 입문 과정. 매주 한 걸음씩, AI와 친해집니다.",
        oid: INSTRUCTOR.id,
        oname: INSTRUCTOR.name,
        code: "HONG24",
        data,
        created: COURSE_START - 7 * DAY,
        updated: now, // 목록 맨 위에 오도록 방금 수정한 것으로 둔다
    });
    console.log("  프로그램: 처음 만나는 생성형 AI — 4주 완성 / 초대코드 HONG24");
}

// ---------- 수강신청 ----------
// 모든 학생을 프로그램에 등록한다.
function seedEnrollments() {
    const stmt = db.prepare(
        "INSERT OR IGNORE INTO enrollments (program_id, user_id, name, enrolled_at) VALUES (?, ?, ?, ?)",
    );
    const base = COURSE_START - 3 * DAY;
    STUDENTS.forEach((s, i) => stmt.run(PROGRAM_ID, s.id, s.name, base + i * 30 * 60 * 1000));
    console.log(`  수강신청: ${STUDENTS.length}명`);
}

// ---------- 진도 ----------
// 학생별로 들쭉날쭉한 진도를 기록한다. 주인공 홍길동은 3주차까지 진행한 '수강 중' 상태.
function seedProgress(lessonIds) {
    const stmt = db.prepare(
        `INSERT INTO lesson_progress (user_id, lesson_id, program_id, max_page, total_pages, completed, updated_at)
         VALUES (@uid, @lid, @pid, @max, @total, @done, @t)
         ON CONFLICT(user_id, lesson_id) DO UPDATE SET max_page=@max, total_pages=@total, completed=@done, updated_at=@t`,
    );
    // 학생마다 "끝까지 들은 주차 수"를 다르게 — 성실도 차이를 표현(홍길동=3, 진행 중).
    const reach = { gildong: 3, chunhyang: 2, mongryong: 2, simcheong: 1, heungbu: 1 };
    let rows = 0;
    for (const s of STUDENTS) {
        const upto = reach[s.id] ?? 1;
        for (let w = 1; w <= upto; w++) {
            const lid = lessonIds[w - 1];
            const total = 2; // 각 강의는 2페이지
            const last = w === upto; // 마지막 도달 주차는 진행 중(1페이지)일 수 있음
            const maxPage = last ? 0 : total - 1;
            const done = maxPage >= total - 1 ? 1 : 0;
            stmt.run({ uid: s.id, lid, pid: PROGRAM_ID, max: maxPage, total, done, t: weekTime(w) + 2 * HOUR });
            rows++;
        }
    }
    console.log(`  진도 기록: ${rows}건(홍길동 3주차 진행 중)`);
}

// ---------- 강의 채팅 ----------
// 1주차 강의방에 오가는 대화를 몇 줄 넣어 살아있는 느낌을 준다.
function seedChat() {
    const lid = "hm-w01";
    db.prepare("DELETE FROM chat_messages WHERE course_id = ?").run(lid);
    const stmt = db.prepare(
        `INSERT INTO chat_messages (id, course_id, user_id, nickname, role, avatar, text, attachments, created_at)
         VALUES (@id, @cid, @uid, @nick, @role, @av, @text, '[]', @t)`,
    );
    const base = weekTime(1) + 10 * 60 * 1000;
    const msgs = [
        { uid: "hongmun", nick: "홍문", role: "instructor", av: "fox", text: "여러분 반갑습니다! 첫 시간이니 편하게 따라오세요. 😊" },
        { uid: "gildong", nick: "홍길동", role: "student", av: "panda", text: "선생님 글씨가 너무 작아요 ㅠㅠ" },
        { uid: "hongmun", nick: "홍문", role: "instructor", av: "fox", text: "길동님, 오른쪽 위 ‘글자 크기’ 버튼을 눌러 보세요. 두 번 누르면 큼직해집니다!" },
        { uid: "gildong", nick: "홍길동", role: "student", av: "panda", text: "오 됐어요! 잘 보이네요 고맙습니다~" },
        { uid: "chunhyang", nick: "성춘향", role: "student", av: "rose", text: "재밌네요 ㅎㅎ AI한테 인사하니까 답이 와요!" },
    ];
    msgs.forEach((m, i) =>
        stmt.run({ id: `hm-chat-w01-${i + 1}`, cid: lid, uid: m.uid, nick: m.nick, role: m.role, av: m.av, text: m.text, t: base + i * 4 * 60 * 1000 }),
    );
    console.log(`  강의 채팅: ${msgs.length}건 (1주차)`);
}

// ---------- 홍길동의 작성 중인 프롬프트 ----------
// 1주차 LLM 블럭에 홍길동이 '입력해 둔' 프롬프트를 남긴다(결과는 비움 — 직접 실행용).
function seedGildongDraft() {
    const at = weekTime(1) + 30 * 60 * 1000;
    const run = { prompt: "안녕? 나는 홍길동이야. 오늘 처음 AI랑 이야기해봐. 반갑게 인사해줘!", result: null, genMs: null, seed: null, at };
    db.prepare(
        `INSERT INTO student_block_work (user_id, lesson_id, block_id, block_type, current, history, updated_at)
         VALUES (@uid, @lid, @bid, @btype, @cur, '[]', @t)
         ON CONFLICT(user_id, lesson_id, block_id) DO UPDATE SET block_type=@btype, current=@cur, updated_at=@t`,
    ).run({
        uid: "gildong",
        lid: "hm-w01",
        bid: "w01-7", // 1주차 2페이지 AI 글쓰기 블럭
        btype: "llm",
        cur: JSON.stringify(run),
        t: at,
    });
    console.log("  홍길동 작성 중 프롬프트: 1건(1주차 AI 글쓰기, 결과는 비움)");
}

// ---------- 실행 ----------
const run = db.transaction(() => {
    console.log("홍문 강사 · 홍길동 학생 — 4주 데모 시드 시작…");
    seedUsers();
    const lessonIds = buildLessons();
    seedAnnouncements();
    seedPosts();
    seedDrills();
    const atelierId = seedAtelier();
    seedProgram(lessonIds, atelierId);
    seedEnrollments();
    seedProgress(lessonIds);
    seedChat();
    seedGildongDraft();
});
run();
console.log("\n완료! 강사 로그인: hongmun / 1234,  학생 로그인: gildong / 1234,  초대코드: HONG24");
console.log("AI 블럭은 모두 프롬프트만 채워져 있습니다. 화면에서 [실행]을 누르면 그 자리에서 생성됩니다(과금).");
db.close();

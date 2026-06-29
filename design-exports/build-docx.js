/**
 * Instructorly 프로토타입 화면 안내 DOCX 생성 스크립트.
 * FHD 캡쳐 스크린샷 + 화면별 설명을 Pretendard 폰트로 조판한다.
 */
const fs = require("fs");
const path = require("path");
const {
    Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer,
    AlignmentType, HeadingLevel, TableOfContents, PageNumber, PageBreak,
    LevelFormat, BorderStyle,
} = require("docx");

const SHOTS = path.join(__dirname, "docx-shots");
const FONT = "Pretendard";
const MONO = "Geist Mono";

// 스크린샷 이미지를 비율에 맞춰 가운데 정렬 문단으로 만든다.
function shot(file, width, height) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 160 },
        border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "E3E3E3", space: 6 },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "E3E3E3", space: 6 },
            left: { style: BorderStyle.SINGLE, size: 4, color: "E3E3E3", space: 6 },
            right: { style: BorderStyle.SINGLE, size: 4, color: "E3E3E3", space: 6 },
        },
        children: [new ImageRun({
            type: "png",
            data: fs.readFileSync(path.join(SHOTS, file)),
            transformation: { width, height },
            altText: { title: file, description: file, name: file },
        })],
    });
}

// 라우트 경로를 모노스페이스 작은 라벨로 만든다.
function route(text) {
    return new Paragraph({
        spacing: { before: 40, after: 120 },
        children: [new TextRun({ text, font: MONO, size: 18, color: "8A8A8A" })],
    });
}

// 본문 설명 문단을 만든다.
function body(text) {
    return new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text, size: 21, color: "2A2A2A" })],
    });
}

// 불릿 항목을 만든다(라벨 강조 + 설명).
function bullet(label, desc) {
    return new Paragraph({
        numbering: { reference: "feat", level: 0 },
        spacing: { after: 60 },
        children: [
            new TextRun({ text: label, bold: true, size: 21, color: "111111" }),
            new TextRun({ text: desc ? " — " + desc : "", size: 21, color: "3A3A3A" }),
        ],
    });
}

// 화면 섹션(제목 + 라우트 + 설명 + 불릿 + 캡쳐)을 조립한다.
function section(num, title, routeText, lead, bullets, file, isTall) {
    const w = isTall ? 460 : 600;
    const h = isTall ? 454 : 252; // landing 3818x3770, app 3840x1612
    const kids = [
        new Paragraph({
            heading: HeadingLevel.HEADING_2,
            pageBreakBefore: true,
            children: [new TextRun(`${num}. ${title}`)],
        }),
        route(routeText),
        body(lead),
    ];
    for (const b of bullets) kids.push(bullet(b[0], b[1]));
    kids.push(shot(file, w, h));
    kids.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [new TextRun({ text: `▲ ${title} — FHD 캡쳐`, font: MONO, size: 16, color: "9A9A9A" })],
    }));
    return kids;
}

const heading2 = {
    id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
    run: { size: 30, bold: true, color: "111111", font: FONT },
    paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1 },
};
const heading1 = {
    id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
    run: { size: 36, bold: true, color: "000000", font: FONT },
    paragraph: { spacing: { before: 260, after: 160 }, outlineLevel: 0 },
};
const titleStyle = {
    id: "Title", name: "Title", basedOn: "Normal",
    run: { size: 60, bold: true, color: "000000", font: FONT },
    paragraph: { spacing: { before: 200, after: 100 }, alignment: AlignmentType.CENTER },
};

const children = [];

// ===== 표지 =====
children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 240 },
    children: [new ImageRun({
        type: "png",
        data: fs.readFileSync(path.join(SHOTS, "00-cover.png")),
        transformation: { width: 560, height: 315 },
        altText: { title: "cover", description: "Instructorly cover", name: "cover" },
    })],
}));
children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Instructorly")] }));
children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: "프론트엔드 프로토타입 — 화면 캡쳐 안내서", size: 26, color: "444444" })],
}));
children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: "누구나 AI 강사가 되는 LMS", size: 22, color: "777777" })],
}));
children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 0 },
    children: [new TextRun({ text: "대전평생교육진흥원 · 비전21테크", font: MONO, size: 18, color: "8A8A8A" })],
}));
children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 0 },
    children: [new TextRun({ text: "FHD(1920×1080) 캡쳐 · 본문 글꼴 Pretendard · 2026-06-26", font: MONO, size: 18, color: "8A8A8A" })],
}));

// ===== 목차 =====
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("목차")] }));
children.push(new TableOfContents("목차", { hyperlink: true, headingStyleRange: "1-2" }));

// ===== 서비스 개요 =====
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("서비스 개요")] }));
children.push(body("Instructorly는 누구나 'AI 강사'가 되어 강의를 만들고, 학습자는 페이지를 넘기며 배우는 LMS 프로토타입입니다. 강사는 노션·스크래치처럼 블럭으로 강의를 제작하고, 이미지·텍스트 AI 블럭을 강의 안에 직접 심을 수 있습니다. 학습자는 한 장씩 페이지를 넘기며 학습하고, 오른쪽 '자랑방' 채팅으로 결과물을 공유합니다."));
children.push(bullet("AI 강사 훈련 LMS", "블럭으로 강의 제작(빌더) → 페이지 넘김 학습(플레이어)"));
children.push(bullet("노인 친화 접근성", "글자 크기 3단계 · 고대비 토글 · 밝게/어둡게, 설정은 브라우저 저장"));
children.push(bullet("블럭 에디터", "팔레트 드래그 또는 '/' 명령으로 텍스트·이미지·AI·동영상 블럭 삽입"));
children.push(bullet("실제 AI 생성", "이미지·텍스트 블럭에서 프롬프트 실행, 소요 시간(초) 표시"));
children.push(bullet("비실시간 채팅", "학습 화면 오른쪽 자랑방, 4초 폴링 · 이미지/동영상/오디오 첨부"));
children.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "기술 스택", bold: true, size: 23, color: "111111" })] }));
children.push(body("Next.js 16.2.9 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui(Base UI) · better-sqlite3 · @dnd-kit · zustand · next-themes · Pretendard + Geist Mono · OpenRouter 기반 AI 생성."));

// ===== 화면별 안내 =====
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("화면별 안내")] }));
children.push(body("아래는 주요 화면을 FHD 해상도로 캡쳐한 것입니다. 각 화면의 역할과 핵심 UI 요소를 함께 설명합니다."));

const SECTIONS = [
    ["1", "랜딩", "/ (홈)",
        "서비스 첫 화면입니다. '누구나, AI 강사가 됩니다' 헤드라인 아래 핵심 가치 4가지와 3단계 사용 흐름을 보여주고, 바로 시작/강좌 둘러보기로 유도합니다. midday.ai 풍의 절제된 모노크롬 디자인입니다.",
        [["헤드라인 + CTA", "지금 시작하기 / 강좌 둘러보기"], ["핵심 기능 4카드", "블럭 제작 · 페이지 학습 · 진짜 AI 생성 · 큰 글씨/고대비"], ["사용 방법 3단계", "회원가입 → 강의 제작/선택 → 학습·자랑"]],
        "01-landing.png", true],
    ["2", "로그인 / 회원가입", "/login",
        "닉네임(아이디)과 역할만으로 진입하는 단순 로그인입니다. 비밀번호는 데모 수준이며, 로그인/회원가입 탭과 데모 계정 안내를 제공합니다.",
        [["탭 전환", "로그인 · 회원가입"], ["역할 구분", "강사(instructor) / 학생(student)"], ["데모 계정", "강사 teacher/1234 · 학생 kim/1234"]],
        "11-login.png", false],
    ["3", "강좌 목록", "/programs",
        "내 강좌(강사) 또는 수강 중인 강좌(학생)를 카드 그리드로 보여줍니다. 강사에게는 '새 강좌 만들기', 학생에게는 초대 코드 참여 버튼이 노출됩니다.",
        [["강좌 카드", "주차 수 · 강의 수 · 수강생 수 · 갱신일"], ["강사 액션", "새 강좌 만들기 · 강좌 보기 · 수정 · 삭제"], ["일정 표시", "시작/종료일과 매주 요일(예: 매주 화·목)"]],
        "02-programs.png", false],
    ["4", "강좌 상세 · 관리", "/programs/[id]",
        "강좌의 주차별 콘텐츠를 관리하는 강사용 대시보드입니다. 수강 현황 요약(수강생·학습 중·평균 진행률)과 주차별 강의/게시물/공지/시험/연습을 드래그로 정렬합니다.",
        [["수강 현황 요약", "수강생 수 · 학습 중 · 평균 진행률 게이지"], ["주차별 콘텐츠", "강의 · 게시물 · 공지 · 시험 · 연습 추가/정렬"], ["탭 구성", "주차별 강의 · 수강생 명단"]],
        "03-program-detail.png", false],
    ["5", "강의 빌더", "/build/[id]",
        "강사가 블럭으로 강의를 제작하는 캔버스입니다. 왼쪽 페이지 목록, 가운데 블럭 캔버스, 오른쪽 블럭 팔레트로 구성됩니다. 텍스트·제목·이미지·AI 글쓰기·동영상·오디오 블럭을 드래그하거나 '/' 명령으로 삽입합니다.",
        [["페이지 목록", "좌측에서 페이지 추가·이동, 스크롤 아닌 페이지 넘김"], ["블럭 팔레트", "전체/AI/일반 분류 + 블럭 검색"], ["AI·이미지 블럭", "직접 작성 또는 AI 생성 탭, 업로드 지원"], ["상단 액션", "불러오기 · 내보내기 · 미리보기 · 저장"]],
        "04-build.png", false],
    ["6", "학습 플레이어", "/learn/[id]",
        "학생이 강의를 한 장씩 넘기며 학습하는 화면입니다. 왼쪽 목차와 진행률, 가운데 페이지 콘텐츠, 오른쪽 '자랑방' 채팅으로 구성됩니다. 이미지·AI 블럭은 학생이 프롬프트를 바꿔 다시 생성할 수 있습니다.",
        [["목차 + 진행률", "페이지별 이동과 학습 진행 %"], ["페이지 넘김", "이전/다음, 하단 페이지 인디케이터(1/13)"], ["자랑방 채팅", "4초 폴링 비실시간, 이미지/동영상/오디오 첨부"]],
        "05-learn.png", false],
    ["7", "AI 연습 · 시험 시뮬레이터", "/drill/[id]",
        "학생이 Grok·Gemini·ChatGPT·Claude 등 실제 AI 도구 화면을 흉내 낸 환경에서 연습(자유)하거나 시험을 치르는 화면입니다. 제공자별 UI를 재현해 실전 감각을 익히게 합니다.",
        [["제공자 재현", "Grok / Gemini / ChatGPT / Claude UI 모사"], ["연습·시험 모드", "자유 연습 또는 채점형 시험"], ["몰입형 레이아웃", "상단에 강좌로 나가기, 본문은 도구 화면 전체"]],
        "08-drill.png", false],
    ["8", "게시물 (자랑방)", "/posts/[id]",
        "강좌 안의 게시물 상세 화면입니다. 본문 블럭과 함께 댓글·답글, 비밀 댓글 토글을 지원해 학습자 간 결과물 공유와 피드백이 이뤄집니다.",
        [["게시물 본문", "작성자 · 작성일 · 블럭 콘텐츠"], ["댓글/답글", "공개·비밀 댓글, Enter 등록 · Shift+Enter 줄바꿈"], ["강좌 연결", "강좌로 돌아가기 내비게이션"]],
        "09-post.png", false],
    ["9", "공지사항", "/announcements/[id]",
        "강좌 공지 상세 화면입니다. 좌측 공지 목차와 진행률, 본문에는 제목·텍스트·이미지 생성 블럭이 포함되어 공지 안에서도 AI 이미지를 곁들일 수 있습니다.",
        [["공지 목차", "좌측에서 여러 공지 간 이동"], ["리치 본문", "제목 · 텍스트 · 이미지 생성 블럭"], ["이미지 재생성", "프롬프트 수정 후 '다시 생성', 소요 시간 표시"]],
        "10-announcement.png", false],
    ["10", "AI 스튜디오 · 사용량", "/studio",
        "강의 AI 블럭이 쓴 OpenRouter 모델 사용 요금을 크레딧 단위로 집계하는 관리 화면입니다. 총 크레딧·생성 횟수·USD 비용과 사용자별 텍스트/이미지/동영상/오디오 사용량을 보여줍니다.",
        [["요약 카드", "총 사용 크레딧 · 총 생성 횟수 · 총 USD 비용"], ["사용자별 사용량", "텍스트·이미지·동영상·오디오 분해 막대"], ["크레딧 규칙", "1크레딧 = 0.1원 환산"]],
        "06-studio.png", false],
    ["11", "내 정보 · 설정", "/settings",
        "프로필과 보기 설정을 관리하는 화면입니다. 동물 아바타 8종 선택, 강좌 주차 보기 방식(카드/테이블) 등 개인화 옵션을 제공합니다.",
        [["프로필", "닉네임 · 아이디 · 아바타"], ["아바타 8종", "토끼·곰·고양이·강아지·여우·판다·펭귄·개구리"], ["보기 설정", "강좌 주차 보기 방식(카드 / 테이블)"]],
        "07-settings.png", false],
];

for (const s of SECTIONS) {
    for (const k of section(...s)) children.push(k);
}

// ===== 마무리 =====
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("맺음말")] }));
children.push(body("본 문서는 Instructorly 프론트엔드 프로토타입의 주요 화면을 FHD 해상도로 캡쳐하고, 각 화면의 역할과 핵심 UI를 정리한 안내서입니다. 인증·권한·동시성은 프로토타입 수준으로 단순화되어 있으며, 실제 운영 환경에서는 보완이 필요합니다."));
children.push(new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ text: "대전평생교육진흥원 AI 강사 양성 과정 · 비전21테크", font: MONO, size: 18, color: "8A8A8A" })],
}));

const doc = new Document({
    creator: "비전21테크",
    title: "Instructorly 프로토타입 화면 안내",
    description: "FHD 캡쳐 기반 화면 설명서",
    styles: {
        default: { document: { run: { font: FONT, size: 21, color: "222222" } } },
        paragraphStyles: [titleStyle, heading1, heading2],
    },
    numbering: {
        config: [{
            reference: "feat",
            levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 460, hanging: 260 } } } }],
        }],
    },
    sections: [{
        properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
        footers: {
            default: new Footer({ children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: "Instructorly  ·  ", font: MONO, size: 16, color: "AAAAAA" }),
                    new TextRun({ children: [PageNumber.CURRENT], font: MONO, size: 16, color: "AAAAAA" }),
                    new TextRun({ text: " / ", font: MONO, size: 16, color: "AAAAAA" }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], font: MONO, size: 16, color: "AAAAAA" }),
                ],
            })] }),
        },
        children,
    }],
});

Packer.toBuffer(doc).then((buf) => {
    const out = path.join(__dirname, "Instructorly_화면안내.docx");
    fs.writeFileSync(out, buf);
    console.log("Saved:", out);
});

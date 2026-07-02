/**
 * 사용 설명서 콘텐츠 데이터 — 타입 정의와 헬퍼, 역할별 설명서 조립만 담당하는 자료 파일.
 * 실제 강사용/학생용 섹션 내용은 guide-data-instructor.ts / guide-data-student.ts 에 나뉘어 있다.
 * 어르신도 쉽게 읽을 수 있도록 짧은 문장과 쉬운 말로 적었고, 각 단계마다 실제 화면을 그대로
 * 찍은 사진(shot)을 끼워 넣을 자리를 마련해 두었다. 화면(UI)은 이 자료를 그대로 그린다.
 * 버튼 이름은 실제 화면의 글자와 똑같이 맞춰 두었다.
 */
import type {
    LucideIcon,
} from "lucide-react";
import {
    GraduationCap,
    BookOpen,
    LayoutGrid,
    Share2,
    SquarePen,
    Sparkles,
    Feather,
    BarChart3,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { instructorSections } from "./guide-data-instructor";
import { studentSections } from "./guide-data-student";

/** 한 단계(스텝)를 나타낸다 — 무엇을 누르는지(title)와 쉬운 설명(detail), 그리고 그 단계 화면 사진(shot). */
export interface GuideStep {
    title: string;
    detail: string;
    /** 이 단계를 보여 주는 화면 사진 경로(선택). 있으면 단계 바로 아래에 스크린샷으로 들어간다. */
    shot?: string;
}

/** 화면을 그대로 찍은 사진 한 장 — 사진 경로(src)와 그 아래 쉬운 설명(caption). */
export interface GuideShot {
    src: string;
    caption: string;
}

/** 화면에서 할 수 있는 기능 하나 — 기능 이름과 사용 방법 한 줄. */
export interface GuideFeature {
    /** 기능 이름 (예: "주차 추가"). */
    name: string;
    /** 사용 방법 한 줄 (예: "주차 목록 오른쪽 위 '주차 추가' 단추를 누릅니다"). */
    how: string;
}

/** 하나의 기능 묶음(섹션) — 제목, 한 줄 요약, 어디서 하는지, 단계들, 사진, 도움말. */
export interface GuideSection {
    /** 화면 앵커 id이자 사진 파일 이름의 일부로 쓰인다. */
    id: string;
    icon: LucideIcon;
    title: string;
    /** 이 기능이 무엇인지 한 문장으로. */
    summary: string;
    /** 어디서 시작하는지(메뉴 경로 안내). */
    where: string;
    steps: GuideStep[];
    /** 실제 화면 사진(선택). 단계에 사진이 하나도 없을 때만 갤러리로 보여 준다. */
    shots?: GuideShot[];
    /** 이 화면에서 할 수 있는 일(선택). 이름/사용 방법 표로 보여 준다. */
    features?: GuideFeature[];
    /** 알아 두면 좋은 도움말(선택). */
    tips?: string[];
}

/** 맨 위에 보여 줄 전체 흐름의 한 칸. */
export interface GuideFlowStep {
    label: string;
    icon: LucideIcon;
}

/** 한 역할(강사 또는 학생)의 설명서 전체. */
export interface RoleGuide {
    role: Role;
    /** 큰 제목. */
    title: string;
    /** 한두 문장 소개. */
    intro: string;
    /** 맨 위 전체 흐름 그림(직접 만든 png). 없으면 아래 flow 칩으로 대체된다. */
    flowImage: string;
    /** 그림이 없을 때 보여 줄 글자 흐름. */
    flow: GuideFlowStep[];
    sections: GuideSection[];
}

/** 화면 사진 경로를 만든다 — public/guide/shots/{role}-{이름}.png */
export function guideShotSrc(role: Role, name: string): string {
    return `/guide/shots/${role}-${name}.png`;
}

/** 강사용 설명서 전체. */
export const instructorGuide: RoleGuide = {
    role: "instructor",
    title: "강사 사용 설명서",
    intro: "강의를 만들고, 학생을 초대하고, 진도를 확인하는 모든 방법을 차례대로 알려드려요. 위에서부터 천천히 따라 해 보세요.",
    flowImage: "/guide/instructor-flow.png",
    flow: [
        { label: "강사로 가입", icon: GraduationCap },
        { label: "강좌 만들기", icon: LayoutGrid },
        { label: "학생 초대", icon: Share2 },
        { label: "강의 만들기", icon: SquarePen },
        { label: "진도 확인", icon: BarChart3 },
    ],
    sections: instructorSections,
};

/** 학생용 설명서 전체. */
export const studentGuide: RoleGuide = {
    role: "student",
    title: "학생 사용 설명서",
    intro: "강좌에 들어가서 강의를 듣고, AI를 직접 해 보고, 작품을 만드는 방법을 차례대로 알려드려요. 위에서부터 천천히 따라 해 보세요.",
    flowImage: "/guide/student-flow.png",
    flow: [
        { label: "초대 링크 받기", icon: Share2 },
        { label: "가입·로그인", icon: GraduationCap },
        { label: "강의 듣기", icon: BookOpen },
        { label: "AI 따라하기", icon: Sparkles },
        { label: "작품 자랑", icon: Feather },
    ],
    sections: studentSections,
};

/** 역할에 맞는 설명서를 돌려준다. 역할이 없으면 학생용을 기본으로 보여 준다. */
export function guideForRole(role: Role | null): RoleGuide {
    return role === "instructor" ? instructorGuide : studentGuide;
}

/** 한 섹션의 차례 위치와 앞·뒤 섹션을 구한다(이전/다음 이동 단추용). */
export function adjacentSections(
    guide: RoleGuide,
    sectionId: string,
): { index: number; prev: GuideSection | null; next: GuideSection | null } {
    const index = guide.sections.findIndex((s) => s.id === sectionId);
    return {
        index,
        prev: index > 0 ? guide.sections[index - 1] : null,
        next:
            index >= 0 && index < guide.sections.length - 1
                ? guide.sections[index + 1]
                : null,
    };
}

/** 역할 이름을 한국어로(강사용/학생용). */
export function roleGuideLabel(role: Role | null): string {
    return role === "instructor" ? "강사용" : "학생용";
}

/**
 * 섹션 id를 '생성 아이콘 이미지'의 이름으로 바꾼다.
 * 몇몇 섹션은 같은 그림을 함께 쓰므로(예: AI 만들기/AI 해보기, 초대/입장) 별칭으로 묶는다.
 */
const ICON_KEY_ALIAS: Record<string, string> = {
    "ai-content": "ai",
    "ai-blocks": "ai",
    join: "invite",
};

/** 섹션의 모던 아이콘 이미지 경로를 만든다 — public/guide/icons/{이름}.png */
export function guideIconSrc(sectionId: string): string {
    const key = ICON_KEY_ALIAS[sectionId] ?? sectionId;
    return `/guide/icons/${key}.png`;
}

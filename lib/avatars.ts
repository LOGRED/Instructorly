// Character avatars a user can pick as their profile picture, grouped into
// categories (animal / flower / nature). Single source of truth shared by the
// profile picker, header, and image-gen script. Images live at
// public/avatars/<key>.png.

export type AvatarCategory = "animal" | "flower" | "nature";

export interface AvatarOption {
    key: string;
    label: string;
    src: string;
    category: AvatarCategory;
}

// 프로필 사진 카테고리 정의 — picker에서 이 순서대로 묶어서 보여준다.
export const AVATAR_CATEGORIES: { key: AvatarCategory; label: string }[] = [
    { key: "animal", label: "동물" },
    { key: "flower", label: "꽃" },
    { key: "nature", label: "자연" },
];

export const AVATARS: AvatarOption[] = [
    // 동물
    { key: "rabbit", label: "토끼", src: "/avatars/rabbit.png", category: "animal" },
    { key: "bear", label: "곰", src: "/avatars/bear.png", category: "animal" },
    { key: "cat", label: "고양이", src: "/avatars/cat.png", category: "animal" },
    { key: "dog", label: "강아지", src: "/avatars/dog.png", category: "animal" },
    { key: "fox", label: "여우", src: "/avatars/fox.png", category: "animal" },
    { key: "panda", label: "판다", src: "/avatars/panda.png", category: "animal" },
    { key: "penguin", label: "펭귄", src: "/avatars/penguin.png", category: "animal" },
    { key: "frog", label: "개구리", src: "/avatars/frog.png", category: "animal" },
    // 꽃
    { key: "rose", label: "장미", src: "/avatars/rose.png", category: "flower" },
    { key: "tulip", label: "튤립", src: "/avatars/tulip.png", category: "flower" },
    { key: "sunflower", label: "해바라기", src: "/avatars/sunflower.png", category: "flower" },
    { key: "blossom", label: "벚꽃", src: "/avatars/blossom.png", category: "flower" },
    { key: "daisy", label: "데이지", src: "/avatars/daisy.png", category: "flower" },
    { key: "lotus", label: "연꽃", src: "/avatars/lotus.png", category: "flower" },
    { key: "hydrangea", label: "수국", src: "/avatars/hydrangea.png", category: "flower" },
    { key: "lavender", label: "라벤더", src: "/avatars/lavender.png", category: "flower" },
    { key: "dandelion", label: "민들레", src: "/avatars/dandelion.png", category: "flower" },
    { key: "carnation", label: "카네이션", src: "/avatars/carnation.png", category: "flower" },
    // 자연
    { key: "tree", label: "나무", src: "/avatars/tree.png", category: "nature" },
    { key: "cloud", label: "구름", src: "/avatars/cloud.png", category: "nature" },
    { key: "sun", label: "해", src: "/avatars/sun.png", category: "nature" },
    { key: "moon", label: "달", src: "/avatars/moon.png", category: "nature" },
    { key: "star", label: "별", src: "/avatars/star.png", category: "nature" },
    { key: "rainbow", label: "무지개", src: "/avatars/rainbow.png", category: "nature" },
];

// 주어진 카테고리에 속한 아바타만 추려서 반환한다.
export function avatarsByCategory(category: AvatarCategory): AvatarOption[] {
    return AVATARS.filter((a) => a.category === category);
}

// 아바타 키로 이미지 경로를 찾아 반환한다(없으면 null).
export function avatarSrc(key: string | null | undefined): string | null {
    if (!key) return null;
    return AVATARS.find((a) => a.key === key)?.src ?? null;
}

// 아바타 키로 한국어 라벨을 찾아 반환한다(없으면 null).
export function avatarLabel(key: string | null | undefined): string | null {
    if (!key) return null;
    return AVATARS.find((a) => a.key === key)?.label ?? null;
}

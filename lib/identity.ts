"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "./types";

interface IdentityState {
    userId: string | null; // login id of the signed-in account
    nickname: string | null; // display name (kept as `nickname` for chat compat)
    role: Role | null;
    avatar: string | null; // chosen avatar key — 동물·꽃·자연 (see lib/avatars)
    hydrated: boolean;
    setIdentity: (
        userId: string,
        nickname: string,
        role: Role,
        avatar?: string | null,
    ) => void;
    /** Patch the signed-in profile (display name and/or avatar). */
    setProfile: (patch: { nickname?: string; avatar?: string }) => void;
    clear: () => void;
}

export const useIdentity = create<IdentityState>()(
    persist(
        (set) => ({
            userId: null,
            nickname: null,
            role: null,
            avatar: null,
            hydrated: false,
            setIdentity: (userId, nickname, role, avatar = null) =>
                set({ userId, nickname, role, avatar }),
            setProfile: (patch) =>
                set((s) => ({
                    nickname: patch.nickname ?? s.nickname,
                    avatar: patch.avatar ?? s.avatar,
                })),
            clear: () => set({ userId: null, nickname: null, role: null, avatar: null }),
        }),
        {
            name: "maketor-identity",
            onRehydrateStorage: () => (state) => {
                if (state) state.hydrated = true;
            },
        },
    ),
);

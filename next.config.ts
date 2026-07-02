import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // The repo lives next to other lockfiles; pin the tracing root to this app.
    outputFileTracingRoot: process.cwd(),
    // LAN IP로 접속 시 dev 서버 cross-origin 차단 방지 (make dev-https 네트워크 접속용).
    allowedDevOrigins: ["192.168.0.177"],
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "image.pollinations.ai" },
        ],
    },
    // Uploaded media (image/video/audio) can be large.
    experimental: {
        serverActions: { bodySizeLimit: "25mb" },
    },
};

export default nextConfig;

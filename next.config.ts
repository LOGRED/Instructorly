import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // The repo lives next to other lockfiles; pin the tracing root to this app.
    outputFileTracingRoot: process.cwd(),
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  logging: {
    incomingRequests: {
      ignore: [/\/invite\//i, /\/api\/public\/invitations\//i],
    },
  },
  async headers() {
    return ["/invite/:path*", "/api/public/invitations/:path*", "/photos/:path*", "/api/photos/:path*"].map(
      (source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      }),
    );
  },
};

export default nextConfig;

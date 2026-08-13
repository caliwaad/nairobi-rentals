import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* CORS for API route handlers.
   *
   * The native app (Expo/React Native) does not enforce CORS, but the
   * react-native-web preview runs in a browser, which does. The app
   * authenticates with Clerk bearer tokens (Authorization header), not
   * cookies, so a permissive origin is safe here.
   */
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;

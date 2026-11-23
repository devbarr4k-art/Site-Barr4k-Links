import type { NextConfig } from "next";

// A página mora em barr4k.com/trader: o site principal (Site-Barr4k) repassa /trader pra cá.
const BASE = "/trader"; // igual a src/lib/base.ts

const nextConfig: NextConfig = {
  basePath: BASE,
  // quem abrir o endereço da Vercel sem /trader cai na página
  async redirects() {
    return [{ source: "/", destination: BASE, basePath: false, permanent: false }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  { protocol: "https", hostname: "images.unsplash.com" },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  const { hostname, port, protocol } = new URL(supabaseUrl);
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use http or https.");
  }
  remotePatterns.push({
    protocol: protocol === "http:" ? "http" : "https",
    hostname,
    port,
    pathname: "/storage/v1/object/sign/recipe-images/**",
  });
}

const nextConfig: NextConfig = {
  images: { remotePatterns },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";

const nextConfig = {
  ...(isCapacitorBuild ? { output: "export" } : {}),
  typedRoutes: false,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/experience",
        destination: "/attendee-dashboard",
        permanent: true,
      },
      {
        source: "/dashboard/live",
        destination: "/live",
        permanent: false,
      },
      {
        source: "/dashboard/countdown",
        destination: "/countdown",
        permanent: false,
      },
      {
        source: "/experience/live",
        destination: "/live",
        permanent: false,
      },
      {
        source: "/experience/live/ig",
        destination: "/live",
        permanent: true,
      },
      {
        source: "/experience/live/ig/:path*",
        destination: "/live",
        permanent: true,
      },
      {
        source: "/contact",
        destination: "/contact-us",
        permanent: true,
      },
      {
        source: "/prayer",
        destination: "/contact-us",
        permanent: true,
      },
      {
        source: "/experience/prayer",
        destination: "/experience/contact-us",
        permanent: true,
      },
      {
        source: "/email-gate/attendee",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/email-gate/login",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/email-gate/signup",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/email-gate/guest",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/ops/simplified",
        destination: "/owner/control",
        permanent: true,
      },
      {
        source: "/ops/production-dashboard",
        destination: "/owner/control",
        permanent: false,
      },
      {
        source: "/ops/production-dashboard/:path*",
        destination: "/owner/control",
        permanent: false,
      },
      {
        source: "/ops/live-hub",
        destination: "/owner/control",
        permanent: false,
      },
      {
        source: "/ops/live-hub/:path*",
        destination: "/owner/control",
        permanent: false,
      },
      {
        source: "/ops",
        destination: "/owner/control",
        permanent: false,
      },
      {
        source: "/ops/:path*",
        destination: "/owner/control",
        permanent: false,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;

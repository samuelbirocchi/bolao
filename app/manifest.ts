import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bolao World Cup Pool",
    short_name: "Bolao",
    description: "Private World Cup score prediction pools for friends.",
    start_url: "/groups",
    display: "standalone",
    background_color: "#f7f7f2",
    theme_color: "#126b52",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

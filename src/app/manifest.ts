import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Estrellita Management",
    short_name: "Estrellita",
    description: "Keep track of household duties from your iPhone.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F5F7",
    theme_color: "#F5F5F7",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

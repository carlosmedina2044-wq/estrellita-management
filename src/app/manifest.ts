export const dynamic = "force-static";

export default function manifest() {
  return {
    name: "Cuidala",
    short_name: "Cuidala",
    description: "Home maintenance, restock, and seasonal checklists.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6ef",
    theme_color: [
      { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
      { media: "(prefers-color-scheme: dark)", color: "#1f1a16" },
    ],
    orientation: "portrait",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

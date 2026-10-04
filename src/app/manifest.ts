export const dynamic = "force-static";

export default function manifest() {
  return {
    name: "Cuidala",
    short_name: "Cuidala",
    description: "Home maintenance, restock, and seasonal checklists.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ee",
    theme_color: [
      { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
      { media: "(prefers-color-scheme: dark)", color: "#121110" },
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

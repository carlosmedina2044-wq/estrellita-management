export const dynamic = "force-static";

export default function manifest() {
  return {
    name: "Cuidala",
    short_name: "Cuidala",
    description: "Home maintenance, restock, and seasonal checklists.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ec",
    theme_color: [
      { media: "(prefers-color-scheme: light)", color: "#f4f1ec" },
      { media: "(prefers-color-scheme: dark)", color: "#101418" },
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

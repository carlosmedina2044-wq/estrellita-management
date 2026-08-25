export const dynamic = "force-static";

export default function manifest() {
  return {
    name: "Cuidala",
    short_name: "Cuidala",
    description: "Home maintenance, restock, and seasonal checklists.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F3EC",
    theme_color: "#F7F3EC",
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

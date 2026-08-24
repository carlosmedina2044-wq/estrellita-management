export const dynamic = "force-static";

export default function manifest() {
  return {
    name: "Cuidala",
    short_name: "Cuidala",
    description: "Home maintenance, restock, and seasonal checklists.",
    start_url: "/",
    display: "standalone",
    share_target: {
      action: "/share",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
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

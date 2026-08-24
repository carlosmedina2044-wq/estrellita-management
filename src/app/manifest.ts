export default function manifest() {
  return {
    name: "Estrellita Management",
    short_name: "Estrellita",
    description: "Knows what is running out and when to order it, one tap to any retailer.",
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

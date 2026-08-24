import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4E6C8",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24">
          <path
            fill="#C45C26"
            d="M12 2.2l2.7 6.6 7.2.6-5.4 4.6 1.7 7-6.2-3.6-6.2 3.6 1.7-7-5.4-4.6 7.2-.6L12 2.2z"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}

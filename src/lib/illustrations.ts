export type IllustrationName =
  | "room-kitchen"
  | "room-living"
  | "room-bedroom"
  | "room-bath"
  | "room-laundry"
  | "room-outdoors"
  | "sys-water-heater"
  | "sys-fridge"
  | "sys-laundry"
  | "sys-hvac"
  | "sys-pool"
  | "sys-irrigation"
  | "season-rain"
  | "season-freeze"
  | "season-summer"
  | "season-fall"
  | "house-cutaway"
  | "house"
  | "shelf";

export const ILLUSTRATIONS: Record<
  IllustrationName,
  { src: string; width: number; height: number }
> = {
  "room-kitchen": { src: "/illustrations/room-kitchen.webp", width: 192, height: 147 },
  "room-living": { src: "/illustrations/room-living.webp", width: 192, height: 116 },
  "room-bedroom": { src: "/illustrations/room-bedroom.webp", width: 192, height: 135 },
  "room-bath": { src: "/illustrations/room-bath.webp", width: 192, height: 143 },
  "room-laundry": { src: "/illustrations/room-laundry.webp", width: 192, height: 111 },
  "room-outdoors": { src: "/illustrations/room-outdoors.webp", width: 192, height: 122 },
  "sys-water-heater": { src: "/illustrations/sys-water-heater.webp", width: 280, height: 385 },
  "sys-fridge": { src: "/illustrations/sys-fridge.webp", width: 280, height: 336 },
  "sys-laundry": { src: "/illustrations/sys-laundry.webp", width: 280, height: 316 },
  "sys-hvac": { src: "/illustrations/sys-hvac.webp", width: 280, height: 287 },
  "sys-pool": { src: "/illustrations/sys-pool.webp", width: 280, height: 290 },
  "sys-irrigation": { src: "/illustrations/sys-irrigation.webp", width: 280, height: 260 },
  "season-rain": { src: "/illustrations/season-rain.webp", width: 280, height: 286 },
  "season-freeze": { src: "/illustrations/season-freeze.webp", width: 280, height: 282 },
  "season-summer": { src: "/illustrations/season-summer.webp", width: 280, height: 275 },
  "season-fall": { src: "/illustrations/season-fall.webp", width: 280, height: 304 },
  "house-cutaway": { src: "/illustrations/house-cutaway.webp", width: 720, height: 513 },
  house: { src: "/illustrations/house.webp", width: 400, height: 349 },
  shelf: { src: "/illustrations/shelf.webp", width: 640, height: 524 },
};

export type MomentId =
  | "sparkle-burst"
  | "living-house"
  | "shelf-scene"
  | "breathing-loop";

export const MOMENTS: Record<
  MomentId,
  {
    path: string;
    loop: boolean;
    durationMs: number;
    poster: IllustrationName | null;
    width: 512;
    height: 512;
  }
> = {
  "sparkle-burst": {
    path: "/illustrations/lottie/sparkle-burst/sparkle-burst.json",
    loop: false,
    durationMs: 600,
    poster: null,
    width: 512,
    height: 512,
  },
  "living-house": {
    path: "/illustrations/lottie/living-house/living-house.json",
    loop: true,
    durationMs: 4000,
    poster: "house",
    width: 512,
    height: 512,
  },
  "shelf-scene": {
    path: "/illustrations/lottie/shelf-scene/shelf-scene.json",
    loop: true,
    durationMs: 5000,
    poster: "shelf",
    width: 512,
    height: 512,
  },
  "breathing-loop": {
    path: "/illustrations/lottie/breathing-loop/breathing-loop.json",
    loop: true,
    durationMs: 3500,
    poster: "house",
    width: 512,
    height: 512,
  },
};

/**
 * Hand-tuned clip-paths over house-cutaway.webp (judgment call, M7-06).
 * Approximate room zones on the cropped home overview: upper band bedrooms/baths,
 * lower band living/kitchen. Overlays use cream at 55% until the room is fresh.
 */
export const CUTAWAY_ROOMS: Record<
  "bedroom" | "bath" | "laundry" | "living" | "kitchen",
  string
> = {
  bedroom: "polygon(6% 10%, 36% 10%, 36% 46%, 6% 46%)",
  bath: "polygon(38% 10%, 60% 10%, 60% 46%, 38% 46%)",
  laundry: "polygon(62% 10%, 94% 10%, 94% 46%, 62% 46%)",
  living: "polygon(6% 50%, 48% 50%, 48% 90%, 6% 90%)",
  kitchen: "polygon(50% 50%, 94% 50%, 94% 90%, 50% 90%)",
};

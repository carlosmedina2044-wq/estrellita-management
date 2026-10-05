import type { AssetType } from "@/lib/types";

/** A brand as printed on a plate. `family` is the manufacturer group used to pick a serial decoder. */
export type BrandInfo = {
  id: string;
  name: string;
  family: string;
  /** Aliases matched on whole-word boundaries against upper-cased text. */
  aliases: string[];
  /** Only set when the brand makes (almost) one kind of thing. */
  typeHint?: AssetType;
};

export const BRANDS: BrandInfo[] = [
  { id: "rheem", name: "Rheem", family: "rheem", aliases: ["RHEEM"] },
  { id: "ruud", name: "Ruud", family: "rheem", aliases: ["RUUD"] },
  {
    id: "aosmith",
    name: "A. O. Smith",
    family: "aosmith",
    aliases: ["A. O. SMITH", "A.O. SMITH", "AO SMITH", "A O SMITH", "AOSMITH"],
    typeHint: "water_heater",
  },
  {
    id: "state",
    name: "State",
    family: "aosmith",
    aliases: ["STATE WATER HEATERS", "STATE WATER HEATER", "STATE SELECT", "STATE INDUSTRIES"],
    typeHint: "water_heater",
  },
  {
    id: "bradford_white",
    name: "Bradford White",
    family: "bradford_white",
    aliases: ["BRADFORD WHITE", "BRADFORD-WHITE"],
    typeHint: "water_heater",
  },
  { id: "carrier", name: "Carrier", family: "carrier", aliases: ["CARRIER"] },
  { id: "bryant", name: "Bryant", family: "carrier", aliases: ["BRYANT"] },
  { id: "payne", name: "Payne", family: "carrier", aliases: ["PAYNE"] },
  { id: "trane", name: "Trane", family: "trane", aliases: ["TRANE"] },
  { id: "american_standard", name: "American Standard", family: "trane", aliases: ["AMERICAN STANDARD"] },
  { id: "lennox", name: "Lennox", family: "lennox", aliases: ["LENNOX"] },
  { id: "goodman", name: "Goodman", family: "goodman", aliases: ["GOODMAN"] },
  { id: "amana", name: "Amana", family: "amana", aliases: ["AMANA"] },
  { id: "york", name: "York", family: "york", aliases: ["YORK"] },
  { id: "whirlpool", name: "Whirlpool", family: "whirlpool", aliases: ["WHIRLPOOL"] },
  { id: "maytag", name: "Maytag", family: "whirlpool", aliases: ["MAYTAG"] },
  { id: "kitchenaid", name: "KitchenAid", family: "whirlpool", aliases: ["KITCHENAID", "KITCHEN AID"] },
  { id: "jenn_air", name: "Jenn-Air", family: "whirlpool", aliases: ["JENN-AIR", "JENN AIR", "JENNAIR"] },
  { id: "ge", name: "GE", family: "ge", aliases: ["GE", "G.E.", "GENERAL ELECTRIC"] },
  { id: "hotpoint", name: "Hotpoint", family: "ge", aliases: ["HOTPOINT"] },
  { id: "lg", name: "LG", family: "lg", aliases: ["LG"] },
  { id: "samsung", name: "Samsung", family: "samsung", aliases: ["SAMSUNG"] },
  { id: "frigidaire", name: "Frigidaire", family: "frigidaire", aliases: ["FRIGIDAIRE"] },
  { id: "electrolux", name: "Electrolux", family: "frigidaire", aliases: ["ELECTROLUX"] },
  { id: "bosch", name: "Bosch", family: "bosch", aliases: ["BOSCH"] },
  { id: "kenmore", name: "Kenmore", family: "kenmore", aliases: ["KENMORE"] },
  { id: "haier", name: "Haier", family: "haier", aliases: ["HAIER"] },
  { id: "speed_queen", name: "Speed Queen", family: "speed_queen", aliases: ["SPEED QUEEN"] },
  { id: "daikin", name: "Daikin", family: "daikin", aliases: ["DAIKIN"] },
  { id: "heil", name: "Heil", family: "carrier_heil", aliases: ["HEIL"] },
  { id: "rinnai", name: "Rinnai", family: "rinnai", aliases: ["RINNAI"] },
  { id: "navien", name: "Navien", family: "navien", aliases: ["NAVIEN"], typeHint: "water_heater" },
  { id: "noritz", name: "Noritz", family: "noritz", aliases: ["NORITZ"], typeHint: "water_heater" },
  { id: "reliance", name: "Reliance", family: "reliance", aliases: ["RELIANCE WATER HEATER", "RELIANCE"], typeHint: "water_heater" },
];

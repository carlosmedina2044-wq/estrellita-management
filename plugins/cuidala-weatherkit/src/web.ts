import { WebPlugin } from "@capacitor/core";
import type {
  CuidalaWeatherKitPlugin,
  GeocodedZip,
  WeatherKitAttribution,
  WeatherKitForecast,
} from "./definitions";

export class CuidalaWeatherKitWeb extends WebPlugin implements CuidalaWeatherKitPlugin {
  async fetchForecast(): Promise<WeatherKitForecast> {
    throw this.unimplemented("WeatherKit is available on iOS only.");
  }

  async geocodeZip(): Promise<GeocodedZip> {
    throw this.unimplemented("ZIP geocoding is available on iOS only.");
  }

  async fetchAttribution(): Promise<WeatherKitAttribution> {
    return {
      legalPageURL: "https://weatherkit.apple.com/legal-attribution.html",
      legalText: "Apple Weather",
      markLight: "",
      markDark: "",
    };
  }
}

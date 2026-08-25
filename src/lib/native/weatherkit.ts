import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native/platform";
import { roundCoord } from "@/lib/climate";
import type { DailyWeather, WeatherForecast } from "@/lib/weather/provider";

export type NativeWeatherForecast = {
  days: DailyWeather[];
  fetchedAt: string;
};

export type NativeGeocodedZip = {
  lat: number;
  lng: number;
  placeName?: string;
};

type NativeWeatherKit = {
  fetchForecast(options: { latitude: number; longitude: number }): Promise<NativeWeatherForecast>;
  geocodeZip(options: { postalCode: string }): Promise<NativeGeocodedZip>;
};

const plugin = registerPlugin<NativeWeatherKit>("CuidalaWeatherKit");

export async function weatherKitForecast(lat: number, lng: number): Promise<WeatherForecast> {
  if (!isNative()) throw new Error("WeatherKit is iOS-only");
  const result = await plugin.fetchForecast({ latitude: lat, longitude: lng });
  if (!result.days?.length) throw new Error("WeatherKit returned no days");
  return {
    fetchedAt: result.fetchedAt || new Date().toISOString(),
    days: result.days.map((day) => ({
      date: day.date,
      tempMinF: Number(day.tempMinF) || 0,
      tempMaxF: Number(day.tempMaxF) || 0,
      windMph: Number(day.windMph) || 0,
      precipIn: Number(day.precipIn) || 0,
    })),
  };
}

export async function weatherKitGeocodeZip(postalCode: string): Promise<NativeGeocodedZip | null> {
  if (!isNative()) return null;
  try {
    const place = await plugin.geocodeZip({ postalCode });
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat: roundCoord(lat),
      lng: roundCoord(lng),
      placeName: place.placeName,
    };
  } catch {
    return null;
  }
}

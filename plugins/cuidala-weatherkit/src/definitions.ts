export type WeatherKitDay = {
  date: string;
  tempMinF: number;
  tempMaxF: number;
  windMph: number;
  precipIn: number;
  condition?: string;
  precipChance?: number;
};

export type WeatherKitForecast = {
  days: WeatherKitDay[];
  fetchedAt: string;
  current?: { condition: string; cloudCover: number; isDaylight: boolean };
};

export type GeocodedZip = {
  lat: number;
  lng: number;
  placeName?: string;
};

export type WeatherKitAttribution = {
  legalPageURL: string;
  legalText: string;
  markLight: string;
  markDark: string;
};

export type ReverseGeocodeResult = {
  placeName?: string;
};

export interface CuidalaWeatherKitPlugin {
  fetchForecast(options: { latitude: number; longitude: number }): Promise<WeatherKitForecast>;
  geocodeZip(options: { postalCode: string }): Promise<GeocodedZip>;
  reverseGeocode(options: { latitude: number; longitude: number }): Promise<ReverseGeocodeResult>;
  fetchAttribution(): Promise<WeatherKitAttribution>;
}

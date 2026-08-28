export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LoUser {
  id: number;
  username: string;
}

export interface LoCard {
  id: string;
  label: string;
  title: string;
  hero?: string;
  lines: string[];
  meta?: string;
}

export interface LocalResult {
  place: {
    name?: string;
    locality?: string;
    region?: string;
    country?: string;
    countryCode?: string;
  } | null;
  weather: {
    timezone?: { id?: string; abbreviation?: string };
    current?: {
      time?: string;
      temperature?: number;
      apparent?: number;
      humidity?: number;
      weatherCode?: number;
      windSpeed?: number;
      isDay?: boolean;
    };
    today?: {
      date?: string;
      weatherCode?: number;
      tempMax?: number;
      tempMin?: number;
      sunrise?: string;
      sunset?: string;
    };
    upcoming?: Array<{
      date?: string;
      weatherCode?: number;
      tempMax?: number;
      tempMin?: number;
    }>;
    units?: { temperature?: string; wind?: string };
  } | null;
  components: string[];
  failed?: string[];
}


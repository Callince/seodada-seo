import { Select } from "@/components/ui/select";

export interface LocationOption {
  location_code: number;
  language_code: string;
  label: string;
}

/**
 * Country markets, grouped by region. Codes are the provider's official
 * location codes (Google geotarget IDs: 2000 + ISO-3166 numeric). Each country
 * carries its dominant Google language; English-heavy or multilingual markets
 * default to "en".
 */
export const REGIONS: { label: string; options: LocationOption[] }[] = [
  {
    label: "Popular",
    options: [
      { location_code: 2840, language_code: "en", label: "United States (English)" },
      { location_code: 2356, language_code: "en", label: "India (English)" },
      { location_code: 2826, language_code: "en", label: "United Kingdom (English)" },
    ],
  },
  {
    label: "Americas",
    options: [
      { location_code: 2124, language_code: "en", label: "Canada (English)" },
      { location_code: 2484, language_code: "es", label: "Mexico (Spanish)" },
      { location_code: 2076, language_code: "pt", label: "Brazil (Portuguese)" },
      { location_code: 2032, language_code: "es", label: "Argentina (Spanish)" },
      { location_code: 2170, language_code: "es", label: "Colombia (Spanish)" },
      { location_code: 2152, language_code: "es", label: "Chile (Spanish)" },
      { location_code: 2604, language_code: "es", label: "Peru (Spanish)" },
    ],
  },
  {
    label: "Europe",
    options: [
      { location_code: 2372, language_code: "en", label: "Ireland (English)" },
      { location_code: 2276, language_code: "de", label: "Germany (German)" },
      { location_code: 2250, language_code: "fr", label: "France (French)" },
      { location_code: 2724, language_code: "es", label: "Spain (Spanish)" },
      { location_code: 2380, language_code: "it", label: "Italy (Italian)" },
      { location_code: 2528, language_code: "nl", label: "Netherlands (Dutch)" },
      { location_code: 2056, language_code: "nl", label: "Belgium (Dutch)" },
      { location_code: 2756, language_code: "de", label: "Switzerland (German)" },
      { location_code: 2040, language_code: "de", label: "Austria (German)" },
      { location_code: 2620, language_code: "pt", label: "Portugal (Portuguese)" },
      { location_code: 2616, language_code: "pl", label: "Poland (Polish)" },
      { location_code: 2752, language_code: "sv", label: "Sweden (Swedish)" },
      { location_code: 2208, language_code: "da", label: "Denmark (Danish)" },
      { location_code: 2246, language_code: "fi", label: "Finland (Finnish)" },
      { location_code: 2203, language_code: "cs", label: "Czechia (Czech)" },
      { location_code: 2300, language_code: "el", label: "Greece (Greek)" },
      { location_code: 2642, language_code: "ro", label: "Romania (Romanian)" },
      { location_code: 2348, language_code: "hu", label: "Hungary (Hungarian)" },
      { location_code: 2804, language_code: "uk", label: "Ukraine (Ukrainian)" },
      { location_code: 2792, language_code: "tr", label: "Türkiye (Turkish)" },
    ],
  },
  {
    label: "Asia-Pacific",
    options: [
      { location_code: 2036, language_code: "en", label: "Australia (English)" },
      { location_code: 2554, language_code: "en", label: "New Zealand (English)" },
      { location_code: 2392, language_code: "ja", label: "Japan (Japanese)" },
      { location_code: 2410, language_code: "ko", label: "South Korea (Korean)" },
      { location_code: 2702, language_code: "en", label: "Singapore (English)" },
      { location_code: 2344, language_code: "en", label: "Hong Kong (English)" },
      { location_code: 2458, language_code: "en", label: "Malaysia (English)" },
      { location_code: 2360, language_code: "id", label: "Indonesia (Indonesian)" },
      { location_code: 2608, language_code: "en", label: "Philippines (English)" },
      { location_code: 2764, language_code: "th", label: "Thailand (Thai)" },
      { location_code: 2704, language_code: "vi", label: "Vietnam (Vietnamese)" },
      { location_code: 2586, language_code: "en", label: "Pakistan (English)" },
      { location_code: 2050, language_code: "en", label: "Bangladesh (English)" },
      { location_code: 2144, language_code: "en", label: "Sri Lanka (English)" },
      { location_code: 2524, language_code: "en", label: "Nepal (English)" },
    ],
  },
  {
    label: "Middle East & Africa",
    options: [
      { location_code: 2784, language_code: "en", label: "United Arab Emirates (English)" },
      { location_code: 2682, language_code: "ar", label: "Saudi Arabia (Arabic)" },
      { location_code: 2818, language_code: "ar", label: "Egypt (Arabic)" },
      { location_code: 2376, language_code: "en", label: "Israel (English)" },
      { location_code: 2710, language_code: "en", label: "South Africa (English)" },
      { location_code: 2566, language_code: "en", label: "Nigeria (English)" },
      { location_code: 2404, language_code: "en", label: "Kenya (English)" },
    ],
  },
];

/** Flat list of all country options (kept for label lookups etc.). */
export const LOCATIONS: LocationOption[] = REGIONS.flatMap((r) => r.options);

// City-level markets — rankings can differ sharply from the country SERP for
// local-intent queries (each city sees its own localized results).
export const CITY_LOCATIONS: LocationOption[] = [
  { location_code: 1007809, language_code: "en", label: "Chennai, India" },
  { location_code: 1007785, language_code: "en", label: "Mumbai, India" },
  { location_code: 9075215, language_code: "en", label: "Delhi, India" },
  { location_code: 1007768, language_code: "en", label: "Bengaluru, India" },
  { location_code: 1007740, language_code: "en", label: "Hyderabad, India" },
  { location_code: 1007828, language_code: "en", label: "Kolkata, India" },
  { location_code: 1007788, language_code: "en", label: "Pune, India" },
  { location_code: 1007753, language_code: "en", label: "Ahmedabad, India" },
];

/** Human label for a location code (countries + cities), e.g. for list rows. */
export function locationLabel(code: number): string {
  const hit = [...LOCATIONS, ...CITY_LOCATIONS].find((o) => o.location_code === code);
  return hit ? hit.label : `#${code}`;
}

interface Props {
  value: { location_code: number; language_code: string };
  onChange: (v: { location_code: number; language_code: string }) => void;
  className?: string;
}

export function LocationLanguagePicker({ value, onChange, className }: Props) {
  const current = `${value.location_code}:${value.language_code}`;
  return (
    <Select
      value={current}
      onChange={(e) => {
        const [loc, lang] = e.target.value.split(":");
        onChange({ location_code: Number(loc), language_code: lang });
      }}
      className={className}
      aria-label="Country / location"
    >
      {REGIONS.map((region) => (
        <optgroup key={region.label} label={region.label}>
          {region.options.map((o) => (
            <option key={`${o.location_code}:${o.language_code}`} value={`${o.location_code}:${o.language_code}`}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
      <optgroup label="Cities — India">
        {CITY_LOCATIONS.map((o) => (
          <option key={`${o.location_code}:${o.language_code}`} value={`${o.location_code}:${o.language_code}`}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}

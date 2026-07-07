import { Select } from "@/components/ui/select";

export interface LocationOption {
  location_code: number;
  language_code: string;
  label: string;
}

// Common markets. Codes come from the provider's official locations list.
export const LOCATIONS: LocationOption[] = [
  { location_code: 2840, language_code: "en", label: "United States (English)" },
  { location_code: 2826, language_code: "en", label: "United Kingdom (English)" },
  { location_code: 2124, language_code: "en", label: "Canada (English)" },
  { location_code: 2036, language_code: "en", label: "Australia (English)" },
  { location_code: 2356, language_code: "en", label: "India (English)" },
  { location_code: 2276, language_code: "de", label: "Germany (German)" },
  { location_code: 2250, language_code: "fr", label: "France (French)" },
  { location_code: 2724, language_code: "es", label: "Spain (Spanish)" },
];

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
    >
      <optgroup label="Countries">
        {LOCATIONS.map((o) => (
          <option key={`${o.location_code}:${o.language_code}`} value={`${o.location_code}:${o.language_code}`}>
            {o.label}
          </option>
        ))}
      </optgroup>
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

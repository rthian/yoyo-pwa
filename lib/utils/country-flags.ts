/**
 * Country Flag Utility
 * Maps country names to ISO codes and emoji flags
 */

const COUNTRY_TO_ISO: Record<string, string> = {
  'afghanistan': 'AF', 'albania': 'AL', 'algeria': 'DZ', 'argentina': 'AR',
  'australia': 'AU', 'austria': 'AT', 'bangladesh': 'BD', 'belgium': 'BE',
  'brazil': 'BR', 'brunei': 'BN', 'cambodia': 'KH', 'canada': 'CA',
  'chile': 'CL', 'china': 'CN', 'colombia': 'CO', 'costa rica': 'CR',
  'croatia': 'HR', 'czech republic': 'CZ', 'czechia': 'CZ',
  'denmark': 'DK', 'egypt': 'EG', 'estonia': 'EE', 'finland': 'FI',
  'france': 'FR', 'germany': 'DE', 'greece': 'GR', 'hong kong': 'HK',
  'hungary': 'HU', 'iceland': 'IS', 'india': 'IN', 'indonesia': 'ID',
  'iran': 'IR', 'iraq': 'IQ', 'ireland': 'IE', 'israel': 'IL',
  'italy': 'IT', 'japan': 'JP', 'jordan': 'JO', 'kazakhstan': 'KZ',
  'kenya': 'KE', 'south korea': 'KR', 'korea': 'KR', 'kuwait': 'KW',
  'laos': 'LA', 'latvia': 'LV', 'lebanon': 'LB', 'lithuania': 'LT',
  'luxembourg': 'LU', 'macau': 'MO', 'malaysia': 'MY', 'maldives': 'MV',
  'mexico': 'MX', 'mongolia': 'MN', 'morocco': 'MA', 'myanmar': 'MM',
  'nepal': 'NP', 'netherlands': 'NL', 'new zealand': 'NZ', 'nigeria': 'NG',
  'norway': 'NO', 'oman': 'OM', 'pakistan': 'PK', 'panama': 'PA',
  'peru': 'PE', 'philippines': 'PH', 'poland': 'PL', 'portugal': 'PT',
  'qatar': 'QA', 'romania': 'RO', 'russia': 'RU', 'saudi arabia': 'SA',
  'serbia': 'RS', 'singapore': 'SG', 'slovakia': 'SK', 'slovenia': 'SI',
  'south africa': 'ZA', 'spain': 'ES', 'sri lanka': 'LK', 'sweden': 'SE',
  'switzerland': 'CH', 'taiwan': 'TW', 'thailand': 'TH', 'turkey': 'TR',
  'turkiye': 'TR', 'ukraine': 'UA', 'united arab emirates': 'AE', 'uae': 'AE',
  'united kingdom': 'GB', 'uk': 'GB', 'united states': 'US', 'usa': 'US',
  'us': 'US', 'uruguay': 'UY', 'uzbekistan': 'UZ', 'venezuela': 'VE',
  'vietnam': 'VN', 'yemen': 'YE',
}

/**
 * Convert ISO 3166-1 alpha-2 code to flag emoji
 */
function isoToFlag(iso: string): string {
  const code = iso.toUpperCase()
  if (code.length !== 2) return ''
  const offset = 0x1F1E6 // Regional Indicator Symbol Letter A
  return String.fromCodePoint(
    code.charCodeAt(0) - 65 + offset,
    code.charCodeAt(1) - 65 + offset
  )
}

/**
 * Get emoji flag for a country name
 * Returns the flag emoji or empty string if not found
 */
export function getCountryFlag(countryName: string | null | undefined): string {
  if (!countryName) return ''
  const iso = COUNTRY_TO_ISO[countryName.toLowerCase().trim()]
  if (!iso) {
    // Try if already an ISO code
    if (countryName.length === 2) return isoToFlag(countryName)
    return ''
  }
  return isoToFlag(iso)
}

/**
 * Get ISO code for a country name
 */
export function getCountryISO(countryName: string | null | undefined): string | null {
  if (!countryName) return null
  const iso = COUNTRY_TO_ISO[countryName.toLowerCase().trim()]
  return iso || null
}

/**
 * Format country display with flag emoji
 * Returns "🇲🇾 Malaysia" format
 */
export function formatCountryWithFlag(countryName: string | null | undefined): string {
  if (!countryName) return ''
  const flag = getCountryFlag(countryName)
  return flag ? `${flag} ${countryName}` : countryName
}

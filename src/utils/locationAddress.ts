import { resolvePhilippinePlaceName } from "./philippinePlaces";

export type ReverseGeocodedAddress = {
  streetNumber?: string;
  street?: string;
  city?: string;
  district?: string;
  subregion?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  formattedAddress?: string;
};

const pickFirst = (...values: (string | undefined | null)[]) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() || "";

export const normalizeNominatimAddress = (rawAddress: any): ReverseGeocodedAddress => {
  const city = resolvePhilippinePlaceName(rawAddress?.city, rawAddress?.town, rawAddress?.municipality, rawAddress?.village);
  const district = pickFirst(rawAddress?.district, rawAddress?.borough, rawAddress?.city_district);
  const subregion = pickFirst(rawAddress?.county, rawAddress?.state_district);
  const region = pickFirst(rawAddress?.state, rawAddress?.region);
  const streetNumber = pickFirst(rawAddress?.house_number);
  const street = pickFirst(rawAddress?.road, rawAddress?.pedestrian, rawAddress?.footway);

  return {
    streetNumber,
    street,
    city,
    district,
    subregion,
    region,
    country: pickFirst(rawAddress?.country),
    postalCode: pickFirst(rawAddress?.postcode),
  };
};

export const formatAddressLabel = (address: ReverseGeocodedAddress | null) => {
  if (!address) return "";
  const parts = [address.street, address.city, address.subregion, address.region]
    .filter(Boolean)
    .map((item) => item?.trim())
    .filter(Boolean);
  return parts.join(", ");
};

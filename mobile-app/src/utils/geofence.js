import { Platform } from 'react-native';
import * as Location from 'expo-location';

export const DEFAULT_GEOFENCE_RADIUS_M = 20;
export const MAX_LOCATION_ACCURACY_M = 50;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getSiteCoordinates(site) {
  const latitude = toNumber(site?.latitude);
  const longitude = toNumber(site?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

export function getSiteGeofenceRadius(site) {
  const radius = toNumber(site?.geofence_radius_m);
  return radius && radius > 0 ? radius : DEFAULT_GEOFENCE_RADIUS_M;
}

export function distanceBetweenCoordinatesMeters(from, to) {
  if (!from || !to) {
    return null;
  }

  const earthRadiusM = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusM * c;
}

export function evaluateSiteGeofence(site, location) {
  const coordinates = getSiteCoordinates(site);

  if (!coordinates || !location?.coords) {
    return {
      allowed: false,
      configured: Boolean(coordinates),
      distanceM: null,
      radiusM: getSiteGeofenceRadius(site),
      accuracyM: location?.coords?.accuracy ?? null,
    };
  }

  const currentCoordinates = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
  const distanceM = distanceBetweenCoordinatesMeters(currentCoordinates, coordinates);
  const radiusM = getSiteGeofenceRadius(site);
  const accuracyM = location.coords.accuracy ?? null;
  const requiredAccuracyM = Math.min(MAX_LOCATION_ACCURACY_M, radiusM);
  const accuracyAcceptable = accuracyM === null || accuracyM <= requiredAccuracyM;

  return {
    allowed: distanceM !== null && distanceM <= radiusM && accuracyAcceptable,
    configured: true,
    distanceM,
    radiusM,
    accuracyM,
    requiredAccuracyM,
    accuracyAcceptable,
  };
}

export function findNearestSiteGeofence(sites, location) {
  const candidates = sites
    .map((site) => ({
      site,
      result: evaluateSiteGeofence(site, location),
    }))
    .filter(({ result }) => result.configured && result.distanceM !== null)
    .sort((a, b) => a.result.distanceM - b.result.distanceM);

  return candidates[0] || null;
}

export async function requestCurrentLocation() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.geolocation) {
    throw new Error('GPS location is not available in this browser.');
  }

  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('Location permission is required before submitting site readings.');
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('GPS is turned off. Enable location services, then retry.');
  }

  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    mayShowUserSettingsDialog: true,
  });
}

export async function reverseGeocodePlaceName(location) {
  if (!location?.coords) {
    return '';
  }

  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    if (!place) {
      return 'Unknown area';
    }

    return formatReverseGeocodePlace(place) || 'Unknown area';
  } catch {
    return 'Unknown area';
  }
}

function formatReverseGeocodePlace(place) {
  const barangay = normalizePlacePart(place.district || place.name);
  const cityOrMunicipality = normalizePlacePart(place.city || place.subregion);
  const country = normalizePlacePart(place.country);

  if (barangay && cityOrMunicipality && barangay.toLowerCase() !== cityOrMunicipality.toLowerCase()) {
    return `${barangay}, ${cityOrMunicipality}`;
  }

  return barangay || cityOrMunicipality || country || '';
}

function normalizePlacePart(value) {
  if (!value) {
    return '';
  }

  return String(value).trim();
}


export function buildGpsPayload(site, location, result = evaluateSiteGeofence(site, location)) {
  if (!location?.coords) {
    return {};
  }

  return {
    gps_latitude: location.coords.latitude,
    gps_longitude: location.coords.longitude,
    gps_accuracy_m: location.coords.accuracy ?? null,
    gps_distance_m: result.distanceM,
    gps_verified: Boolean(result.allowed),
    gps_checked_at: new Date().toISOString(),
  };
}

export function formatDistanceMeters(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const distance = Number(value);
  return distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`;
}

import { supabase } from '../lib/supabase';

export async function listAccessibleSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, type, latitude, longitude, geofence_radius_m')
    .order('name', { ascending: true });

  if (error && /latitude|longitude|geofence_radius/i.test(error.message || '')) {
    const fallback = await supabase
      .from('sites')
      .select('id, name, type')
      .order('name', { ascending: true });

    if (fallback.error) {
      throw fallback.error;
    }

    return fallback.data ?? [];
  }

  if (error) {
    throw error;
  }

  return data ?? [];
}

import { supabase } from '../lib/supabase';

export async function getLatestSiteOperationEvent({ siteId }) {
  if (!siteId) {
    return null;
  }

  const { data, error } = await supabase
    .from('site_operation_events')
    .select('id, site_id, site_type, state, note, reading_id, created_by, created_at, created_profile:profiles!site_operation_events_created_by_fkey(full_name, email)')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function getLatestDeepwellOperationEvent() {
  const { data, error } = await supabase
    .from('site_operation_events')
    .select('id, site_id, site_type, state, note, reading_id, created_by, created_at, created_profile:profiles!site_operation_events_created_by_fkey(full_name, email)')
    .eq('site_type', 'DEEPWELL')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function createSiteOperationEvent({ siteId, siteType, state, note, readingId, createdBy }) {
  const { data, error } = await supabase
    .from('site_operation_events')
    .insert({
      site_id: siteId,
      site_type: siteType,
      state,
      note,
      reading_id: readingId || null,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

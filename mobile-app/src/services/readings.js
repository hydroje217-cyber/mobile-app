import { supabase } from '../lib/supabase';

const CHLORINATION_SELECT =
  'id, site_id, submitted_by, reading_datetime, slot_datetime, created_at, remarks, operation_state, operation_note, operation_event_at, totalizer, pressure_psi, rc_ppm, turbidity_ntu, ph, tds_ppm, tank_level_liters, flowrate_m3hr, chlorine_consumed, peroxide_consumption, chlorination_power_kwh, gps_latitude, gps_longitude, gps_accuracy_m, gps_distance_m, gps_verified, gps_checked_at, status, sites(id, name, type), submitted_profile:profiles!chlorination_readings_submitted_by_fkey(full_name, email)';

const DEEPWELL_SELECT =
  'id, site_id, submitted_by, reading_datetime, slot_datetime, created_at, remarks, operation_state, operation_note, operation_event_at, upstream_pressure_psi, downstream_pressure_psi, flowrate_m3hr, vfd_frequency_hz, voltage_l1_v, voltage_l2_v, voltage_l3_v, amperage_a, tds_ppm, power_kwh_shift, gps_latitude, gps_longitude, gps_accuracy_m, gps_distance_m, gps_verified, gps_checked_at, status, sites(id, name, type), submitted_profile:profiles!deepwell_readings_submitted_by_fkey(full_name, email)';

const CHLORINATION_LEGACY_SELECT =
  'id, site_id, submitted_by, reading_datetime, slot_datetime, created_at, remarks, totalizer, pressure_psi, rc_ppm, turbidity_ntu, ph, tds_ppm, tank_level_liters, flowrate_m3hr, chlorine_consumed, peroxide_consumption, chlorination_power_kwh, status, sites(id, name, type), submitted_profile:profiles!chlorination_readings_submitted_by_fkey(full_name, email)';

const DEEPWELL_LEGACY_SELECT =
  'id, site_id, submitted_by, reading_datetime, slot_datetime, created_at, remarks, upstream_pressure_psi, downstream_pressure_psi, flowrate_m3hr, vfd_frequency_hz, voltage_l1_v, voltage_l2_v, voltage_l3_v, amperage_a, tds_ppm, power_kwh_shift, status, sites(id, name, type), submitted_profile:profiles!deepwell_readings_submitted_by_fkey(full_name, email)';

const DAILY_SUMMARY_SELECT =
  'id, site_id, summary_date, source, source_file, production_m3, power_kwh, chlorine_kg, avg_flowrate_m3hr, avg_pressure_psi, avg_rc_ppm, avg_turbidity_ntu, avg_ph, avg_tds_ppm, peroxide_liters, operating_hours, scheduled_downtime_hours, unscheduled_downtime_hours, avg_upstream_pressure_psi, avg_downstream_pressure_psi, avg_vfd_frequency_hz, avg_voltage_l1_v, avg_voltage_l2_v, avg_voltage_l3_v, avg_amperage_a, site:sites(id, name, type)';
const PAGE_SIZE = 1000;

const READING_META = {
  CHLORINATION: {
    tableName: 'chlorination_readings',
    select:
      'id, site_id, submitted_by, reading_datetime, slot_datetime, created_at, operation_state, operation_note, operation_event_at, gps_latitude, gps_longitude, gps_accuracy_m, gps_distance_m, gps_verified, gps_checked_at, submitted_profile:profiles!chlorination_readings_submitted_by_fkey(full_name, email)',
    legacySelect:
      'id, site_id, submitted_by, reading_datetime, slot_datetime, created_at, submitted_profile:profiles!chlorination_readings_submitted_by_fkey(full_name, email)',
    listSelect: CHLORINATION_SELECT,
    legacyListSelect: CHLORINATION_LEGACY_SELECT,
  },
  DEEPWELL: {
    tableName: 'deepwell_readings',
    select:
      'id, site_id, submitted_by, reading_datetime, slot_datetime, created_at, operation_state, operation_note, operation_event_at, gps_latitude, gps_longitude, gps_accuracy_m, gps_distance_m, gps_verified, gps_checked_at, submitted_profile:profiles!deepwell_readings_submitted_by_fkey(full_name, email)',
    legacySelect:
      'id, site_id, submitted_by, reading_datetime, slot_datetime, created_at, submitted_profile:profiles!deepwell_readings_submitted_by_fkey(full_name, email)',
    listSelect: DEEPWELL_SELECT,
    legacyListSelect: DEEPWELL_LEGACY_SELECT,
  },
};

function isMissingOptionalColumnError(error) {
  return /gps_|operation_|schema cache|could not find/i.test(error?.message || '');
}

function canRetryWithoutOperationColumns(payload) {
  return (
    payload?.operation_state === 'normal' &&
    !payload?.operation_note &&
    !payload?.operation_event_at
  );
}

function stripOperationColumns(payload) {
  const {
    operation_state,
    operation_note,
    operation_event_at,
    ...nextPayload
  } = payload;

  return nextPayload;
}

function normalizeReading(row, siteType) {
  return {
    ...row,
    site_type: siteType,
  };
}

function applyReadingFilters(query, { siteId, fromDate, toDate, limit }) {
  let nextQuery = query.order('reading_datetime', { ascending: false });

  if (typeof limit === 'number' && Number.isFinite(limit)) {
    nextQuery = nextQuery.limit(limit);
  }

  if (siteId) {
    nextQuery = nextQuery.eq('site_id', siteId);
  }

  if (fromDate) {
    const start = new Date(`${fromDate}T00:00:00`);
    nextQuery = nextQuery.gte('reading_datetime', start.toISOString());
  }

  if (toDate) {
    const end = new Date(`${toDate}T00:00:00`);
    end.setDate(end.getDate() + 1);
    nextQuery = nextQuery.lt('reading_datetime', end.toISOString());
  }

  return nextQuery;
}

function applyDailySummaryFilters(query, { siteId, fromDate, toDate, limit }) {
  let nextQuery = query.order('summary_date', { ascending: false });

  if (typeof limit === 'number' && Number.isFinite(limit)) {
    nextQuery = nextQuery.limit(limit);
  }

  if (siteId) {
    nextQuery = nextQuery.eq('site_id', siteId);
  }

  if (fromDate) {
    nextQuery = nextQuery.gte('summary_date', fromDate);
  }

  if (toDate) {
    nextQuery = nextQuery.lte('summary_date', toDate);
  }

  return nextQuery;
}

async function fetchReadingPage({ meta, siteType, siteId, fromDate, toDate, from, to }) {
  let { data, error } = await applyReadingFilters(
    supabase.from(meta.tableName).select(meta.listSelect),
    { siteId, fromDate, toDate }
  ).range(from, to);

  if (error && isMissingOptionalColumnError(error)) {
    const fallback = await applyReadingFilters(
      supabase.from(meta.tableName).select(meta.legacyListSelect),
      { siteId, fromDate, toDate }
    ).range(from, to);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeReading(row, siteType));
}

async function fetchAllReadingsForType({ siteType, siteId, fromDate, toDate }) {
  const meta = READING_META[siteType];
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchReadingPage({
      meta,
      siteType,
      siteId,
      fromDate,
      toDate,
      from,
      to: from + PAGE_SIZE - 1,
    });

    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchAllDailySiteSummaries({ siteId, siteType, fromDate, toDate }) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await applyDailySummaryFilters(
      supabase.from('daily_site_summaries').select(DAILY_SUMMARY_SELECT),
      { siteId, fromDate, toDate }
    ).range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));

    if ((data ?? []).length < PAGE_SIZE) {
      break;
    }
  }

  const normalizedSiteType = String(siteType || '').toUpperCase();

  return rows
    .filter((row) => {
      if (!normalizedSiteType) {
        return true;
      }

      return String(row?.site?.type || '').toUpperCase() === normalizedSiteType;
    })
    .map((row) => ({
      ...row,
      site_type: row?.site?.type,
    }));
}

function buildChlorinationPayload(payload) {
  const {
    site_type,
    upstream_pressure_psi,
    downstream_pressure_psi,
    vfd_frequency_hz,
    voltage_l1_v,
    voltage_l2_v,
    voltage_l3_v,
    amperage_a,
    power_kwh_shift,
    ...chlorinationPayload
  } = payload;

  return chlorinationPayload;
}

function buildDeepwellPayload(payload) {
  const {
    site_type,
    totalizer,
    pressure_psi,
    rc_ppm,
    turbidity_ntu,
    ph,
    tank_level_liters,
    chlorine_consumed,
    peroxide_consumption,
    chlorination_power_kwh,
    ...deepwellPayload
  } = payload;

  return deepwellPayload;
}

export async function createReading(payload) {
  const tableName = payload?.site_type === 'CHLORINATION' ? 'chlorination_readings' : 'deepwell_readings';
  const tablePayload =
    payload?.site_type === 'CHLORINATION'
      ? buildChlorinationPayload(payload)
      : buildDeepwellPayload(payload);

  let { data, error } = await supabase
    .from(tableName)
    .insert(tablePayload)
    .select('id')
    .single();

  if (error && isMissingOptionalColumnError(error) && canRetryWithoutOperationColumns(tablePayload)) {
    const fallback = await supabase
      .from(tableName)
      .insert(stripOperationColumns(tablePayload))
      .select('id')
      .single();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function updateReading(readingId, payload) {
  const tableName = payload?.site_type === 'CHLORINATION' ? 'chlorination_readings' : 'deepwell_readings';
  const tablePayload =
    payload?.site_type === 'CHLORINATION'
      ? buildChlorinationPayload(payload)
      : buildDeepwellPayload(payload);

  let { data, error } = await supabase
    .from(tableName)
    .update(tablePayload)
    .eq('id', readingId)
    .select('id')
    .single();

  if (error && isMissingOptionalColumnError(error) && canRetryWithoutOperationColumns(tablePayload)) {
    const fallback = await supabase
      .from(tableName)
      .update(stripOperationColumns(tablePayload))
      .eq('id', readingId)
      .select('id')
      .single();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function getReadingForSlot({ siteId, siteType, slotIso }) {
  const meta = READING_META[siteType];

  if (!meta || !siteId || !slotIso) {
    return null;
  }

  const { data, error } = await supabase
    .from(meta.tableName)
    .select(meta.select)
    .eq('site_id', siteId)
    .eq('slot_datetime', slotIso)
    .maybeSingle();

  if (error && isMissingOptionalColumnError(error)) {
    const fallback = await supabase
      .from(meta.tableName)
      .select(meta.legacySelect)
      .eq('site_id', siteId)
      .eq('slot_datetime', slotIso)
      .maybeSingle();

    if (fallback.error) {
      throw fallback.error;
    }

    return fallback.data ? normalizeReading(fallback.data, siteType) : null;
  }

  if (error) {
    throw error;
  }

  return data ? normalizeReading(data, siteType) : null;
}

export async function getLatestReadingForSite({ siteId, siteType }) {
  const meta = READING_META[siteType];

  if (!meta || !siteId) {
    return null;
  }

  const { data, error } = await supabase
    .from(meta.tableName)
    .select(meta.select)
    .eq('site_id', siteId)
    .order('slot_datetime', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && isMissingOptionalColumnError(error)) {
    const fallback = await supabase
      .from(meta.tableName)
      .select(meta.legacySelect)
      .eq('site_id', siteId)
      .order('slot_datetime', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallback.error) {
      throw fallback.error;
    }

    return fallback.data ? normalizeReading(fallback.data, siteType) : null;
  }

  if (error) {
    throw error;
  }

  return data ? normalizeReading(data, siteType) : null;
}

export async function getLatestNonZeroReadingValue({ siteId, siteType, field, beforeSlotIso }) {
  const meta = READING_META[siteType];

  if (!meta || !siteId || !field) {
    return null;
  }

  let query = supabase
    .from(meta.tableName)
    .select(`${field}, slot_datetime`)
    .eq('site_id', siteId)
    .not(field, 'is', null)
    .neq(field, 0)
    .order('slot_datetime', { ascending: false })
    .limit(1);

  if (beforeSlotIso) {
    query = query.lt('slot_datetime', beforeSlotIso);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  const value = data?.[field];
  const parsed = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listReadings({ siteId, siteType, fromDate, toDate, limit, includeAll = false }) {
  if (includeAll && READING_META[siteType]) {
    return fetchAllReadingsForType({ siteType, siteId, fromDate, toDate });
  }

  if (includeAll) {
    const rows = await Promise.all([
      fetchAllReadingsForType({ siteType: 'CHLORINATION', siteId, fromDate, toDate }),
      fetchAllReadingsForType({ siteType: 'DEEPWELL', siteId, fromDate, toDate }),
    ]);

    return rows
      .flat()
      .sort((a, b) => new Date(b.reading_datetime || 0).getTime() - new Date(a.reading_datetime || 0).getTime());
  }

  if (siteType === 'CHLORINATION') {
    let { data, error } = await applyReadingFilters(
      supabase.from('chlorination_readings').select(READING_META.CHLORINATION.listSelect),
      { siteId, fromDate, toDate, limit }
    );

    if (error && isMissingOptionalColumnError(error)) {
      const fallback = await applyReadingFilters(
        supabase.from('chlorination_readings').select(READING_META.CHLORINATION.legacyListSelect),
        { siteId, fromDate, toDate, limit }
      );
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => normalizeReading(row, 'CHLORINATION'));
  }

  if (siteType === 'DEEPWELL') {
    let { data, error } = await applyReadingFilters(
      supabase.from('deepwell_readings').select(READING_META.DEEPWELL.listSelect),
      { siteId, fromDate, toDate, limit }
    );

    if (error && isMissingOptionalColumnError(error)) {
      const fallback = await applyReadingFilters(
        supabase.from('deepwell_readings').select(READING_META.DEEPWELL.legacyListSelect),
        { siteId, fromDate, toDate, limit }
      );
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => normalizeReading(row, 'DEEPWELL'));
  }

  let [chlorinationResult, deepwellResult] = await Promise.all([
    applyReadingFilters(
      supabase.from('chlorination_readings').select(READING_META.CHLORINATION.listSelect),
      { siteId, fromDate, toDate, limit }
    ),
    applyReadingFilters(
      supabase.from('deepwell_readings').select(READING_META.DEEPWELL.listSelect),
      { siteId, fromDate, toDate, limit }
    ),
  ]);

  if (chlorinationResult.error && isMissingOptionalColumnError(chlorinationResult.error)) {
    chlorinationResult = await applyReadingFilters(
      supabase.from('chlorination_readings').select(READING_META.CHLORINATION.legacyListSelect),
      { siteId, fromDate, toDate, limit }
    );
  }

  if (deepwellResult.error && isMissingOptionalColumnError(deepwellResult.error)) {
    deepwellResult = await applyReadingFilters(
      supabase.from('deepwell_readings').select(READING_META.DEEPWELL.legacyListSelect),
      { siteId, fromDate, toDate, limit }
    );
  }

  if (chlorinationResult.error) {
    throw chlorinationResult.error;
  }

  if (deepwellResult.error) {
    throw deepwellResult.error;
  }

  return [
    ...(chlorinationResult.data ?? []).map((row) => normalizeReading(row, 'CHLORINATION')),
    ...(deepwellResult.data ?? []).map((row) => normalizeReading(row, 'DEEPWELL')),
  ]
    .sort((a, b) => new Date(b.reading_datetime || 0).getTime() - new Date(a.reading_datetime || 0).getTime())
    .slice(0, typeof limit === 'number' && Number.isFinite(limit) ? limit : undefined);
}

export async function listDailySiteSummaries({ siteId, siteType, fromDate, toDate, limit, includeAll = false } = {}) {
  if (includeAll) {
    return fetchAllDailySiteSummaries({ siteId, siteType, fromDate, toDate });
  }

  const { data, error } = await applyDailySummaryFilters(
    supabase.from('daily_site_summaries').select(DAILY_SUMMARY_SELECT),
    { siteId, fromDate, toDate, limit }
  );

  if (error) {
    throw error;
  }

  const normalizedSiteType = String(siteType || '').toUpperCase();

  return (data ?? [])
    .filter((row) => {
      if (!normalizedSiteType) {
        return true;
      }

      return String(row?.site?.type || '').toUpperCase() === normalizedSiteType;
    })
    .map((row) => ({
      ...row,
      site_type: row?.site?.type,
    }));
}

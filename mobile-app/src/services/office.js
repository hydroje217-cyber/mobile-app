import { supabase } from '../lib/supabase';
import * as ExpoLinking from 'expo-linking';
import {
  buildDailyProduction,
  buildMonthlyChemicalUsage,
  buildMonthlyProduction,
  buildMonthlyPowerConsumption,
  createDayKey,
  startOfMonthlyProductionSourceIso,
} from '../utils/production';

const DAILY_SUMMARY_SELECT =
  'id, site_id, summary_date, source, source_file, production_m3, power_kwh, chlorine_kg, peroxide_liters, site:sites(id, name, type)';
const PROFILE_SELECT = 'id, email, full_name, role, is_active, is_approved, approved_at, created_at, last_seen_at';
const LOGIN_LOG_SELECT = 'id, user_id, email, role, browser, device, user_agent, created_at, profile:profiles(full_name, email)';
const BASIC_LOGIN_LOG_SELECT = 'id, user_id, email, role, browser, device, user_agent, created_at';
const PASSWORD_RESET_REQUEST_SELECT = 'id, email, status, requested_at, reviewed_at, reviewed_by, reset_sent_at, created_at';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured yet.');
  }
}

function throwIfError(result, fallbackMessage) {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }
}

function isMissingColumnError(error) {
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /column .* does not exist/i.test(error?.message || '') ||
    /could not find .* column/i.test(error?.message || '')
  );
}

function isMissingRelationError(error) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist/i.test(error?.message || '') ||
    /could not find .* table/i.test(error?.message || '')
  );
}

function getPasswordResetRedirectUrl() {
  return ExpoLinking.createURL('reset-password');
}

async function fetchLoginLogs({ includeLoginLogs }) {
  if (!includeLoginLogs) {
    return { data: [], error: null };
  }

  const fullResult = await supabase
    .from('account_login_logs')
    .select(LOGIN_LOG_SELECT)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!fullResult.error) {
    return fullResult;
  }

  if (!isMissingColumnError(fullResult.error)) {
    return fullResult;
  }

  const basicResult = await supabase
    .from('account_login_logs')
    .select(BASIC_LOGIN_LOG_SELECT)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!basicResult.error) {
    return basicResult;
  }

  if (!isMissingColumnError(basicResult.error)) {
    return basicResult;
  }

  const legacyResult = await supabase
    .from('account_login_logs')
    .select('*')
    .limit(30);

  if (!legacyResult.error) {
    return {
      data: [...(legacyResult.data ?? [])].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ),
      error: null,
    };
  }

  return isMissingColumnError(legacyResult.error)
    ? { data: [], error: null }
    : legacyResult;
}

async function fetchPasswordResetRequests({ includeRequests }) {
  if (!includeRequests) {
    return { data: [], error: null };
  }

  const result = await supabase
    .from('password_reset_requests')
    .select(PASSWORD_RESET_REQUEST_SELECT)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(30);

  return isMissingRelationError(result.error) ? { data: [], error: null } : result;
}

function startOfTodayIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

function startOfPreviousNightIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23);
  return start.toISOString();
}

function startOfTomorrowIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return start.toISOString();
}

function normalizeOfficeReading(row, siteType) {
  return {
    ...row,
    site_type: siteType,
  };
}

function sortByCreatedAtDesc(a, b) {
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}

function getLoginLogTimestamp(row = {}) {
  return (
    row.created_at ||
    row.logged_in_at ||
    row.login_at ||
    row.login_time ||
    row.timestamp ||
    row.inserted_at ||
    row.updated_at ||
    null
  );
}

function getBrowserFromUserAgent(userAgent = '') {
  if (!userAgent) {
    return '';
  }

  if (userAgent.includes('Edg/')) {
    return 'Microsoft Edge';
  }

  if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
    return 'Opera';
  }

  if (userAgent.includes('Firefox/')) {
    return 'Firefox';
  }

  if (userAgent.includes('Chrome/') || userAgent.includes('CriOS/')) {
    return 'Chrome';
  }

  if (userAgent.includes('Safari/')) {
    return 'Safari';
  }

  return 'Browser';
}

function getDeviceFromUserAgent(userAgent = '') {
  if (!userAgent) {
    return '';
  }

  if (/iPad/i.test(userAgent)) {
    return 'iPad';
  }

  if (/iPhone/i.test(userAgent)) {
    return 'iPhone';
  }

  if (/Android/i.test(userAgent)) {
    return /Mobile/i.test(userAgent) ? 'Android phone' : 'Android tablet';
  }

  if (/Windows/i.test(userAgent)) {
    return 'Windows desktop';
  }

  if (/Macintosh|Mac OS/i.test(userAgent)) {
    return 'Mac desktop';
  }

  if (/Linux/i.test(userAgent)) {
    return 'Linux desktop';
  }

  return 'Device';
}

function normalizeLoginLog(row = {}) {
  const userAgent = row.user_agent || row.userAgent || row.ua || '';

  return {
    ...row,
    email: row.email || row.profile?.email || '',
    role: row.role || row.profile?.role || 'operator',
    browser: row.browser || getBrowserFromUserAgent(userAgent),
    device: row.device || getDeviceFromUserAgent(userAgent),
    user_agent: userAgent,
    created_at: getLoginLogTimestamp(row),
  };
}

function getMonthProductionRange({ year, monthIndex }) {
  const today = new Date();
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const chartEnd = monthStart > today ? monthEnd : monthEnd > today ? today : monthEnd;
  const previousDayStart = new Date(year, monthIndex, 0);
  const nextMonthStart = new Date(year, monthIndex + 1, 1);

  return {
    monthStart,
    chartEnd,
    readingFromIso: previousDayStart.toISOString(),
    readingToIso: nextMonthStart.toISOString(),
    summaryFromDate: createDayKey(monthStart),
    summaryToDate: createDayKey(monthEnd),
  };
}

function getYearAnalyticsRange(year) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const chartEnd = year === currentYear ? today : yearEnd;
  const previousDayStart = new Date(year, 0, 0);
  const nextYearStart = new Date(year + 1, 0, 1);
  const monthCount = year === currentYear ? today.getMonth() + 1 : 12;

  return {
    chartEnd,
    monthCount,
    readingFromIso: previousDayStart.toISOString(),
    readingToIso: nextYearStart.toISOString(),
    summaryFromDate: createDayKey(yearStart),
    summaryToDate: createDayKey(yearEnd),
  };
}

export async function getMonthlyAnalyticsForYear({ year }) {
  requireSupabase();

  const parsedYear = Number(year);

  if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 9999) {
    throw new Error('Choose a valid year.');
  }

  const range = getYearAnalyticsRange(parsedYear);
  const [chlorinationReadingsResult, deepwellReadingsResult, summariesResult] = await Promise.all([
    supabase
      .from('chlorination_readings')
      .select('id, site_id, status, created_at, reading_datetime, slot_datetime, totalizer, chlorine_consumed, peroxide_consumption, chlorination_power_kwh')
      .gte('reading_datetime', range.readingFromIso)
      .lt('reading_datetime', range.readingToIso)
      .order('reading_datetime', { ascending: true }),
    supabase
      .from('deepwell_readings')
      .select('id, site_id, status, created_at, reading_datetime, slot_datetime, power_kwh_shift')
      .gte('reading_datetime', range.readingFromIso)
      .lt('reading_datetime', range.readingToIso)
      .order('reading_datetime', { ascending: true }),
    supabase
      .from('daily_site_summaries')
      .select(DAILY_SUMMARY_SELECT)
      .gte('summary_date', range.summaryFromDate)
      .lte('summary_date', range.summaryToDate)
      .order('summary_date', { ascending: true }),
  ]);

  throwIfError(chlorinationReadingsResult, 'Failed to load selected year chlorination readings.');
  throwIfError(deepwellReadingsResult, 'Failed to load selected year deepwell readings.');
  throwIfError(summariesResult, 'Failed to load selected year daily summaries.');

  const dailySummaries = summariesResult.data ?? [];
  const chlorinationReadings = chlorinationReadingsResult.data ?? [];
  const deepwellReadings = deepwellReadingsResult.data ?? [];
  const options = {
    now: range.chartEnd,
    monthCount: range.monthCount,
    dailySummaries,
  };

  return {
    monthlyProduction: buildMonthlyProduction(chlorinationReadings, options),
    monthlyChemicalUsage: buildMonthlyChemicalUsage(chlorinationReadings, options),
    monthlyPowerConsumption: buildMonthlyPowerConsumption({
      chlorinationReadings,
      deepwellReadings,
    }, options),
  };
}

export async function getDailyProductionForMonth({ year, monthIndex }) {
  requireSupabase();

  const parsedYear = Number(year);
  const parsedMonthIndex = Number(monthIndex);

  if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonthIndex) || parsedMonthIndex < 0 || parsedMonthIndex > 11) {
    throw new Error('Choose a valid month and year.');
  }

  const range = getMonthProductionRange({ year: parsedYear, monthIndex: parsedMonthIndex });
  const [readingsResult, summariesResult] = await Promise.all([
    supabase
      .from('chlorination_readings')
      .select('id, site_id, status, created_at, reading_datetime, slot_datetime, totalizer')
      .gte('reading_datetime', range.readingFromIso)
      .lt('reading_datetime', range.readingToIso)
      .order('reading_datetime', { ascending: true }),
    supabase
      .from('daily_site_summaries')
      .select(DAILY_SUMMARY_SELECT)
      .gte('summary_date', range.summaryFromDate)
      .lte('summary_date', range.summaryToDate)
      .order('summary_date', { ascending: true }),
  ]);

  throwIfError(readingsResult, 'Failed to load selected month production readings.');
  throwIfError(summariesResult, 'Failed to load selected month daily summaries.');

  return buildDailyProduction(readingsResult.data ?? [], {
    now: range.chartEnd,
    dailySummaries: summariesResult.data ?? [],
  });
}

export async function getOfficeDashboardSnapshot({ limit = 12, includeLoginLogs = false } = {}) {
  requireSupabase();

  const todayIso = startOfTodayIso();
  const slotQueryStartIso = startOfPreviousNightIso();
  const tomorrowIso = startOfTomorrowIso();
  const [
    pendingApprovalsResult,
    totalOperatorsResult,
    approvedOperatorsResult,
    sitesResult,
    todayChlorinationReadingsResult,
    todayDeepwellReadingsResult,
    recentChlorinationReadingsResult,
    recentDeepwellReadingsResult,
    todayChlorinationSlotsResult,
    todayDeepwellSlotsResult,
    profilesResult,
    loginLogsResult,
    passwordResetRequestsResult,
    monthlyChlorinationReadingsResult,
    monthlyDeepwellReadingsResult,
    dailySummariesResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, is_approved, created_at, last_seen_at')
      .eq('role', 'operator')
      .eq('is_active', true)
      .eq('is_approved', false)
      .order('created_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'operator'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'operator')
      .eq('is_active', true)
      .eq('is_approved', true),
    supabase
      .from('sites')
      .select('id, name, type')
      .order('type', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('chlorination_readings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayIso),
    supabase
      .from('deepwell_readings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayIso),
    supabase
      .from('chlorination_readings')
      .select(
        'id, status, created_at, reading_datetime, slot_datetime, totalizer, ph, rc_ppm, site:sites(name, type), submitted_profile:profiles!chlorination_readings_submitted_by_fkey(full_name, email)'
      )
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('deepwell_readings')
      .select(
        'id, status, created_at, reading_datetime, slot_datetime, flowrate_m3hr, site:sites(name, type), submitted_profile:profiles!deepwell_readings_submitted_by_fkey(full_name, email)'
      )
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('chlorination_readings')
      .select(
        'id, site_id, status, remarks, created_at, reading_datetime, slot_datetime, totalizer, pressure_psi, rc_ppm, turbidity_ntu, ph, tds_ppm, tank_level_liters, flowrate_m3hr, chlorine_consumed, peroxide_consumption, chlorination_power_kwh, site:sites(id, name, type), submitted_profile:profiles!chlorination_readings_submitted_by_fkey(full_name, email)'
      )
      .gte('slot_datetime', slotQueryStartIso)
      .lt('slot_datetime', tomorrowIso)
      .order('slot_datetime', { ascending: true }),
    supabase
      .from('deepwell_readings')
      .select(
        'id, site_id, status, remarks, created_at, reading_datetime, slot_datetime, upstream_pressure_psi, downstream_pressure_psi, flowrate_m3hr, vfd_frequency_hz, voltage_l1_v, voltage_l2_v, voltage_l3_v, amperage_a, tds_ppm, power_kwh_shift, site:sites(id, name, type), submitted_profile:profiles!deepwell_readings_submitted_by_fkey(full_name, email)'
      )
      .gte('slot_datetime', slotQueryStartIso)
      .lt('slot_datetime', tomorrowIso)
      .order('slot_datetime', { ascending: true }),
    supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .order('created_at', { ascending: false })
      .limit(20),
    fetchLoginLogs({ includeLoginLogs }),
    fetchPasswordResetRequests({ includeRequests: true }),
    supabase
      .from('chlorination_readings')
      .select('id, site_id, status, created_at, reading_datetime, slot_datetime, totalizer, chlorine_consumed, peroxide_consumption, chlorination_power_kwh')
      .gte('reading_datetime', startOfMonthlyProductionSourceIso())
      .order('reading_datetime', { ascending: true }),
    supabase
      .from('deepwell_readings')
      .select('id, site_id, status, created_at, reading_datetime, slot_datetime, power_kwh_shift')
      .gte('reading_datetime', startOfMonthlyProductionSourceIso())
      .order('reading_datetime', { ascending: true }),
    supabase
      .from('daily_site_summaries')
      .select(DAILY_SUMMARY_SELECT)
      .gte('summary_date', startOfMonthlyProductionSourceIso().slice(0, 10))
      .order('summary_date', { ascending: true }),
  ]);

  throwIfError(pendingApprovalsResult, 'Failed to load pending approvals.');
  throwIfError(totalOperatorsResult, 'Failed to count operators.');
  throwIfError(approvedOperatorsResult, 'Failed to count approved operators.');
  throwIfError(sitesResult, 'Failed to load sites.');
  throwIfError(todayChlorinationReadingsResult, 'Failed to count today chlorination readings.');
  throwIfError(todayDeepwellReadingsResult, 'Failed to count today deepwell readings.');
  throwIfError(recentChlorinationReadingsResult, 'Failed to load recent chlorination readings.');
  throwIfError(recentDeepwellReadingsResult, 'Failed to load recent deepwell readings.');
  throwIfError(todayChlorinationSlotsResult, 'Failed to load today chlorination slots.');
  throwIfError(todayDeepwellSlotsResult, 'Failed to load today deepwell slots.');
  throwIfError(profilesResult, 'Failed to load account roles.');
  if (includeLoginLogs) {
    throwIfError(loginLogsResult, 'Failed to load login logs.');
  }
  throwIfError(passwordResetRequestsResult, 'Failed to load password reset requests.');
  throwIfError(monthlyChlorinationReadingsResult, 'Failed to load monthly chlorination production.');
  throwIfError(monthlyDeepwellReadingsResult, 'Failed to load monthly deepwell power consumption.');
  throwIfError(dailySummariesResult, 'Failed to load historical daily summaries.');

  const recentReadings = [
    ...(recentChlorinationReadingsResult.data ?? []).map((row) => normalizeOfficeReading(row, 'CHLORINATION')),
    ...(recentDeepwellReadingsResult.data ?? []).map((row) => normalizeOfficeReading(row, 'DEEPWELL')),
  ]
    .sort(sortByCreatedAtDesc)
    .slice(0, limit);

  const todaySlotReadings = [
    ...(todayChlorinationSlotsResult.data ?? []).map((row) => normalizeOfficeReading(row, 'CHLORINATION')),
    ...(todayDeepwellSlotsResult.data ?? []).map((row) => normalizeOfficeReading(row, 'DEEPWELL')),
  ];

  return {
    stats: {
      totalOperators: totalOperatorsResult.count ?? 0,
      approvedOperators: approvedOperatorsResult.count ?? 0,
      pendingOperators: pendingApprovalsResult.data?.length ?? 0,
      pendingPasswordResets: passwordResetRequestsResult.data?.length ?? 0,
      totalSites: sitesResult.data?.length ?? 0,
      todayReadings: (todayChlorinationReadingsResult.count ?? 0) + (todayDeepwellReadingsResult.count ?? 0),
    },
    pendingApprovals: pendingApprovalsResult.data ?? [],
    passwordResetRequests: passwordResetRequestsResult.data ?? [],
    recentReadings,
    sites: sitesResult.data ?? [],
    todaySlotReadings,
    profiles: profilesResult.data ?? [],
    loginLogs: (loginLogsResult.data ?? []).map(normalizeLoginLog),
    monthlyProduction: buildMonthlyProduction(monthlyChlorinationReadingsResult.data ?? [], {
      dailySummaries: dailySummariesResult.data ?? [],
    }),
    dailyProduction: buildDailyProduction(monthlyChlorinationReadingsResult.data ?? [], {
      dailySummaries: dailySummariesResult.data ?? [],
    }),
    monthlyChemicalUsage: buildMonthlyChemicalUsage(monthlyChlorinationReadingsResult.data ?? [], {
      dailySummaries: dailySummariesResult.data ?? [],
    }),
    monthlyPowerConsumption: buildMonthlyPowerConsumption({
      chlorinationReadings: monthlyChlorinationReadingsResult.data ?? [],
      deepwellReadings: monthlyDeepwellReadingsResult.data ?? [],
    }, {
      dailySummaries: dailySummariesResult.data ?? [],
    }),
  };
}

export async function approveOperatorProfile({ profileId }) {
  requireSupabase();

  const { data, error } = await supabase.rpc('approve_operator_account', {
    target_profile_id: profileId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to approve operator.');
  }

  return data;
}

export async function approvePasswordResetRequest({ requestId, email }) {
  requireSupabase();

  const normalizedEmail = email?.trim()?.toLowerCase();

  if (!requestId || !normalizedEmail) {
    throw new Error('Password reset request is missing an email address.');
  }

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  if (resetError) {
    throw new Error(resetError.message || 'Failed to send password reset email.');
  }

  const { data: userResult } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('password_reset_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userResult?.user?.id || null,
      reset_sent_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select(PASSWORD_RESET_REQUEST_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Reset email sent, but the request could not be marked approved.');
  }

  return data;
}

export async function assignProfileRole({ profileId, nextRole }) {
  requireSupabase();

  const { data, error } = await supabase.rpc('assign_profile_role', {
    target_profile_id: profileId,
    next_role: nextRole,
  });

  if (error) {
    throw new Error(error.message || 'Failed to update account role.');
  }

  return data;
}

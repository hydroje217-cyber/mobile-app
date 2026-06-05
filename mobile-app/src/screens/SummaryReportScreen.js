import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Card from '../components/Card';
import MessageBanner from '../components/MessageBanner';
import ScreenShell from '../components/ScreenShell';
import { useTheme } from '../context/ThemeContext';
import { getOfficeDashboardSnapshot } from '../services/office';
import { getResponsiveMetrics, scaleStyleDefinitions } from '../theme';
import { exportSummaryReportPptx } from '../utils/summaryPptxExport';
import {
  MONTH_SHORT_LABELS,
  REFERENCE_SUMMARY_REPORT_INPUTS,
  buildExportMonthOptions,
  buildSummaryReportPptxArgs,
  formatCurrency,
  formatNumber,
  getCurrentMonthKey,
  getDateKeyFromMonth,
  getDailyDateKeys,
  getFieldStatus,
  getLastDateKeyFromMonth,
  getLatestInputMonth,
  getMonthKey,
  getMonthLabel,
  getMonthlyPower,
  getMonthlyProduction,
  getPowerCostRangeMonthKeys,
  getPreviousMonthKey,
  loadSummaryReportInputs,
  mergeSummaryReportInputs,
  parseNumber,
  saveSummaryReportInputs,
} from '../utils/summaryReportData';

function roundExportNumber(value, decimals = 2) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(decimals)) : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildFileName(extension, periodLabel) {
  const stamp = new Date().toISOString().slice(0, 10);
  const periodSlug = String(periodLabel || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `nemexus-summary-report-${periodSlug ? `${periodSlug}-` : ''}${stamp}.${extension}`;
}

function buildSheetRows(columns, rows) {
  return [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => column.render(row))),
  ];
}

function buildExportSections(payload) {
  return [
    {
      title: 'Export Filters',
      sheetName: 'Filters',
      columns: [
        { label: 'Field', render: (row) => row.field },
        { label: 'Value', render: (row) => row.value },
      ],
      rows: [
        { field: 'Report period', value: payload.reportPeriodLabel },
        { field: 'Report year', value: payload.reportYear },
        { field: 'Daily production total', value: roundExportNumber(payload.selectedDailyProduction?.totalProduction) },
      ],
    },
    {
      title: 'Monthly Production',
      sheetName: 'Production',
      columns: [
        { label: 'Month', render: (row) => row.label || getMonthLabel(row.key) },
        { label: 'Production m3', render: (row) => roundExportNumber(row.production) },
      ],
      rows: payload.monthlyProductionRows,
    },
    {
      title: 'Billed Volume vs NRW',
      sheetName: 'Billed NRW',
      columns: [
        { label: 'Month', render: (row) => row.label },
        { label: 'Production m3', render: (row) => roundExportNumber(row.production) },
        { label: 'Billed Volume m3', render: (row) => roundExportNumber(row.billedVolume) },
        { label: 'NRW m3', render: (row) => roundExportNumber(row.nrw) },
        { label: 'NRW %', render: (row) => roundExportNumber(row.nrwPercent) },
      ],
      rows: payload.billedVolumeRows,
    },
    {
      title: 'Daily Production',
      sheetName: 'Daily',
      columns: [
        { label: 'Date', render: (row) => row.date || row.key },
        { label: 'Production m3', render: (row) => roundExportNumber(row.production) },
      ],
      rows: payload.selectedDailyProduction?.rows ?? [],
    },
    {
      title: 'Power Consumption',
      sheetName: 'Power',
      columns: [
        { label: 'Month', render: (row) => row.label || getMonthLabel(row.key) },
        { label: 'Chlorination kWh', render: (row) => roundExportNumber(row.chlorinationPower) },
        { label: 'Intake kWh', render: (row) => roundExportNumber(row.deepwellPower) },
        { label: 'Total kWh', render: (row) => roundExportNumber(row.totalPower) },
      ],
      rows: payload.powerRows,
    },
    {
      title: 'Electric Bill',
      sheetName: 'Electric Bill',
      columns: [
        { label: 'Month', render: (row) => row.label },
        { label: 'Plant kWh', render: (row) => roundExportNumber(row.combinedConsumption) },
        { label: 'LEYECO kWh', render: (row) => roundExportNumber(row.leyecoConsumption) },
        { label: 'Rate / kWh', render: (row) => roundExportNumber(row.effectiveRate) },
        { label: 'Electric Bill', render: (row) => roundExportNumber(row.electricBill) },
      ],
      rows: payload.electricBillRows,
    },
    {
      title: 'Power Unit Usage',
      sheetName: 'Power Unit',
      columns: [
        { label: 'Month', render: (row) => row.label || getMonthLabel(row.key) },
        { label: 'Power kWh', render: (row) => roundExportNumber(row.power) },
        { label: 'Production m3', render: (row) => roundExportNumber(row.production) },
        { label: 'kWh/m3', render: (row) => roundExportNumber(row.unitUsage, 4) },
      ],
      rows: payload.powerUnitUsageRows,
    },
    {
      title: 'Chemical Usage',
      sheetName: 'Chemical',
      columns: [
        { label: 'Month', render: (row) => row.label || getMonthLabel(row.key) },
        { label: 'Chlorine kg', render: (row) => roundExportNumber(row.chlorineUsage) },
        { label: 'Peroxide L', render: (row) => roundExportNumber(row.peroxideUsage) },
      ],
      rows: payload.chemicalRows,
    },
    {
      title: 'Chlorine Unit Usage',
      sheetName: 'Chlorine Unit',
      columns: [
        { label: 'Month', render: (row) => row.label || getMonthLabel(row.key) },
        { label: 'Chlorine kg', render: (row) => roundExportNumber(row.chemical) },
        { label: 'Production m3', render: (row) => roundExportNumber(row.production) },
        { label: 'kg/m3', render: (row) => roundExportNumber(row.unitUsage, 4) },
      ],
      rows: payload.chlorineUnitUsageRows,
    },
    {
      title: 'Peroxide Unit Usage',
      sheetName: 'Peroxide Unit',
      columns: [
        { label: 'Month', render: (row) => row.label || getMonthLabel(row.key) },
        { label: 'Peroxide L', render: (row) => roundExportNumber(row.chemical) },
        { label: 'Production m3', render: (row) => roundExportNumber(row.production) },
        { label: 'L/m3', render: (row) => roundExportNumber(row.unitUsage, 4) },
      ],
      rows: payload.peroxideUnitUsageRows,
    },
    {
      title: 'Power Cost / SEC',
      sheetName: 'Power Cost SEC',
      columns: [
        { label: 'Month', render: (row) => row.label },
        { label: 'Reading Label', render: (row) => row.dateLabel },
        { label: 'Intake Bill', render: (row) => roundExportNumber(row.intakeBill) },
        { label: 'Chlorination Bill', render: (row) => roundExportNumber(row.chlorinationBill) },
        { label: 'Operating Hours', render: (row) => roundExportNumber(row.operatingHours) },
        { label: 'Production m3', render: (row) => roundExportNumber(row.production) },
        { label: 'Intake kWh', render: (row) => roundExportNumber(row.intakeKwh) },
        { label: 'Chlorination kWh', render: (row) => roundExportNumber(row.chlorinationKwh) },
        { label: 'SEC kWh/m3', render: (row) => roundExportNumber(row.sec, 4) },
        { label: 'Motor Load', render: (row) => roundExportNumber(row.motorLoad, 4) },
      ],
      rows: payload.powerCostRows,
    },
  ];
}

function getChartConfig(section) {
  const chartConfigs = {
    'Monthly Production': { label: 'Month', value: 'Production m3' },
    'Billed Volume vs NRW': { label: 'Month', value: 'Billed Volume m3', secondValue: 'NRW m3' },
    'Daily Production': { label: 'Date', value: 'Production m3' },
    'Power Consumption': { label: 'Month', value: 'Total kWh' },
    'Power Unit Usage': { label: 'Month', value: 'kWh/m3' },
    'Chemical Usage': { label: 'Month', value: 'Chlorine kg', secondValue: 'Peroxide L' },
    'Chlorine Unit Usage': { label: 'Month', value: 'kg/m3' },
    'Peroxide Unit Usage': { label: 'Month', value: 'L/m3' },
    'Power Cost / SEC': { label: 'Month', value: 'SEC kWh/m3', secondValue: 'Motor Load' },
  };

  return chartConfigs[section.title] || null;
}

function getColumnValue(section, row, label) {
  const column = section.columns.find((item) => item.label === label);
  return column ? column.render(row) : '';
}

function buildBarChartHtml(section) {
  const config = getChartConfig(section);
  const rows = (section.rows || []).slice(-18);

  if (!config || !rows.length) {
    return '';
  }

  const primaryValues = rows.map((row) => Number(getColumnValue(section, row, config.value)) || 0);
  const secondaryValues = config.secondValue ? rows.map((row) => Number(getColumnValue(section, row, config.secondValue)) || 0) : [];
  const maxValue = Math.max(...primaryValues, ...secondaryValues, 1);
  const bars = rows.map((row, index) => {
    const label = getColumnValue(section, row, config.label);
    const primary = primaryValues[index];
    const secondary = secondaryValues[index];
    const primaryHeight = Math.max(2, Math.round((primary / maxValue) * 112));
    const secondaryHeight = Math.max(secondary > 0 ? 2 : 0, Math.round((secondary / maxValue) * 112));

    return `
      <div class="bar-slot">
        <div class="bar-stack">
          ${config.secondValue ? `<div class="bar secondary" style="height:${secondaryHeight}px"></div>` : ''}
          <div class="bar primary" style="height:${primaryHeight}px"></div>
        </div>
        <div class="bar-label">${escapeHtml(label)}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="chart">
      <div class="chart-bars">${bars}</div>
      <div class="legend">
        <span><i class="swatch primary"></i>${escapeHtml(config.value)}</span>
        ${config.secondValue ? `<span><i class="swatch secondary"></i>${escapeHtml(config.secondValue)}</span>` : ''}
      </div>
    </div>
  `;
}

function buildPdfDocument(sections, payload) {
  const sectionHtml = sections.map((section) => {
    const head = section.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
    const body = section.rows.map((row) => {
      const cells = section.columns.map((column) => `<td>${escapeHtml(column.render(row))}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<section><h2>${escapeHtml(section.title)}</h2>${buildBarChartHtml(section)}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Helvetica, Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          .meta { margin: 0 0 18px; color: #475569; font-size: 12px; }
          section { margin-top: 20px; page-break-inside: avoid; }
          h2 { margin: 0 0 10px; font-size: 16px; }
          .chart { border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px; margin-bottom: 10px; }
          .chart-bars { height: 146px; display: flex; gap: 6px; align-items: flex-end; border-bottom: 1px solid #94a3b8; padding: 0 4px 6px; }
          .bar-slot { flex: 1; min-width: 0; text-align: center; }
          .bar-stack { height: 118px; display: flex; align-items: flex-end; justify-content: center; gap: 2px; }
          .bar { width: 9px; border-radius: 2px 2px 0 0; display: inline-block; }
          .bar.primary, .swatch.primary { background: #0f766e; }
          .bar.secondary, .swatch.secondary { background: #f59e0b; }
          .bar-label { margin-top: 4px; color: #475569; font-size: 6px; line-height: 8px; overflow-wrap: anywhere; }
          .legend { display: flex; gap: 14px; justify-content: center; color: #475569; font-size: 9px; margin-top: 7px; }
          .swatch { width: 11px; height: 7px; display: inline-block; margin-right: 4px; border: 1px solid rgba(15,23,42,0.15); }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; word-wrap: break-word; }
          th { background: #0f766e; color: #ffffff; font-weight: 700; }
          tr:nth-child(even) td { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>NemeXus Summary Report</h1>
        <p class="meta">${escapeHtml(payload.reportPeriodLabel)} | Generated ${escapeHtml(new Date().toLocaleString('en-US'))}</p>
        ${sectionHtml}
      </body>
    </html>
  `;
}

function getCompactMonthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey || '-';
  }

  return `${MONTH_SHORT_LABELS[month - 1]}-${String(year).slice(-2)}`;
}

function MonthSelect({ label, value, options, onChange, styles, pickerId, openPickerId, onOpenChange, reportInputs, requiredFields = [] }) {
  const open = openPickerId === pickerId;
  const selectedOption = options.find((option) => option.key === value);
  const selectedYear = Number(String(value || '').slice(0, 4)) || new Date().getFullYear();
  const [viewYear, setViewYear] = useState(selectedYear);
  const availableYears = [...new Set(options.map((option) => Number(String(option.key).slice(0, 4))).filter(Number.isFinite))].sort((a, b) => a - b);
  const currentYearIndex = availableYears.indexOf(viewYear);
  const previousYear = currentYearIndex > 0 ? availableYears[currentYearIndex - 1] : null;
  const nextYear = currentYearIndex >= 0 && currentYearIndex < availableYears.length - 1 ? availableYears[currentYearIndex + 1] : null;
  const optionKeys = new Set(options.map((option) => option.key));

  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  return (
    <View style={[styles.filterBlock, open && styles.filterBlockOpen]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Pressable
        onPress={() => onOpenChange(open ? '' : pickerId)}
        style={({ pressed }) => [styles.monthTrigger, open && styles.monthTriggerOpen, pressed && styles.pressed]}
      >
        <Text style={styles.monthTriggerText}>{selectedOption ? getCompactMonthLabel(selectedOption.key) : getCompactMonthLabel(value)}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color="#0F766E" />
      </Pressable>
      {open ? (
        <View style={styles.monthDropdown}>
          <View style={styles.monthPickerHeader}>
            <Pressable
              disabled={!previousYear}
              onPress={() => previousYear && setViewYear(previousYear)}
              style={({ pressed }) => [styles.monthYearButton, !previousYear && styles.monthYearButtonDisabled, pressed && previousYear && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={16} color="#BFEAF0" />
            </Pressable>
            <Text style={styles.monthYearTitle}>{viewYear}</Text>
            <Pressable
              disabled={!nextYear}
              onPress={() => nextYear && setViewYear(nextYear)}
              style={({ pressed }) => [styles.monthYearButton, !nextYear && styles.monthYearButtonDisabled, pressed && nextYear && styles.pressed]}
            >
              <Ionicons name="chevron-forward" size={16} color="#BFEAF0" />
            </Pressable>
          </View>
          <View style={styles.monthGridPanel}>
            {MONTH_SHORT_LABELS.map((monthLabel, monthIndex) => {
              const monthKey = `${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`;
              const active = monthKey === value;
              const disabled = !optionKeys.has(monthKey);
              const status = requiredFields.length ? getFieldStatus(reportInputs?.[monthKey] ?? {}, requiredFields) : '';

              return (
                <Pressable
                  key={monthKey}
                  disabled={disabled}
                  onPress={() => {
                    onChange(monthKey);
                    onOpenChange('');
                  }}
                  style={({ pressed }) => [
                    styles.monthCell,
                    active && styles.monthCellActive,
                    disabled && styles.monthCellDisabled,
                    pressed && !disabled && styles.pressed,
                  ]}
                >
                  <Text style={[styles.monthCellText, active && styles.monthCellTextActive]}>{monthLabel}</Text>
                  {status ? (
                    <Text style={[styles.monthCellStatus, status === 'added' ? styles.monthCellStatusAdded : styles.monthCellStatusMissing]}>
                      {status === 'added' ? 'ADDED' : 'MISSING'}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatDateDisplay(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);

  if (![year, month, day].every(Number.isFinite)) {
    return dateKey || '-';
  }

  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ExportDateField({ label, value, styles }) {
  return (
    <View style={styles.exportField}>
      <Text style={styles.exportFieldLabel}>{label}</Text>
      <View style={styles.exportDateShell}>
        <TextInput
          value={formatDateDisplay(value)}
          editable={false}
          keyboardType="default"
          placeholder="-"
          placeholderTextColor="#78909C"
          style={styles.exportDateInput}
        />
        <Ionicons name="calendar-outline" size={17} color="#BFEAF0" />
      </View>
    </View>
  );
}

function InputField({ label, value, onChangeText, keyboardType = 'decimal-pad', styles }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value === null || value === undefined ? '' : String(value)}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder="0.00"
        placeholderTextColor="#78909C"
        style={styles.input}
      />
    </View>
  );
}

function ResultPill({ label, value, styles }) {
  return (
    <View style={styles.resultPill}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.resultValue}>{value}</Text>
    </View>
  );
}

function ReportCard({ title, subtitle, iconName, status, children, results, styles }) {
  return (
    <Card style={styles.reportCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={styles.cardIcon}>
            <Ionicons name={iconName} size={16} color="#0F766E" />
          </View>
          <View style={styles.cardTitleCopy}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <View style={[styles.statusPill, status === 'added' ? styles.statusAdded : styles.statusMissing]}>
          <Text style={styles.statusText}>{status === 'added' ? 'Added' : 'Missing'}</Text>
        </View>
      </View>
      {children}
      <View style={styles.resultsGrid}>
        {results.map((item) => <ResultPill key={item.label} label={item.label} value={item.value} styles={styles} />)}
      </View>
    </Card>
  );
}

export default function SummaryReportScreen({ navigation }) {
  const { palette, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => getResponsiveMetrics(width), [width]);
  const styles = useMemo(() => createStyles(palette, isDark, metrics), [isDark, metrics, palette]);
  const [dashboard, setDashboard] = useState(null);
  const [reportInputs, setReportInputs] = useState(REFERENCE_SUMMARY_REPORT_INPUTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingFormat, setExportingFormat] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [openPickerId, setOpenPickerId] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('info');
  const currentYear = new Date().getFullYear();
  const fallbackMonthKey = getMonthKey(currentYear, new Date().getMonth());
  const effectiveInputs = useMemo(() => mergeSummaryReportInputs(REFERENCE_SUMMARY_REPORT_INPUTS, reportInputs), [reportInputs]);
  const exportMonthOptions = useMemo(() => buildExportMonthOptions(dashboard), [dashboard]);
  const compactMonthOptions = exportMonthOptions.slice(-14);
  const dailyDateKeys = useMemo(() => getDailyDateKeys(dashboard), [dashboard]);
  const defaultGraphEndMonthKey = getCurrentMonthKey();
  const defaultPowerCostRange = getPowerCostRangeMonthKeys(effectiveInputs, getPreviousMonthKey(defaultGraphEndMonthKey), defaultGraphEndMonthKey);
  const [selectedMonths, setSelectedMonths] = useState({
    billed: getLatestInputMonth(REFERENCE_SUMMARY_REPORT_INPUTS, ['billedVolume'], fallbackMonthKey),
    electric: getLatestInputMonth(REFERENCE_SUMMARY_REPORT_INPUTS, ['totalPower', 'leyecoConsumption', 'effectiveRate'], fallbackMonthKey),
    powerCost: getLatestInputMonth(REFERENCE_SUMMARY_REPORT_INPUTS, ['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower'], fallbackMonthKey),
  });
  const [exportOptions, setExportOptions] = useState({
    dailyStartDate: getDateKeyFromMonth(defaultGraphEndMonthKey),
    dailyEndDate: getLastDateKeyFromMonth(defaultGraphEndMonthKey),
    graphStartMonthKey: `${currentYear}-01`,
    graphEndMonthKey: defaultGraphEndMonthKey,
    powerCostStartMonthKey: defaultPowerCostRange.startMonthKey,
    powerCostEndMonthKey: defaultPowerCostRange.endMonthKey,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setMessage('');

      try {
        const [storedInputs, snapshot] = await Promise.all([
          loadSummaryReportInputs(),
          getOfficeDashboardSnapshot({ limit: 12, includeLoginLogs: false }),
        ]);

        if (!mounted) {
          return;
        }

        setReportInputs(storedInputs);
        setDashboard(snapshot);
        const mergedInputs = mergeSummaryReportInputs(REFERENCE_SUMMARY_REPORT_INPUTS, storedInputs);
        const latestMonth = getLatestInputMonth(mergedInputs, ['billedVolume'], fallbackMonthKey);
        const dateKeys = getDailyDateKeys(snapshot);
        const lastDate = dateKeys[dateKeys.length - 1] || getLastDateKeyFromMonth(latestMonth);
        const monthOptions = buildExportMonthOptions(snapshot);
        const lastMonth = monthOptions[monthOptions.length - 1]?.key || latestMonth;
        const powerCostRange = getPowerCostRangeMonthKeys(mergedInputs, getPreviousMonthKey(lastMonth), lastMonth);

        setSelectedMonths({
          billed: latestMonth,
          electric: getLatestInputMonth(mergedInputs, ['totalPower', 'leyecoConsumption', 'effectiveRate'], latestMonth),
          powerCost: getLatestInputMonth(mergedInputs, ['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower'], latestMonth),
        });
        setExportOptions({
          dailyStartDate: getDateKeyFromMonth(lastDate.slice(0, 7)),
          dailyEndDate: lastDate,
          graphStartMonthKey: `${String(lastMonth).slice(0, 4)}-01`,
          graphEndMonthKey: lastMonth,
          powerCostStartMonthKey: powerCostRange.startMonthKey,
          powerCostEndMonthKey: powerCostRange.endMonthKey,
        });
      } catch (error) {
        if (mounted) {
          setTone('error');
          setMessage(error?.message || 'Failed to load summary report data.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  function updateMonthInput(monthKey, field, value) {
    setReportInputs((current) => ({
      ...current,
      [monthKey]: {
        ...(current?.[monthKey] ?? {}),
        [field]: value,
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');

    try {
      await saveSummaryReportInputs(effectiveInputs);
      setTone('info');
      setMessage('Summary report inputs saved.');
    } catch (error) {
      setTone('error');
      setMessage(error?.message || 'Failed to save summary report inputs.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(format) {
    if (!dashboard) {
      setTone('info');
      setMessage('Load summary data before exporting.');
      return;
    }

    setExportingFormat(format);
    setMessage(`Preparing ${format.toUpperCase()} summary report...`);
    setTone('info');

    try {
      await saveSummaryReportInputs(effectiveInputs);
      await exportSummaryReportPptx(buildSummaryReportPptxArgs({
        dashboard,
        reportInputs: effectiveInputs,
        exportOptions,
      }));
      setTone('info');
      setMessage('PPTX summary report is ready.');
      setExportMenuOpen(false);
    } catch (error) {
      setTone('error');
      setMessage(error?.message || 'Failed to export summary report.');
    } finally {
      setExportingFormat('');
    }
  }

  const billedRow = effectiveInputs?.[selectedMonths.billed] ?? {};
  const billedVolume = parseNumber(billedRow.billedVolume);
  const billedProduction = getMonthlyProduction(dashboard, selectedMonths.billed) || (billedVolume + parseNumber(billedRow.nrw));
  const nrw = parseNumber(billedRow.nrw) || Math.max(billedProduction - billedVolume, 0);
  const nrwPercent = billedProduction > 0 ? (nrw / billedProduction) * 100 : NaN;
  const electricRow = effectiveInputs?.[selectedMonths.electric] ?? {};
  const plantPowerKwh = parseNumber(electricRow.totalPower);
  const leyecoConsumption = parseNumber(electricRow.leyecoConsumption);
  const effectiveRate = parseNumber(electricRow.effectiveRate);
  const calculatedElectricBill = leyecoConsumption > 0 && effectiveRate > 0
    ? leyecoConsumption * effectiveRate
    : parseNumber(electricRow.electricBill);
  const powerCostRow = effectiveInputs?.[selectedMonths.powerCost] ?? {};
  const monthlyPower = getMonthlyPower(dashboard, selectedMonths.powerCost);
  const powerProduction = parseNumber(powerCostRow.powerCostProduction) || getMonthlyProduction(dashboard, selectedMonths.powerCost);
  const intakeBill = parseNumber(powerCostRow.intakeBill);
  const chlorinationBill = parseNumber(powerCostRow.chlorinationBill);
  const operatingHours = parseNumber(powerCostRow.operatingHours);
  const intakePower = parseNumber(powerCostRow.deepwellPower) || monthlyPower.intakePower;
  const chlorinationPower = parseNumber(powerCostRow.chlorinationPower) || monthlyPower.chlorinationPower;
  const sec = parseNumber(powerCostRow.secOverride) || (powerProduction > 0 ? (intakePower + chlorinationPower) / powerProduction : NaN);
  const motorLoad = parseNumber(powerCostRow.motorLoadOverride) || (operatingHours > 0 ? intakePower / operatingHours : NaN);

  return (
    <ScreenShell
      title="Summary Report"
      subtitle="Inputs and export filters"
      iconName="document-text-outline"
      navigation={navigation}
    >
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable onPress={navigation.goBack} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={18} color={palette.ink900} />
          </Pressable>
          <Pressable
            disabled={loading || saving || Boolean(exportingFormat)}
            onPress={() => setExportMenuOpen((current) => !current)}
            style={({ pressed }) => [styles.exportToggle, exportMenuOpen && styles.exportToggleOpen, pressed && styles.pressed]}
          >
            {exportingFormat ? (
              <ActivityIndicator size="small" color="#BFEAF0" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#BFEAF0" />
            )}
            <Text style={styles.exportToggleText}>{exportingFormat ? 'Exporting...' : 'Export'}</Text>
            <Ionicons name={exportMenuOpen ? 'chevron-up' : 'chevron-down'} size={15} color="#BFEAF0" />
          </Pressable>
        </View>

        {exportMenuOpen && !loading ? (
          <View style={styles.exportPanel}>
            <View style={styles.exportGrid}>
              <ExportDateField label="Daily date from" value={exportOptions.dailyStartDate} styles={styles} onChangeText={(dailyStartDate) => setExportOptions((current) => ({ ...current, dailyStartDate }))} />
              <ExportDateField label="Daily date to" value={exportOptions.dailyEndDate} styles={styles} onChangeText={(dailyEndDate) => setExportOptions((current) => ({ ...current, dailyEndDate }))} />
              <View style={styles.exportField}>
                <MonthSelect pickerId="export-graph-start" openPickerId={openPickerId} onOpenChange={setOpenPickerId} label="Monthly graphs from" value={exportOptions.graphStartMonthKey} options={compactMonthOptions} styles={styles} onChange={(graphStartMonthKey) => setExportOptions((current) => ({ ...current, graphStartMonthKey }))} />
              </View>
              <View style={styles.exportField}>
                <MonthSelect pickerId="export-graph-end" openPickerId={openPickerId} onOpenChange={setOpenPickerId} label="Monthly graphs to" value={exportOptions.graphEndMonthKey} options={compactMonthOptions} styles={styles} onChange={(graphEndMonthKey) => setExportOptions((current) => ({ ...current, graphEndMonthKey }))} />
              </View>
              <View style={styles.exportField}>
                <MonthSelect pickerId="export-power-cost-start" openPickerId={openPickerId} onOpenChange={setOpenPickerId} label="Pages 10-13 from" value={exportOptions.powerCostStartMonthKey} options={compactMonthOptions} styles={styles} onChange={(powerCostStartMonthKey) => setExportOptions((current) => ({ ...current, powerCostStartMonthKey }))} />
              </View>
              <View style={styles.exportField}>
                <MonthSelect pickerId="export-power-cost-end" openPickerId={openPickerId} onOpenChange={setOpenPickerId} label="Pages 10-13 to" value={exportOptions.powerCostEndMonthKey} options={compactMonthOptions} styles={styles} onChange={(powerCostEndMonthKey) => setExportOptions((current) => ({ ...current, powerCostEndMonthKey }))} />
              </View>
            </View>
            <View style={styles.exportActions}>
              <Pressable onPress={() => setExportMenuOpen(false)} style={({ pressed }) => [styles.exportCancelButton, pressed && styles.pressed]}>
                <Text style={styles.exportCancelText}>Cancel</Text>
              </Pressable>
              <Pressable disabled={Boolean(exportingFormat)} onPress={() => handleExport('pptx')} style={({ pressed }) => [styles.exportConfirmButton, pressed && styles.pressed, exportingFormat && styles.disabled]}>
                <Ionicons name="download-outline" size={17} color="#FFFFFF" />
                <Text style={styles.exportConfirmText}>PPTX</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {message ? <MessageBanner tone={tone}>{message}</MessageBanner> : null}

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.teal600} />
            <Text style={styles.loadingText}>Loading summary report data...</Text>
          </View>
        ) : (
          <View style={styles.content}>
            <ReportCard
              title="Page 3 - Billed Volume vs NRW"
              subtitle={getMonthLabel(selectedMonths.billed)}
              iconName="calculator-outline"
              status={getFieldStatus(billedRow, ['billedVolume'])}
              results={[
                { label: 'Production', value: formatNumber(billedProduction) },
                { label: 'NRW', value: formatNumber(nrw) },
                { label: 'NRW %', value: Number.isFinite(nrwPercent) ? `${formatNumber(nrwPercent)}%` : '-' },
              ]}
              styles={styles}
            >
              <MonthSelect pickerId="billed-input" openPickerId={openPickerId} onOpenChange={setOpenPickerId} label="Month-Year" value={selectedMonths.billed} options={compactMonthOptions} reportInputs={effectiveInputs} requiredFields={['billedVolume']} styles={styles} onChange={(billed) => setSelectedMonths((current) => ({ ...current, billed }))} />
              <InputField label="Billed Volume m3" value={billedRow.billedVolume} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.billed, 'billedVolume', value)} />
            </ReportCard>

            <ReportCard
              title="Page 7 - Electric Bill"
              subtitle={getMonthLabel(selectedMonths.electric)}
              iconName="flash-outline"
              status={getFieldStatus(electricRow, ['totalPower', 'leyecoConsumption', 'effectiveRate'])}
              results={[
                { label: 'Plant kWh', value: formatNumber(plantPowerKwh) },
                { label: 'LEYECO kWh', value: formatNumber(leyecoConsumption) },
                { label: 'Rate / kWh', value: effectiveRate > 0 ? formatCurrency(effectiveRate) : '-' },
                { label: 'Electric Bill', value: formatCurrency(calculatedElectricBill) },
              ]}
              styles={styles}
            >
              <MonthSelect pickerId="electric-input" openPickerId={openPickerId} onOpenChange={setOpenPickerId} label="Month-Year" value={selectedMonths.electric} options={compactMonthOptions} reportInputs={effectiveInputs} requiredFields={['totalPower', 'leyecoConsumption', 'effectiveRate']} styles={styles} onChange={(electric) => setSelectedMonths((current) => ({ ...current, electric }))} />
              <View style={styles.dateGrid}>
                <InputField label="Plant kWh" value={electricRow.totalPower} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.electric, 'totalPower', value)} />
                <InputField label="LEYECO kWh" value={electricRow.leyecoConsumption} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.electric, 'leyecoConsumption', value)} />
                <InputField label="Rate / kWh" value={electricRow.effectiveRate} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.electric, 'effectiveRate', value)} />
                <InputField label="Electric Bill" value={calculatedElectricBill || electricRow.electricBill} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.electric, 'electricBill', value)} />
              </View>
            </ReportCard>

            <ReportCard
              title="Pages 10-13 - Power Cost / SEC"
              subtitle={getMonthLabel(selectedMonths.powerCost)}
              iconName="pulse-outline"
              status={getFieldStatus(powerCostRow, ['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower'])}
              results={[
                { label: 'Intake Bill', value: formatCurrency(intakeBill) },
                { label: 'Chlorination Bill', value: formatCurrency(chlorinationBill) },
                { label: 'Intake kWh', value: formatNumber(intakePower) },
                { label: 'Chlorination kWh', value: formatNumber(chlorinationPower) },
                { label: 'SEC', value: Number.isFinite(sec) ? `${formatNumber(sec, 2)} kWh/m3` : '-' },
                { label: 'Motor Load', value: Number.isFinite(motorLoad) ? formatNumber(motorLoad, 2) : '-' },
              ]}
              styles={styles}
            >
              <MonthSelect pickerId="power-cost-input" openPickerId={openPickerId} onOpenChange={setOpenPickerId} label="Month-Year" value={selectedMonths.powerCost} options={compactMonthOptions} reportInputs={effectiveInputs} requiredFields={['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower']} styles={styles} onChange={(powerCost) => setSelectedMonths((current) => ({ ...current, powerCost }))} />
              <View style={styles.dateGrid}>
                <InputField label="Intake Bill" value={powerCostRow.intakeBill} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.powerCost, 'intakeBill', value)} />
                <InputField label="Chlorination Bill" value={powerCostRow.chlorinationBill} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.powerCost, 'chlorinationBill', value)} />
                <InputField label="Operating Hours" value={powerCostRow.operatingHours} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.powerCost, 'operatingHours', value)} />
                <InputField label="Reading Date Label" value={powerCostRow.dateLabel || ''} keyboardType="default" styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.powerCost, 'dateLabel', value)} />
                <InputField label="Production m3" value={powerCostRow.powerCostProduction} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.powerCost, 'powerCostProduction', value)} />
                <InputField label="Intake kWh" value={powerCostRow.deepwellPower} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.powerCost, 'deepwellPower', value)} />
                <InputField label="Chlorination kWh" value={powerCostRow.chlorinationPower} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.powerCost, 'chlorinationPower', value)} />
                <InputField label="SEC" value={powerCostRow.secOverride} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.powerCost, 'secOverride', value)} />
                <InputField label="Motor Load" value={powerCostRow.motorLoadOverride} styles={styles} onChangeText={(value) => updateMonthInput(selectedMonths.powerCost, 'motorLoadOverride', value)} />
              </View>
            </ReportCard>

            <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, saving && styles.disabled]}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="save-outline" size={17} color="#FFFFFF" />}
              <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save inputs'}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScreenShell>
  );
}

function createStyles(palette, isDark, metrics) {
  return StyleSheet.create(scaleStyleDefinitions({
    screen: {
      flex: 1,
      gap: 10,
      minHeight: 0,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    iconButton: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: isDark ? '#101D2A' : '#F8FCFF',
      borderRadius: 8,
    },
    exportToggle: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: isDark ? '#31546C' : '#B8DDF0',
      backgroundColor: isDark ? '#0B1723' : '#F8FCFF',
      paddingHorizontal: 18,
      borderRadius: 8,
    },
    exportToggleOpen: {
      borderColor: isDark ? '#22E4DC' : '#42C7C5',
      backgroundColor: isDark ? '#0F2434' : '#F1FCFB',
    },
    exportToggleText: {
      color: palette.ink900,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    exportPanel: {
      borderWidth: 1,
      borderColor: isDark ? '#31546C' : '#B8DDF0',
      backgroundColor: isDark ? '#102132' : '#F8FCFF',
      padding: 14,
      borderRadius: 8,
      gap: 14,
    },
    exportGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    exportField: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: metrics.width >= 430 ? 190 : 150,
      minWidth: 150,
      gap: 7,
    },
    exportFieldLabel: {
      color: isDark ? '#B9D6E6' : '#496A80',
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    exportDateShell: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderWidth: 1,
      borderColor: isDark ? '#31546C' : '#B8DDF0',
      backgroundColor: isDark ? '#081522' : '#FFFFFF',
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    exportDateInput: {
      flex: 1,
      minWidth: 0,
      color: palette.ink900,
      fontSize: 16,
      fontWeight: '900',
      paddingVertical: 0,
    },
    exportActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 10,
    },
    exportCancelButton: {
      minHeight: 48,
      minWidth: 90,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#31546C' : '#B8DDF0',
      backgroundColor: isDark ? '#081522' : '#FFFFFF',
      borderRadius: 8,
      paddingHorizontal: 14,
    },
    exportCancelText: {
      color: palette.ink900,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    exportConfirmButton: {
      minHeight: 48,
      minWidth: 86,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: palette.teal600,
      borderRadius: 8,
      paddingHorizontal: 14,
    },
    exportConfirmText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    content: {
      gap: 12,
      paddingBottom: 150,
    },
    loadingCard: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: isDark ? '#101D2A' : '#F8FCFF',
      borderRadius: 8,
    },
    loadingText: {
      color: palette.ink700,
      fontSize: 12,
      fontWeight: '800',
    },
    reportCard: {
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    cardTitleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    cardIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#1A655E' : '#B4E5DE',
      backgroundColor: isDark ? '#11312D' : '#E5F5F3',
      borderRadius: 8,
    },
    cardTitleCopy: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      color: palette.ink900,
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 19,
    },
    cardSubtitle: {
      marginTop: 2,
      color: palette.ink600,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
    },
    statusPill: {
      minHeight: 26,
      justifyContent: 'center',
      borderWidth: 1,
      paddingHorizontal: 9,
      borderRadius: 8,
    },
    statusAdded: {
      borderColor: isDark ? '#1C7C66' : '#9ADBCB',
      backgroundColor: isDark ? '#123529' : '#E7FAF2',
    },
    statusMissing: {
      borderColor: isDark ? '#7C5A1C' : '#E8D29A',
      backgroundColor: isDark ? '#352712' : '#FFF8E5',
    },
    statusText: {
      color: palette.ink800,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    filterBlock: {
      position: 'relative',
      gap: 7,
    },
    filterBlockOpen: {
      zIndex: 20,
      elevation: 20,
    },
    monthTrigger: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderWidth: 2,
      borderColor: isDark ? '#244B62' : '#B8DDF0',
      backgroundColor: isDark ? '#102233' : '#FFFFFF',
      paddingHorizontal: 14,
      borderRadius: 12,
    },
    monthTriggerOpen: {
      borderColor: isDark ? '#22E4DC' : '#42C7C5',
      backgroundColor: isDark ? '#102638' : '#F1FCFB',
    },
    monthTriggerText: {
      flex: 1,
      minWidth: 0,
      color: palette.ink900,
      fontSize: 18,
      fontWeight: '900',
    },
    monthDropdown: {
      borderWidth: 1,
      borderColor: isDark ? '#246080' : '#B8DDF0',
      backgroundColor: isDark ? '#081522' : '#F8FCFF',
      padding: 14,
      borderRadius: 10,
      shadowColor: isDark ? '#00D6D0' : '#0F6E91',
      shadowOpacity: isDark ? 0.18 : 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 22,
      zIndex: 22,
    },
    monthPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    monthYearButton: {
      width: 50,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#102033' : '#EEF8FC',
      borderRadius: 8,
    },
    monthYearButtonDisabled: {
      opacity: 0.35,
    },
    monthYearTitle: {
      color: palette.ink900,
      fontSize: 20,
      fontWeight: '900',
      textAlign: 'center',
    },
    monthGridPanel: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    monthCell: {
      width: '31.7%',
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      paddingHorizontal: 8,
      borderRadius: 8,
      gap: 7,
    },
    monthCellActive: {
      borderColor: isDark ? '#22E4DC' : '#42C7C5',
      backgroundColor: isDark ? '#7D8EA3' : '#D7F8F5',
    },
    monthCellDisabled: {
      opacity: 0.35,
    },
    monthCellText: {
      color: palette.ink900,
      fontSize: 16,
      fontWeight: '900',
      textAlign: 'center',
    },
    monthCellTextActive: {
      color: isDark ? '#FFFFFF' : '#064E4B',
    },
    monthCellStatus: {
      fontSize: 11,
      fontWeight: '900',
      textAlign: 'center',
    },
    monthCellStatusAdded: {
      color: isDark ? '#5CFFE4' : '#0F8F7C',
    },
    monthCellStatusMissing: {
      color: isDark ? '#FF9EA8' : '#C0394A',
    },
    dateGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    inputWrap: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 142,
      minWidth: 130,
      gap: 5,
    },
    inputLabel: {
      color: palette.ink700,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    input: {
      minHeight: 42,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: isDark ? '#0D1B28' : '#FFFFFF',
      color: palette.ink900,
      paddingHorizontal: 10,
      borderRadius: 8,
      fontSize: 13,
      fontWeight: '800',
    },
    smallHint: {
      color: palette.ink500,
      fontSize: 10,
      fontWeight: '700',
    },
    resultsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    resultPill: {
      flexGrow: 1,
      flexBasis: 118,
      minHeight: 54,
      borderWidth: 1,
      borderColor: isDark ? '#21475A' : '#CDE6EF',
      backgroundColor: isDark ? '#0F2230' : '#F4FBFE',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 3,
    },
    resultLabel: {
      color: palette.ink600,
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    resultValue: {
      color: palette.ink900,
      fontSize: 15,
      fontWeight: '900',
    },
    saveButton: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: palette.teal600,
      borderRadius: 8,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
    disabled: {
      opacity: 0.6,
    },
    pressed: {
      opacity: 0.82,
      transform: [{ scale: 0.99 }],
    },
  }, metrics, {
    exclude: [
      'screen.flex',
      'content.paddingBottom',
      'dateGrid.flexWrap',
    ],
  }));
}

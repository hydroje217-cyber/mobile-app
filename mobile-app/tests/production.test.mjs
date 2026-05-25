import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'src', 'utils', 'production.js');
const tempDir = await mkdtemp(path.join(tmpdir(), 'nemexus-production-'));
const tempModulePath = path.join(tempDir, 'production.mjs');

try {
  await writeFile(tempModulePath, await readFile(sourcePath, 'utf8'));

  const {
    addShiftYieldToRows,
    aggregateDailyRows,
    buildDailyPowerConsumption,
    buildDailyProduction,
    buildDailyTotalizerRows,
    buildMonthlyChemicalUsage,
    buildMonthlyProduction,
    buildMonthlyPowerConsumption,
    startOfMonthlyProductionSourceIso,
  } = await import(pathToFileURL(tempModulePath).href);

  const readings = [
    { slot_datetime: '2026-01-31T23:30:00.000Z', totalizer: 900, pressure_psi: 40 },
    { slot_datetime: '2026-02-01T08:00:00.000Z', totalizer: 950, pressure_psi: 42 },
    { slot_datetime: '2026-02-01T23:30:00.000Z', totalizer: 980, pressure_psi: 46 },
    { slot_datetime: '2026-02-02T23:30:00.000Z', totalizer: 1030, pressure_psi: 44 },
  ];

  const dailyTotalizerRows = buildDailyTotalizerRows(readings, {
    visibleFromDate: '2026-02-01',
    visibleToDate: '2026-02-02',
  });

  assert.deepEqual(dailyTotalizerRows, [
    { date: '2026-02-01', totalizer: 80 },
    { date: '2026-02-02', totalizer: 50 },
  ]);

  const averageRows = aggregateDailyRows(
    readings,
    [
      { key: 'pressure', field: 'pressure_psi' },
      { key: 'totalizer', field: 'totalizer', aggregate: 'previousDayDifference' },
      { key: 'power', field: 'pressure_psi', aggregate: 'sameDayDifference' },
    ],
    {
      visibleFromDate: '2026-02-01',
      visibleToDate: '2026-02-02',
    }
  );

  assert.equal(averageRows[0].pressure, 44);
  assert.equal(averageRows[0].totalizer, 80);
  assert.equal(averageRows[0].power, 4);
  assert.equal(averageRows[1].pressure, 44);
  assert.equal(averageRows[1].totalizer, 50);
  assert.equal(averageRows[1].power, null);

  const shiftYieldRows = aggregateDailyRows(
    [
      { site_id: 1, slot_datetime: '2026-01-31T22:30:00', power_kwh: 100 },
      { site_id: 1, slot_datetime: '2026-02-01T06:30:00', power_kwh: 130 },
      { site_id: 1, slot_datetime: '2026-02-01T14:30:00', power_kwh: 180 },
      { site_id: 1, slot_datetime: '2026-02-01T22:30:00', power_kwh: 250 },
      { site_id: 2, slot_datetime: '2026-01-31T22:30:00', power_kwh: 500 },
      { site_id: 2, slot_datetime: '2026-02-01T06:30:00', power_kwh: 540 },
      { site_id: 2, slot_datetime: '2026-02-01T14:30:00', power_kwh: 620 },
      { site_id: 2, slot_datetime: '2026-02-01T22:30:00', power_kwh: 700 },
    ],
    [
      { key: 'powerTotal', field: 'power_kwh', aggregate: 'shiftYieldTotal' },
      { key: 'powerC', field: 'power_kwh', aggregate: 'shiftYield', shift: 'c' },
      { key: 'powerA', field: 'power_kwh', aggregate: 'shiftYield', shift: 'a' },
      { key: 'powerB', field: 'power_kwh', aggregate: 'shiftYield', shift: 'b' },
    ],
    {
      visibleFromDate: '2026-02-01',
      visibleToDate: '2026-02-01',
    }
  );

  assert.deepEqual(
    shiftYieldRows.map((row) => [row.date, row.powerC, row.powerA, row.powerB, row.powerTotal]),
    [['2026-02-01', 70, 130, 150, 350]]
  );

  const readingsWithShiftYields = addShiftYieldToRows(
    [
      { id: 'prev-b', site_id: 1, slot_datetime: '2026-01-31T22:30:00', power_kwh: 100 },
      { id: 'c-end', site_id: 1, slot_datetime: '2026-02-01T06:30:00', power_kwh: 130 },
      { id: 'a-mid', site_id: 1, slot_datetime: '2026-02-01T10:30:00', power_kwh: 150 },
      { id: 'a-end', site_id: 1, slot_datetime: '2026-02-01T14:30:00', power_kwh: 180 },
      { id: 'b-end', site_id: 1, slot_datetime: '2026-02-01T22:30:00', power_kwh: 250 },
    ],
    'power_kwh',
    'power_yield'
  );

  assert.deepEqual(
    readingsWithShiftYields.map((row) => [row.id, row.power_yield]),
    [
      ['prev-b', null],
      ['c-end', 30],
      ['a-mid', null],
      ['a-end', 50],
      ['b-end', 70],
    ]
  );

  const noPreviousRows = buildDailyTotalizerRows(readings.slice(1), {
    visibleFromDate: '2026-02-01',
    visibleToDate: '2026-02-01',
  });

  assert.deepEqual(noPreviousRows, [{ date: '2026-02-01', totalizer: null }]);

  const multiSiteRows = buildDailyTotalizerRows(
    [
      { site_id: 1, slot_datetime: '2026-01-31T23:30:00.000Z', totalizer: 1000 },
      { site_id: 2, slot_datetime: '2026-01-31T23:30:00.000Z', totalizer: 5000 },
      { site_id: 1, slot_datetime: '2026-02-01T23:30:00.000Z', totalizer: 1120 },
      { site_id: 2, slot_datetime: '2026-02-01T23:30:00.000Z', totalizer: 5160 },
      { site_id: 1, slot_datetime: '2026-02-02T23:30:00.000Z', totalizer: 1240 },
      { site_id: 2, slot_datetime: '2026-02-02T23:30:00.000Z', totalizer: 90 },
    ],
    {
      visibleFromDate: '2026-02-01',
      visibleToDate: '2026-02-02',
    }
  );

  assert.deepEqual(multiSiteRows, [
    { date: '2026-02-01', totalizer: 280 },
    { date: '2026-02-02', totalizer: 120 },
  ]);

  const monthlyProduction = buildMonthlyProduction(readings, {
    now: new Date('2026-02-28T12:00:00.000Z'),
    monthCount: 2,
  });

  assert.deepEqual(
    monthlyProduction.rows.map((row) => row.key),
    ['2026-02', '2026-01']
  );
  assert.equal(monthlyProduction.rows[0].production, 130);
  assert.equal(monthlyProduction.rows[1].production, 0);
  assert.equal(monthlyProduction.totalProduction, 130);
  assert.equal(monthlyProduction.averageProduction, 130);

  const dailyProduction = buildDailyProduction(readings, {
    now: new Date('2026-02-02T12:00:00.000Z'),
  });

  assert.deepEqual(
    dailyProduction.rows.map((row) => [row.date, row.production]),
    [
      ['2026-02-02', 50],
      ['2026-02-01', 80],
    ]
  );
  assert.equal(dailyProduction.monthLabel, 'February 2026');
  assert.equal(dailyProduction.totalProduction, 130);

  const powerConsumption = buildMonthlyPowerConsumption(
    {
      chlorinationReadings: [
        { slot_datetime: '2026-01-31T22:30:00', chlorination_power_kwh: 100 },
        { slot_datetime: '2026-02-01T06:30:00', chlorination_power_kwh: 130 },
        { slot_datetime: '2026-02-01T14:30:00', chlorination_power_kwh: 180 },
        { slot_datetime: '2026-02-01T22:30:00', chlorination_power_kwh: 250 },
        { slot_datetime: '2026-02-02T06:30:00', chlorination_power_kwh: 280 },
        { slot_datetime: '2026-02-02T14:30:00', chlorination_power_kwh: 330 },
        { slot_datetime: '2026-02-02T22:30:00', chlorination_power_kwh: 380 },
      ],
      deepwellReadings: [
        { slot_datetime: '2026-01-31T22:30:00', power_kwh_shift: 500 },
        { slot_datetime: '2026-02-01T06:30:00', power_kwh_shift: 540 },
        { slot_datetime: '2026-02-01T14:30:00', power_kwh_shift: 620 },
        { slot_datetime: '2026-02-01T22:30:00', power_kwh_shift: 700 },
        { slot_datetime: '2026-02-02T06:30:00', power_kwh_shift: 760 },
        { slot_datetime: '2026-02-02T14:30:00', power_kwh_shift: 810 },
        { slot_datetime: '2026-02-02T22:30:00', power_kwh_shift: 850 },
      ],
    },
    {
      now: new Date('2026-02-28T12:00:00.000Z'),
      monthCount: 2,
    }
  );

  assert.deepEqual(
    powerConsumption.rows.map((row) => row.key),
    ['2026-02', '2026-01']
  );
  assert.equal(powerConsumption.rows[0].chlorinationPower, 280);
  assert.equal(powerConsumption.rows[0].deepwellPower, 350);
  assert.equal(powerConsumption.rows[0].totalPower, 630);
  assert.equal(powerConsumption.totalPower, 630);

  const chemicalUsage = buildMonthlyChemicalUsage(
    [
      { slot_datetime: '2026-02-01T08:00:00.000Z', chlorine_consumed: 4, peroxide_consumption: 1.5 },
      { slot_datetime: '2026-02-01T16:00:00.000Z', chlorine_consumed: 5, peroxide_consumption: 1.25 },
      { slot_datetime: '2026-02-02T16:00:00.000Z', chlorine_consumed: 6, peroxide_consumption: 2 },
    ],
    {
      now: new Date('2026-02-28T12:00:00.000Z'),
      monthCount: 2,
    }
  );

  assert.deepEqual(
    chemicalUsage.rows.map((row) => row.key),
    ['2026-02', '2026-01']
  );
  assert.equal(chemicalUsage.rows[0].chlorineUsage, 15);
  assert.equal(chemicalUsage.rows[0].peroxideUsage, 4.75);
  assert.equal(chemicalUsage.rows[0].totalUsage, 19.75);
  assert.equal(chemicalUsage.totalChlorine, 15);
  assert.equal(chemicalUsage.totalPeroxide, 4.75);

  const historicalSummaries = [
    {
      summary_date: '2026-02-01',
      production_m3: 999,
      power_kwh: 70,
      chlorine_kg: 3,
      peroxide_liters: 1,
      site: { type: 'CHLORINATION' },
    },
    {
      summary_date: '2026-02-03',
      production_m3: 65,
      power_kwh: 80,
      chlorine_kg: 5,
      peroxide_liters: 2,
      site: { type: 'CHLORINATION' },
    },
    {
      summary_date: '2026-02-03',
      power_kwh: 125,
      site: { type: 'DEEPWELL' },
    },
  ];

  const productionWithSummaries = buildDailyProduction(readings, {
    now: new Date('2026-02-03T12:00:00.000Z'),
    dailySummaries: historicalSummaries,
  });

  assert.deepEqual(
    productionWithSummaries.rows.map((row) => [row.date, row.production]),
    [
      ['2026-02-03', 65],
      ['2026-02-02', 50],
      ['2026-02-01', 80],
    ]
  );

  const monthlyProductionWithSummaries = buildMonthlyProduction(readings, {
    now: new Date('2026-02-28T12:00:00.000Z'),
    monthCount: 2,
    dailySummaries: historicalSummaries,
  });

  assert.equal(monthlyProductionWithSummaries.rows[0].production, 195);
  assert.equal(monthlyProductionWithSummaries.totalProduction, 195);

  const monthlyPowerWithSummaries = buildMonthlyPowerConsumption(
    {
      chlorinationReadings: [
        { slot_datetime: '2026-01-31T22:30:00', chlorination_power_kwh: 100 },
        { slot_datetime: '2026-02-01T06:30:00', chlorination_power_kwh: 110 },
        { slot_datetime: '2026-02-01T14:30:00', chlorination_power_kwh: 125 },
        { slot_datetime: '2026-02-01T22:30:00', chlorination_power_kwh: 140 },
      ],
      deepwellReadings: [
        { slot_datetime: '2026-01-31T22:30:00', power_kwh_shift: 500 },
        { slot_datetime: '2026-02-01T06:30:00', power_kwh_shift: 510 },
        { slot_datetime: '2026-02-01T14:30:00', power_kwh_shift: 525 },
        { slot_datetime: '2026-02-01T22:30:00', power_kwh_shift: 540 },
      ],
    },
    {
      now: new Date('2026-02-28T12:00:00.000Z'),
      monthCount: 1,
      dailySummaries: historicalSummaries,
    }
  );

  assert.equal(monthlyPowerWithSummaries.rows[0].chlorinationPower, 150);
  assert.equal(monthlyPowerWithSummaries.rows[0].deepwellPower, 165);
  assert.equal(monthlyPowerWithSummaries.totalPower, 315);

  const dailyPowerWithSummaries = buildDailyPowerConsumption(
    {
      chlorinationReadings: [],
      deepwellReadings: [],
    },
    {
      now: new Date('2026-02-03T12:00:00.000Z'),
      dailySummaries: historicalSummaries,
    }
  );

  assert.deepEqual(
    dailyPowerWithSummaries.rows.map((row) => [row.date, row.chlorinationPower, row.deepwellPower]),
    [
      ['2026-02-03', 80, 125],
      ['2026-02-02', 0, 0],
      ['2026-02-01', 70, 0],
    ]
  );

  const chemicalUsageWithSummaries = buildMonthlyChemicalUsage([], {
    now: new Date('2026-02-28T12:00:00.000Z'),
    monthCount: 1,
    dailySummaries: historicalSummaries,
  });

  assert.equal(chemicalUsageWithSummaries.rows[0].chlorineUsage, 8);
  assert.equal(chemicalUsageWithSummaries.rows[0].peroxideUsage, 3);

  assert.equal(
    startOfMonthlyProductionSourceIso({
      now: new Date('2026-02-15T12:00:00.000Z'),
      monthCount: 2,
    }),
    new Date(2025, 11, 31).toISOString()
  );

  console.log('production utility tests passed');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

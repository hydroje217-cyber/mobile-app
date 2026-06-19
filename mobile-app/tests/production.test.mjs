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
    addSlotProductionToRows,
    aggregateDailyRows,
    buildDailyPowerConsumption,
    buildDailyProduction,
    buildDailyTotalizerProductionRows,
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

  const slotProductionReadings = [
    { site_id: 1, slot_datetime: '2026-01-31T23:00:00', totalizer: 62121.3 },
    { site_id: 1, slot_datetime: '2026-02-01T07:00:00', totalizer: 62174.7 },
    { site_id: 1, slot_datetime: '2026-02-01T15:00:00', totalizer: 62351.1 },
    { site_id: 1, slot_datetime: '2026-02-01T23:00:00', totalizer: 62564.9 },
    { site_id: 1, slot_datetime: '2026-02-01T23:30:00', totalizer: 62579.6 },
  ];
  const slotProductionRows = aggregateDailyRows(
    slotProductionReadings,
    [
      { key: 'productionTotal', field: 'totalizer', aggregate: 'slotProductionTotal' },
      { key: 'productionA', field: 'totalizer', aggregate: 'slotProduction', shift: 'a' },
      { key: 'productionB', field: 'totalizer', aggregate: 'slotProduction', shift: 'b' },
      { key: 'productionC', field: 'totalizer', aggregate: 'slotProduction', shift: 'c' },
    ],
    {
      visibleFromDate: '2026-02-01',
      visibleToDate: '2026-02-01',
    }
  );

  assert.deepEqual(
    slotProductionRows.map((row) => [
      row.date,
      Number(row.productionA.toFixed(1)),
      Number(row.productionB.toFixed(1)),
      Number(row.productionC.toFixed(1)),
      Number(row.productionTotal.toFixed(1)),
    ]),
    [['2026-02-01', 53.4, 176.4, 213.8, 443.6]]
  );
  assert.deepEqual(
    buildDailyTotalizerProductionRows(slotProductionReadings, {
      visibleFromDate: '2026-02-01',
      visibleToDate: '2026-02-01',
    }).map((row) => ({ ...row, totalizer: Number(row.totalizer.toFixed(1)) })),
    [{ date: '2026-02-01', totalizer: 443.6 }]
  );
  assert.deepEqual(
    addSlotProductionToRows(slotProductionReadings, 'totalizer', 'production_m3').map((row) => [
      row.slot_datetime,
      row.production_m3 === null ? null : Number(row.production_m3.toFixed(1)),
    ]),
    [
      ['2026-01-31T23:00:00', null],
      ['2026-02-01T07:00:00', 53.4],
      ['2026-02-01T15:00:00', 176.4],
      ['2026-02-01T23:00:00', 213.8],
      ['2026-02-01T23:30:00', null],
    ]
  );

  const zeroFallbackProductionReadings = [
    { site_id: 1, slot_datetime: '2026-01-31T23:00:00', totalizer: 1000 },
    { site_id: 1, slot_datetime: '2026-02-01T07:00:00', totalizer: 1100 },
    { site_id: 1, slot_datetime: '2026-02-01T15:00:00', totalizer: 0 },
    { site_id: 1, slot_datetime: '2026-02-01T23:00:00', totalizer: 0 },
    { site_id: 2, slot_datetime: '2026-01-31T23:00:00', totalizer: 5000 },
    { site_id: 2, slot_datetime: '2026-02-01T07:00:00', totalizer: 0 },
    { site_id: 2, slot_datetime: '2026-02-01T15:00:00', totalizer: 5100 },
    { site_id: 2, slot_datetime: '2026-02-01T23:00:00', totalizer: 5200 },
  ];
  const zeroFallbackProductionRows = aggregateDailyRows(
    zeroFallbackProductionReadings,
    [
      { key: 'productionTotal', field: 'totalizer', aggregate: 'slotProductionTotal' },
      { key: 'productionA', field: 'totalizer', aggregate: 'slotProduction', shift: 'a' },
      { key: 'productionB', field: 'totalizer', aggregate: 'slotProduction', shift: 'b' },
      { key: 'productionC', field: 'totalizer', aggregate: 'slotProduction', shift: 'c' },
    ],
    {
      visibleFromDate: '2026-02-01',
      visibleToDate: '2026-02-01',
    }
  );

  assert.deepEqual(
    zeroFallbackProductionRows.map((row) => [row.date, row.productionA, row.productionB, row.productionC, row.productionTotal]),
    [['2026-02-01', 100, 100, 100, 300]]
  );
  assert.deepEqual(
    addSlotProductionToRows(zeroFallbackProductionReadings, 'totalizer', 'production_m3').map((row) => [
      row.site_id,
      row.slot_datetime,
      row.production_m3,
      row.totalizer,
    ]),
    [
      [1, '2026-01-31T23:00:00', null, 1000],
      [1, '2026-02-01T07:00:00', 100, 1100],
      [1, '2026-02-01T15:00:00', 0, 0],
      [1, '2026-02-01T23:00:00', 0, 0],
      [2, '2026-01-31T23:00:00', null, 5000],
      [2, '2026-02-01T07:00:00', 0, 0],
      [2, '2026-02-01T15:00:00', 100, 5100],
      [2, '2026-02-01T23:00:00', 100, 5200],
    ]
  );

  assert.deepEqual(
    addSlotProductionToRows(
      [
        { site_id: 1, slot_datetime: '2026-05-27T23:00:00', totalizer: 63389.8 },
        { site_id: 1, slot_datetime: '2026-05-28T06:30:00', totalizer: 63426.6 },
        { site_id: 1, slot_datetime: '2026-05-28T07:00:00', totalizer: 63435.7 },
        { site_id: 1, slot_datetime: '2026-05-28T07:30:00', totalizer: 63442.2 },
      ],
      'totalizer',
      'production_m3'
    ).map((row) => [
      row.slot_datetime,
      row.production_m3 === null ? null : Number(row.production_m3.toFixed(1)),
    ]),
    [
      ['2026-05-27T23:00:00', null],
      ['2026-05-28T06:30:00', null],
      ['2026-05-28T07:00:00', 45.9],
      ['2026-05-28T07:30:00', null],
    ]
  );
  assert.deepEqual(
    addSlotProductionToRows(
      [
        { site_id: 1, slot_datetime: '2026-05-27T15:00:00.000Z', totalizer: 63389.8 },
        { site_id: 1, slot_datetime: '2026-05-27T22:30:00.000Z', totalizer: 63426.6 },
        { site_id: 1, slot_datetime: '2026-05-27T23:00:00.000Z', totalizer: 63435.7 },
      ],
      'totalizer',
      'production_m3'
    ).map((row) => [
      row.slot_datetime,
      row.production_m3 === null ? null : Number(row.production_m3.toFixed(1)),
    ]),
    [
      ['2026-05-27T15:00:00.000Z', null],
      ['2026-05-27T22:30:00.000Z', null],
      ['2026-05-27T23:00:00.000Z', 45.9],
    ]
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

  const zeroFallbackPowerRows = aggregateDailyRows(
    [
      { site_id: 1, slot_datetime: '2026-01-31T22:30:00', chlorination_power_kwh: 100 },
      { site_id: 1, slot_datetime: '2026-02-01T06:30:00', chlorination_power_kwh: 130 },
      { site_id: 1, slot_datetime: '2026-02-01T14:30:00', chlorination_power_kwh: 0 },
      { site_id: 1, slot_datetime: '2026-02-01T22:30:00', chlorination_power_kwh: 0 },
      { site_id: 2, slot_datetime: '2026-01-31T22:30:00', chlorination_power_kwh: 500 },
      { site_id: 2, slot_datetime: '2026-02-01T06:30:00', chlorination_power_kwh: 0 },
      { site_id: 2, slot_datetime: '2026-02-01T14:30:00', chlorination_power_kwh: 540 },
      { site_id: 2, slot_datetime: '2026-02-01T22:30:00', chlorination_power_kwh: 580 },
    ],
    [
      { key: 'powerTotal', field: 'chlorination_power_kwh', aggregate: 'shiftYieldTotal' },
      { key: 'powerC', field: 'chlorination_power_kwh', aggregate: 'shiftYield', shift: 'c' },
      { key: 'powerA', field: 'chlorination_power_kwh', aggregate: 'shiftYield', shift: 'a' },
      { key: 'powerB', field: 'chlorination_power_kwh', aggregate: 'shiftYield', shift: 'b' },
    ],
    {
      visibleFromDate: '2026-02-01',
      visibleToDate: '2026-02-01',
    }
  );

  assert.deepEqual(
    zeroFallbackPowerRows.map((row) => [row.date, row.powerC, row.powerA, row.powerB, row.powerTotal]),
    [['2026-02-01', 30, 40, 40, 110]]
  );
  assert.deepEqual(
    addShiftYieldToRows(
      [
        { id: 'prev-b', site_id: 1, slot_datetime: '2026-01-31T22:30:00', chlorination_power_kwh: 100 },
        { id: 'c-end', site_id: 1, slot_datetime: '2026-02-01T06:30:00', chlorination_power_kwh: 130 },
        { id: 'a-end', site_id: 1, slot_datetime: '2026-02-01T14:30:00', chlorination_power_kwh: 0 },
        { id: 'b-end', site_id: 1, slot_datetime: '2026-02-01T22:30:00', chlorination_power_kwh: 0 },
      ],
      'chlorination_power_kwh',
      'power_yield'
    ).map((row) => [row.id, row.power_yield, row.chlorination_power_kwh]),
    [
      ['prev-b', null, 100],
      ['c-end', 30, 130],
      ['a-end', 0, 0],
      ['b-end', 0, 0],
    ]
  );

  const zeroFallbackDeepwellPower = buildMonthlyPowerConsumption(
    {
      chlorinationReadings: [],
      deepwellReadings: [
        { site_id: 1, slot_datetime: '2026-01-31T22:30:00', power_kwh_shift: 1000 },
        { site_id: 1, slot_datetime: '2026-02-01T06:30:00', power_kwh_shift: 1040 },
        { site_id: 1, slot_datetime: '2026-02-01T14:30:00', power_kwh_shift: 0 },
        { site_id: 1, slot_datetime: '2026-02-01T22:30:00', power_kwh_shift: 1120 },
      ],
    },
    {
      now: new Date('2026-02-28T12:00:00.000Z'),
      monthCount: 1,
    }
  );

  assert.equal(zeroFallbackDeepwellPower.rows[0].deepwellPower, 120);

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
  assert.equal(monthlyProduction.rows[0].production, 0);
  assert.equal(monthlyProduction.rows[1].production, 0);
  assert.equal(monthlyProduction.totalProduction, 0);
  assert.equal(monthlyProduction.averageProduction, 0);

  const dailyProduction = buildDailyProduction(readings, {
    now: new Date('2026-02-02T12:00:00.000Z'),
  });

  assert.deepEqual(
    dailyProduction.rows.map((row) => [row.date, row.production]),
    [
      ['2026-02-02', 0],
      ['2026-02-01', 0],
    ]
  );
  assert.equal(dailyProduction.monthLabel, 'February 2026');
  assert.equal(dailyProduction.totalProduction, 0);

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
      ['2026-02-02', 0],
      ['2026-02-01', 999],
    ]
  );

  const monthlyProductionWithSummaries = buildMonthlyProduction(readings, {
    now: new Date('2026-02-28T12:00:00.000Z'),
    monthCount: 2,
    dailySummaries: historicalSummaries,
  });

  assert.equal(monthlyProductionWithSummaries.rows[0].production, 1064);
  assert.equal(monthlyProductionWithSummaries.totalProduction, 1064);

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

  const monthlyPowerWithSummaryGap = buildMonthlyPowerConsumption(
    {
      chlorinationReadings: [
        { slot_datetime: '2026-01-31T22:30:00', chlorination_power_kwh: 100 },
        { slot_datetime: '2026-02-01T06:30:00', chlorination_power_kwh: 110 },
        { slot_datetime: '2026-02-01T14:30:00', chlorination_power_kwh: 125 },
        { slot_datetime: '2026-02-01T22:30:00', chlorination_power_kwh: 140 },
        { slot_datetime: '2026-02-02T06:30:00', chlorination_power_kwh: 170 },
        { slot_datetime: '2026-02-02T14:30:00', chlorination_power_kwh: 210 },
        { slot_datetime: '2026-02-02T22:30:00', chlorination_power_kwh: 260 },
      ],
      deepwellReadings: [],
    },
    {
      now: new Date('2026-02-28T12:00:00.000Z'),
      monthCount: 1,
      dailySummaries: [
        {
          summary_date: '2026-02-01',
          power_kwh: 70,
          site: { type: 'CHLORINATION' },
        },
      ],
    }
  );

  assert.equal(monthlyPowerWithSummaryGap.rows[0].chlorinationPower, 190);

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

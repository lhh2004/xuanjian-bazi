(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./vendor/lunar.js"));
  } else {
    root.XuanJianCalendar = factory(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (calendar) {
  "use strict";

  const STEMS = "甲乙丙丁戊己庚辛壬癸";
  const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
  const SIXTY = Array.from({ length: 60 }, (_, index) => (
    STEMS[index % 10] + BRANCHES[index % 12]
  ));
  const STANDARD_MERIDIAN = 120;

  function parseDate(dateText, timeText) {
    const dateMatch = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = String(timeText || "").match(/^(\d{2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) throw new Error("请填写完整的公历出生日期与时间");
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (year < 1900 || year > 2100) throw new Error("排盘年份应在 1900 至 2100 年之间");
    if (month < 1 || month > 12 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error("出生日期或时间超出有效范围");
    }
    const check = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (
      check.getFullYear() !== year ||
      check.getMonth() !== month - 1 ||
      check.getDate() !== day
    ) {
      throw new Error("出生日期不存在，请重新选择");
    }
    return { year, month, day, hour, minute };
  }

  function assertLibrary() {
    if (!calendar || !calendar.Solar) {
      throw new Error("历法引擎未加载，请刷新页面后重试");
    }
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatParts(parts) {
    return {
      date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
      time: `${pad(parts.hour)}:${pad(parts.minute)}`
    };
  }

  function dayOfYear(parts) {
    const start = Date.UTC(parts.year, 0, 0);
    const current = Date.UTC(parts.year, parts.month - 1, parts.day);
    return Math.floor((current - start) / 86400000);
  }

  function equationOfTime(parts) {
    const daysInYear = new Date(Date.UTC(parts.year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
    const fractionalYear = 2 * Math.PI / daysInYear
      * (dayOfYear(parts) - 1 + (parts.hour - 12 + parts.minute / 60) / 24);
    return 229.18 * (
      0.000075
      + 0.001868 * Math.cos(fractionalYear)
      - 0.032077 * Math.sin(fractionalYear)
      - 0.014615 * Math.cos(2 * fractionalYear)
      - 0.040849 * Math.sin(2 * fractionalYear)
    );
  }

  function adjustForTrueSolarTime(parts, options) {
    const enabled = Boolean(options.useTrueSolarTime);
    if (!enabled) {
      return {
        enabled: false,
        longitude: null,
        correctionMinutes: 0,
        equationMinutes: 0,
        parts: { ...parts }
      };
    }
    const longitude = Number(options.longitude);
    if (!Number.isFinite(longitude) || longitude < 73 || longitude > 135) {
      throw new Error("启用真太阳时时，请填写 73°E 至 135°E 的出生地经度");
    }
    const equationMinutes = equationOfTime(parts);
    const correctionMinutes = 4 * (longitude - STANDARD_MERIDIAN) + equationMinutes;
    const timestamp = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    ) + Math.round(correctionMinutes * 60000);
    const adjusted = new Date(timestamp);
    return {
      enabled: true,
      longitude,
      correctionMinutes,
      equationMinutes,
      parts: {
        year: adjusted.getUTCFullYear(),
        month: adjusted.getUTCMonth() + 1,
        day: adjusted.getUTCDate(),
        hour: adjusted.getUTCHours(),
        minute: adjusted.getUTCMinutes()
      }
    };
  }

  function makeEightChar(parts, sect) {
    assertLibrary();
    const solar = calendar.Solar.fromYmdHms(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      0
    );
    const lunar = solar.getLunar();
    const eightChar = lunar.getEightChar();
    eightChar.setSect(sect === 2 ? 2 : 1);
    return { solar, lunar, eightChar };
  }

  function detailFor(eightChar, prefix) {
    return {
      pillar: eightChar[`get${prefix}`](),
      stem: eightChar[`get${prefix}Gan`](),
      branch: eightChar[`get${prefix}Zhi`](),
      hidden: eightChar[`get${prefix}HideGan`](),
      wuXing: eightChar[`get${prefix}WuXing`](),
      naYin: eightChar[`get${prefix}NaYin`](),
      tenGodStem: eightChar[`get${prefix}ShiShenGan`](),
      tenGodHidden: eightChar[`get${prefix}ShiShenZhi`](),
      growth: eightChar[`get${prefix}DiShi`](),
      xun: eightChar[`get${prefix}Xun`](),
      void: eightChar[`get${prefix}XunKong`]()
    };
  }

  function julianDayNumber(parts) {
    const offset = Math.floor((14 - parts.month) / 12);
    const year = parts.year + 4800 - offset;
    const month = parts.month + 12 * offset - 3;
    return parts.day
      + Math.floor((153 * month + 2) / 5)
      + 365 * year
      + Math.floor(year / 4)
      - Math.floor(year / 100)
      + Math.floor(year / 400)
      - 32045;
  }

  function independentDayPillar(parts, sect) {
    const rollover = sect === 1 && parts.hour >= 23 ? 1 : 0;
    return SIXTY[(julianDayNumber(parts) + 49 + rollover) % 60];
  }

  function independentHourPillar(parts, dayPillar) {
    const dayStemIndex = STEMS.indexOf(dayPillar[0]);
    const branchIndex = Math.floor((parts.hour + 1) / 2) % 12;
    const startStem = [0, 2, 4, 6, 8][dayStemIndex % 5];
    return STEMS[(startStem + branchIndex) % 10] + BRANCHES[branchIndex];
  }

  function independentMonthPillar(yearPillar, monthPillar) {
    const yearStemIndex = STEMS.indexOf(yearPillar[0]);
    const branchIndex = BRANCHES.indexOf(monthPillar[1]);
    const monthOrder = (branchIndex - 2 + 12) % 12;
    const startStem = [2, 4, 6, 8, 0][yearStemIndex % 5];
    return STEMS[(startStem + monthOrder) % 10] + monthPillar[1];
  }

  function verify(lunar, pillars, sect, parts, yearBoundary) {
    const libraryExpected = [
      lunar.getYearInGanZhiExact(),
      lunar.getMonthInGanZhiExact(),
      sect === 2 ? lunar.getDayInGanZhiExact2() : lunar.getDayInGanZhiExact(),
      lunar.getTimeInGanZhi()
    ];
    // 如果是正月初一分界，年柱用农历年份的干支
    if (yearBoundary === "spring") {
      const lunarYear = lunar.getYear();
      const yearStemIndex = (lunarYear - 4) % 10;
      const yearBranchIndex = (lunarYear - 4) % 12;
      libraryExpected[0] = STEMS[yearStemIndex < 0 ? yearStemIndex + 10 : yearStemIndex]
        + BRANCHES[yearBranchIndex < 0 ? yearBranchIndex + 12 : yearBranchIndex];
    }
    const dayExpected = independentDayPillar(parts, sect);
    const hourDayExpected = independentDayPillar(parts, 1);
    const hourExpected = independentHourPillar(parts, hourDayExpected);
    const monthExpected = independentMonthPillar(pillars[0], pillars[1]);
    const checks = [
      {
        key: "cycle",
        label: "六十甲子结构",
        passed: pillars.every((pillar) => SIXTY.includes(pillar))
      },
      {
        key: "year",
        label: yearBoundary === "spring" ? "正月初一定年" : "立春定年",
        passed: pillars[0] === libraryExpected[0]
      },
      {
        key: "month",
        label: "节气定月与五虎遁",
        passed: pillars[1] === libraryExpected[1] && pillars[1] === monthExpected
      },
      {
        key: "day",
        label: sect === 2 ? "儒略日复核（午夜换日）" : "儒略日复核（子初换日）",
        passed: pillars[2] === libraryExpected[2] && pillars[2] === dayExpected
      },
      {
        key: "hour",
        label: "五鼠遁定时",
        passed: pillars[3] === libraryExpected[3] && pillars[3] === hourExpected
      }
    ];
    return {
      passed: checks.every((item) => item.passed),
      checks,
      expected: libraryExpected,
      independent: {
        month: monthExpected,
        day: dayExpected,
        hour: hourExpected
      }
    };
  }

  function calculate(options) {
    const standardParts = parseDate(options.birthDate, options.birthTime);
    const solarTime = adjustForTrueSolarTime(standardParts, options);
    const parts = solarTime.parts;
    const sect = Number(options.sect) === 2 ? 2 : 1;
    const yearBoundary = options.yearBoundary === "spring" ? "spring" : "lichun";
    const { solar, lunar, eightChar } = makeEightChar(parts, sect);
    const details = ["Year", "Month", "Day", "Time"].map((prefix) => detailFor(eightChar, prefix));
    let pillars = details.map((item) => item.pillar);

    // 正月初一分界：年柱使用农历年份对应的干支
    // 农历年份以正月初一为界，而立春为界的年柱可能与农历年不同
    if (yearBoundary === "spring") {
      const lunarYear = lunar.getYear();
      // 农历年的干支：用 (lunarYear - 4) mod 60 来计算
      const yearStemIndex = (lunarYear - 4) % 10;
      const yearBranchIndex = (lunarYear - 4) % 12;
      const lunarYearPillar = STEMS[yearStemIndex < 0 ? yearStemIndex + 10 : yearStemIndex]
        + BRANCHES[yearBranchIndex < 0 ? yearBranchIndex + 12 : yearBranchIndex];
      if (pillars[0] !== lunarYearPillar) {
        pillars = [lunarYearPillar, pillars[1], pillars[2], pillars[3]];
      }
    }
    const prevJie = lunar.getPrevJie();
    const nextJie = lunar.getNextJie();
    const calculated = formatParts(parts);
    return {
      engine: "lunar-javascript@1.7.7",
      calendar: "solar",
      timezone: "Asia/Shanghai",
      sect,
      yearBoundary,
      birthDate: options.birthDate,
      birthTime: options.birthTime,
      calculationDate: calculated.date,
      calculationTime: calculated.time,
      solarTime: {
        enabled: solarTime.enabled,
        longitude: solarTime.longitude,
        standardMeridian: STANDARD_MERIDIAN,
        correctionMinutes: Number(solarTime.correctionMinutes.toFixed(2)),
        equationMinutes: Number(solarTime.equationMinutes.toFixed(2))
      },
      pillars,
      details,
      lunarText: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      zodiac: lunar.getYearShengXiao(),
      lunarDetail: {
        yearGanZhi: lunar.getYearInGanZhiExact(),
        monthGanZhi: lunar.getMonthInGanZhiExact(),
        dayGanZhi: sect === 2 ? lunar.getDayInGanZhiExact2() : lunar.getDayInGanZhiExact(),
        hourGanZhi: lunar.getTimeInGanZhi(),
        yearInChinese: lunar.getYearInChinese(),
        monthInChinese: lunar.getMonthInChinese(),
        dayInChinese: lunar.getDayInChinese(),
        hourInChinese: lunar.getTimeZhi() + "时",
        isLeapMonth: lunar.getMonth() < 0,
        lunarYear: lunar.getYear(),
        lunarMonth: Math.abs(lunar.getMonth()),
        lunarDay: lunar.getDay(),
        jieQi: lunar.getJieQi ? lunar.getJieQi() : "",
        prevJieQi: prevJie.getName(),
        nextJieQi: nextJie.getName()
      },
      adjacentTerms: {
        previous: `${prevJie.getName()} ${prevJie.getSolar().toYmdHms()}`,
        next: `${nextJie.getName()} ${nextJie.getSolar().toYmdHms()}`
      },
      auxiliary: {
        taiYuan: eightChar.getTaiYuan(),
        taiYuanNaYin: eightChar.getTaiYuanNaYin(),
        taiXi: eightChar.getTaiXi(),
        taiXiNaYin: eightChar.getTaiXiNaYin(),
        mingGong: eightChar.getMingGong(),
        mingGongNaYin: eightChar.getMingGongNaYin(),
        shenGong: eightChar.getShenGong(),
        shenGongNaYin: eightChar.getShenGongNaYin()
      },
      verification: verify(lunar, pillars, sect, parts, yearBoundary),
      _eightChar: eightChar,
      _solar: solar
    };
  }

  function calculateDayun(options) {
    const result = calculate(options);
    const gender = options.gender === "男" ? 1 : 0;
    const yun = result._eightChar.getYun(gender);
    const cycles = yun.getDaYun(11)
      .filter((cycle) => cycle.getGanZhi())
      .slice(0, 10)
      .map((cycle, index) => ({
        index,
        pillar: cycle.getGanZhi(),
        startYear: cycle.getStartYear(),
        endYear: cycle.getEndYear(),
        startAge: cycle.getStartAge(),
        endAge: cycle.getEndAge(),
        xun: cycle.getXun(),
        void: cycle.getXunKong()
      }));
    return {
      direction: cycles.length > 1 && SIXTY.indexOf(cycles[1].pillar) > SIXTY.indexOf(cycles[0].pillar) ? 1 : -1,
      start: {
        years: yun.getStartYear(),
        months: yun.getStartMonth(),
        days: yun.getStartDay(),
        hours: yun.getStartHour(),
        solar: yun.getStartSolar().toYmdHms()
      },
      cycles
    };
  }

  function getSolarMonthTransitions(year) {
    assertLibrary();
    const startYear = Number(year);
    if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2099) {
      throw new Error("节令年份应在 1900 至 2099 年之间");
    }
    const monthSeeds = [
      [startYear, 2], [startYear, 3], [startYear, 4], [startYear, 5],
      [startYear, 6], [startYear, 7], [startYear, 8], [startYear, 9],
      [startYear, 10], [startYear, 11], [startYear, 12], [startYear + 1, 1]
    ];
    return monthSeeds.map(([targetYear, targetMonth]) => {
      const lunar = calendar.Solar.fromYmdHms(targetYear, targetMonth, 15, 12, 0, 0).getLunar();
      const jie = lunar.getPrevJie();
      const solar = jie.getSolar();
      return {
        term: jie.getName(),
        pillar: lunar.getMonthInGanZhiExact(),
        date: solar.toYmd(),
        time: solar.toYmdHms().slice(11, 16),
        year: solar.getYear(),
        month: solar.getMonth(),
        day: solar.getDay()
      };
    });
  }

  function comparePillars(options, suppliedPillars) {
    const calculated = calculate(options);
    const supplied = Array.isArray(suppliedPillars) ? suppliedPillars : [];
    const matches = calculated.pillars.map((pillar, index) => pillar === supplied[index]);
    return {
      passed: matches.every(Boolean),
      matches,
      calculated: calculated.pillars,
      supplied
    };
  }

  return {
    calculate,
    calculateDayun,
    getSolarMonthTransitions,
    comparePillars,
    parseDate,
    sixty: SIXTY.slice()
  };
});

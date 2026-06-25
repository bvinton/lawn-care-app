// src/data/LawnPackData.js

export const INITIAL_LAWN_CONFIG = {
  defaultLength: 7,
  defaultWidth: 4,
  defaultSqm: 28,
};

export const WEEDOL_BARRIER_DAYS = 42;
export const GRANULAR_REPEAT_DAYS = 56;

export const SEASON_START_DATES = {
  SPRING: '2026-03-01',
  SUMMER: '2026-06-01',
  AUTUMN: '2026-09-01',
  WINTER: '2026-12-01',
};

/** @typedef {'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER'} CalendarSeasonKey */

/**
 * Lawn pack season for a calendar date (UK boundaries aligned with SEASON_START_DATES).
 * Spring Mar–May, Summer Jun–Aug, Autumn Sep–Nov, Winter Dec–Feb.
 * @param {string} isoDate YYYY-MM-DD
 * @returns {CalendarSeasonKey}
 */
export function getCalendarSeasonForDate(isoDate) {
  const [, month, day] = isoDate.split('-').map(Number);
  const monthDay = month * 100 + day;

  if (monthDay >= 1201 || monthDay < 301) return 'WINTER';
  if (monthDay < 601) return 'SPRING';
  if (monthDay < 901) return 'SUMMER';
  return 'AUTUMN';
}

/** @type {CalendarSeasonKey[]} */
export const SEASON_ORDER = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];

/** @param {{ type?: string }} step */
export function stepTriggersPetLockout(step) {
  return step?.type === 'chemical' || step?.type === 'liquid';
}

/**
 * True only if a chemical/liquid pack step was logged on todayStr (YYYY-MM-DD).
 * @param {Record<string, string>} userLogs
 * @param {string} todayStr
 */
export function hasChemicalApplicationToday(userLogs, todayStr) {
  for (const seasonKey of SEASON_ORDER) {
    for (const step of SEASONS[seasonKey].steps) {
      if (!stepTriggersPetLockout(step)) continue;
      if (userLogs[makeStepKey(seasonKey, step.id)] === todayStr) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Remove stale 24h pet lockout when no chemical was applied today.
 * @param {Record<string, string>} userLogs
 * @param {string} todayStr
 */
export function stripStalePetLockout(userLogs, todayStr) {
  if (!userLogs.petLockoutUntil) return userLogs;
  if (hasChemicalApplicationToday(userLogs, todayStr)) return userLogs;
  const next = { ...userLogs };
  delete next.petLockoutUntil;
  return next;
}

/**
 * @param {CalendarSeasonKey} seasonKey
 * @param {Record<string, string>} userLogs
 */
export function isSeasonPackComplete(seasonKey, userLogs) {
  return SEASONS[seasonKey].steps
    .filter((step) => !step.optional)
    .every((step) => userLogs[makeStepKey(seasonKey, step.id)] != null);
}

/**
 * Steps not yet logged for a season pack.
 * @param {CalendarSeasonKey} seasonKey
 * @param {Record<string, string>} userLogs
 */
export function getIncompleteSeasonSteps(seasonKey, userLogs) {
  return SEASONS[seasonKey].steps.filter(
    (step) => !step.optional && !userLogs[makeStepKey(seasonKey, step.id)]
  );
}

/**
 * Which season tab to open by default: earliest incomplete pack at or before
 * today's calendar season (catch-up — don't skip Spring because June arrived).
 * @param {string} isoDate YYYY-MM-DD
 * @param {Record<string, string>} userLogs
 * @returns {CalendarSeasonKey}
 */
export function getWorkflowSeasonForDate(isoDate, userLogs) {
  const calendarSeason = getCalendarSeasonForDate(isoDate);
  const calendarIndex = SEASON_ORDER.indexOf(calendarSeason);

  for (let i = 0; i <= calendarIndex; i++) {
    const seasonKey = SEASON_ORDER[i];
    if (!isSeasonPackComplete(seasonKey, userLogs)) {
      return seasonKey;
    }
  }

  return calendarSeason;
}

export const WALLSEND_COORDS = {
  latitude: 54.98,
  longitude: -1.53,
};

export const EQUIPMENT_OPTIONS = {
  BIRCHMEIER: {
    id: 'BIRCHMEIER',
    name: 'Birchmeier Aquamix 1.25',
    instructionTemplate: (amount, setting) =>
      `⚙️ Birchmeier Aquamix: Pour exactly ${amount}ml of neat product into the empty chamber. Set the red dial cleanly to ${setting}. Attach your hose and spray evenly until the bottle runs completely dry.`,
  },
  WATERING_CAN: {
    id: 'WATERING_CAN',
    name: 'Standard 9L Watering Can',
    instructionTemplate: (amount) =>
      `🪣 Watering Can Protocol: Mix your total ${amount}ml dose across multiple full 9-litre watering cans (approx. 40–50ml of product per full can with a fine rose head) and water evenly across the grass.`,
  },
  BACKPACK_SPRAYER: {
    id: 'BACKPACK_SPRAYER',
    name: 'Standard Knapsack / Compression Sprayer',
    instructionTemplate: (amount) =>
      `🎒 Compression Sprayer: Pour your ${amount}ml dose into the tank, fill with water up to the 5-litre mark, pump to pressurize, and spray evenly.`,
  },
};

export const SPRINKLER_OPTIONS = {
  OSCILLATING: {
    id: 'OSCILLATING',
    name: 'Oscillating Bar Sprinkler',
    image: '/oscillating.jfif',
    description: 'Waves back and forth. Gentle delivery, but slow to build depth.',
    identification:
      'Long bar with multiple nozzles. Typically waves in a wide arc. Commonly sits directly on the grass. User photos often show plastic or metal bars with multiple tiny water jets.',
    ratePerHour: 12,
  },
  IMPACT: {
    id: 'IMPACT',
    name: 'Impact / Pulsating Sprinkler',
    image: '/impact.jfif',
    description: "The classic 'ts-ts-ts' rotating sprinkler. Good coverage, medium speed.",
    identification:
      'Single rotating head on a spike stake — brass or plastic. Pulses in a circle with a rhythmic click. Usually pushed into the lawn with the head sitting just above grass height.',
    ratePerHour: 15,
  },
  STATIC: {
    id: 'STATIC',
    name: 'Static / Fixed Spray',
    image: '/static.jfif',
    description: 'Fires a constant fan of water. Extremely fast application.',
    identification:
      'Fixed dome, spike, or ring head that sprays one unmoving pattern. Low-profile green or black plastic at ground level — no rotation or oscillation.',
    ratePerHour: 35,
  },
  HOSE: {
    id: 'HOSE',
    name: 'Manual Hosepipe (Spray Gun)',
    image: '/hose.jfif',
    description: 'Standing and spraying by hand. Fast, but coverage depends on your walking pattern.',
    identification:
      'Flexible hose with a pistol-grip spray gun or lance. You move across the lawn manually — trigger controls flow, nozzle switches from jet to shower.',
    ratePerHour: 40,
  },
};

export const SEASONS = {
  SPRING: {
    name: "Spring Pack",
    focus: "Renovation & Aggressive Recovery Sequence",
    generalGuidelines: {
      overview: "The Spring Pack combines Greener Growth Fertiliser and Biostimulant Booster for rapid, vibrant green growth within days and sustained lushness for up to 12 weeks. It thickens and revitalises lawns while remaining safe for pets and children. Best applied March - May.",
      bullets: [
        { title: "🌿 Weed Control", text: "Apply selective herbicides such as Weedol for Lawns when weeds start growing (roughly end of March). Do NOT apply selective herbicides until 8 weeks after seeding, or from 6 weeks beforehand as they severely affect germination." },
        { title: "✂️ Mowing", text: "Wait until your lawn is dry enough. Set the mower on its highest setting for the first cut of the year before bringing it down gradually. Do NOT cut off more than 1/3 of the grass blade at a time. By the end of spring when grass is growing fast, mow every 4-7 days to improve turf condition." },
        { title: "🚜 Renovation", text: "Spring is the ideal time to get seeding. When seeding, use The Lawn Pack renovation kit which contains different fertilisers to this pack. The nitrogen content in the standard Greener Growth Fertiliser will cause existing grass to grow too fast and outcompete fresh seedlings." },
        { title: "💀 Moss Control", text: "If you have moss that needs removing, apply Deeper Green Iron Sulphate across the lawn and rake out after 14 days once the moss has turned black. Fix poor drainage and compaction to stop moss returning." },
        { title: "🌀 Scarification/Aeration", text: "Spring is a great window to scarify and aerate. Scarification removes dead material/thatch, while aeration (ideally with a hollow-tiner) improves drainage and relieves sub-soil compaction to help the flow of air, water, and nutrients." }
      ]
    },
    steps: [
      {
        id: "weedol",
        label: "Step 1: Apply Weedol Lawn Weedkiller",
        type: "chemical",
        ratePerSqm: 1.5,
        unit: "ml",
        toolType: "sprayer",
        setting: "1.5%",
        daysAfterFirstStep: 0,
        note: "🎯 TARGET: Broadleaf weeds. Apply when weeds are small, actively growing, and leaf surface area is maximized. Avoid mowing for 3 days before and 3 days after application. 🚫 DRY TIME: Foliar absorption takes time. Do NOT apply any liquids, iron sprays, or water the lawn for a strict 48 hours post-application. Wait 6 weeks before seeding.",
        dogSafety: "Lock your dog inside during spraying. Keep paws off the grass until every leaf blade is 100% dry."
      },
      {
        id: "moss",
        label: "Optional: Apply Iron Sulphate for moss control",
        type: "chemical",
        ratePerSqm: 5,
        unit: "g",
        toolType: "sprayer",
        daysAfterFirstStep: 14,
        optional: true,
        note: "💀 MOSS ONLY: High dose (5g per SQM) blackens moss — rake out after 14 days once moss has turned black. Use shed stock (Winter Pack iron). Not shipped in the Spring Pack. Skip if no moss.",
        dogSafety: "Lock your dog inside during spraying. Keep paws off the grass until every leaf blade is 100% dry."
      },
      {
        id: "prep",
        label: "Step 2: Relieve Compaction & Scarify (Mechanical & Auger Prep)",
        type: "prep",
        toolType: "manual",
        lockedUntilStepClear: "weedol",
        daysAfterFirstStep: 42,
        note: "🚜 MECHANICAL PREP: Drop your mower to its lowest setting and scalp the turf. Run the scarifier in close parallel lines to rip out dead moss and thatch. 🌀 COMPACTION: Drill deep aeration channels every few inches across the lawn grid with your auger bit. This relieves sub-soil compression and opens chambers for new seed."
      },
      {
        id: "seed",
        label: "Step 3: Sow Stronger Roots Seed & Mycorrhizal Enhancer",
        type: "seed",
        ratePerSqm: 22,
        unit: "g",
        toolType: "manual",
        lockedUntilStepClear: "weedol",
        daysAfterFirstStep: 42,
        note: "🌱 SEEDING METHOD: Divide your seed/enhancer mix into two equal halves. Walk top-to-bottom spreading the first half, then left-to-right with the second half for uniform density. Brush or rake seeds down into open auger holes for soil contact and bird/rain protection."
      },
      {
        id: "fertiliser",
        label: "Step 4: Spread Seeding Success Fertiliser",
        type: "granular",
        ratePerSqm: 30,
        unit: "g",
        toolType: "spreader",
        daysAfterFirstStep: 42,
        note: "⚡ STARTER NUTRITION: Spread evenly across the surface immediately after seed drop to accelerate cell development.",
        dogSafety: "Water pellets heavily into the soil immediately after spreading until fully dissolved. Block dog access until granules are gone from the leaf surface."
      },
      {
        id: "seaweed",
        label: "Step 5: Apply Liquid Biostimulant Booster",
        type: "liquid",
        ratePerSqm: 5,
        unit: "ml",
        toolType: "sprayer",
        setting: "2.0%",
        daysAfterFirstStep: 45,
        note: "🧪 ROOT RECOVERY: Wait 2 to 3 full days after seeding and heavy watering before spraying. This stops fresh seedbeds over-saturating. Cold-pressed seaweed compounds drive root elongation and stress recovery.",
        dogSafety: "Keep your dog off the lawn during spraying and until the liquid extract is 100% dry on every leaf surface."
      }
    ]
  },
  SUMMER: {
    name: "Summer Pack",
    focus: "Heat Stress Defense & Drought Protection",
    generalGuidelines: {
      overview: "Summer Thriver Fertiliser is formulated for high temperatures and low rainfall without scorching risk. It delivers slow-release nitrogen plus stress-relieving compounds. Combined with Biostimulant Booster, it increases root mass, soil microbiology, and blade density.",
      bullets: [
        { title: "✂️ MOWING", text: "Cut every 4-7 days normally. During active drought spells, cut every 14 days or stop mowing entirely—leave the turf longer so it retains soil moisture and shields root crowns." },
        { title: "🚰 WATERING", text: "In drought, irrigate heavily 2-3 times a week to keep your lawn greener for longer. Yellow grass is dormancy defence—it will recover when rain returns." },
        { title: "💦 WETTING AGENTS", text: "Apply wetting agents during and in the lead up to summer to reduce total watering requirements and keep your lawn greener for longer." },
        { title: "🌿 WEED CONTROL", text: "Weeds are common in summer. Apply a selective herbicide when your lawn is over 8 weeks old to kill them cleanly." },
        { title: "🍂 FUTURE TRIGGER", text: "In 8-12 weeks, apply The Autumn Pack to harden the lawn for colder months." }
      ]
    },
    steps: [
      {
        id: "fertiliser",
        label: "Step 1: Spread Summer Thriver Fertiliser",
        type: "granular",
        ratePerSqm: 30,
        unit: "g",
        toolType: "spreader",
        daysAfterFirstStep: 0,
        granularRepeatDays: GRANULAR_REPEAT_DAYS,
        note: "☀️ SCORCH DEFENCE: Slow-release, polymer-coated nitrogen feeds evenly over 8-10 weeks. This blocks volatile nitrogen surges that burn or scorch warm-weather turf. Apply only to dry foliage. 📅 SCHEDULE: Re-apply every 8-12 weeks, then switch to the Autumn Preparation sequence.",
        dogSafety: "Irrigate immediately with 5-10mm of water to dissolve granules and wash them off leaf blades into the soil before allowing paw traffic."
      },
      {
        id: "seaweed",
        label: "Step 2: Apply Liquid Biostimulant Booster",
        type: "liquid",
        ratePerSqm: 5,
        unit: "ml",
        toolType: "sprayer",
        setting: "2.0%",
        daysAfterFirstStep: 3,
        note: "🧪 ROOT MICROBIOLOGY: Spray 4-5ml of booster per SQM. This increases root network mass, soil microbiology, blade density, and nutrient absorption. Apply early morning or late evening during hot spells. Do NOT spray in direct midday sun.",
        dogSafety: "Keep your dog off the lawn during spraying and until the liquid extract is 100% dry on every leaf surface."
      },
      {
        id: "maintenance",
        label: "Step 3: Continuous Summer Maintenance Protocol",
        type: "info",
        daysAfterFirstStep: 7,
        note: "✂️ MOWING: Cut every 4-7 days normally. During drought, cut every 14 days or stop mowing—leave turf longer to retain moisture and shield root crowns. 🚰 WATERING: In severe drought, irrigate heavily 2-3 times a week. Yellow grass is dormancy defence—it recovers when rain returns. 💦 WETTING AGENTS: Apply wetting agents before hot weather to cut watering volume. 🍂 FUTURE TRIGGER: In 8-12 weeks, switch to the Autumn Pack for cold resistance."
      }
    ]
  },
  AUTUMN: {
    name: "Autumn Pack",
    focus: "Repairing Summer Wear & Root Conditioning",
    generalGuidelines: {
      overview: "Autumn Preparation Fertiliser and Biostimulant Booster repair summer wear, build winter hardiness, and consolidate root structure before frost cycles. Low nitrogen blocks weak leaf growth; high potassium and phosphorus build root-crown carbohydrates for rapid spring awakening. Best applied September - November.",
      bullets: [
        { title: "🍁 WINTER HARDINESS", text: "Low Nitrogen blocks weak leaf growth vulnerable to winter diseases like Fusarium patch. High Potassium and Phosphorus build carbohydrates inside the root crown for rapid spring awakening. Apply to dry turf and water in within 48 hours if no rainfall occurs." },
        { title: "🍂 CELL CONSOLIDATION", text: "Biostimulant Booster thickens cellular membranes and boosts plant sap density before heavy frost cycles. Maintains deep root structure as daylight hours drop. Can be tank-mixed with liquid autumn iron treatments." },
        { title: "🍁 LEAF CLEARING", text: "Rake or brush fallen leaves off the grass every 2-3 days. Wet leaves block sunlight and trap stagnant moisture, inducing lawn rot and patch disease." },
        { title: "✂️ MOWING ADJUSTMENT", text: "Raise mower cutting height by 1-2 clicks for final autumn cuts to leave a taller, resilient solar panel for low winter sun." },
        { title: "📅 SEASON TRIGGER", text: "Apply between September and November before hard freezing weather. Switch to the Winter Pack after autumn leaf fall and final cuts are complete." }
      ]
    },
    steps: [
      {
        id: "fertiliser",
        label: "Step 1: Spread Autumn Preparation Fertiliser",
        type: "granular",
        ratePerSqm: 30,
        unit: "g",
        toolType: "spreader",
        daysAfterFirstStep: 0,
        note: "🍁 WINTER HARDINESS: Low Nitrogen blocks weak leaf growth vulnerable to winter diseases like Fusarium patch. High Potassium and Phosphorus build carbohydrates inside the root crown for rapid spring awakening. Apply to dry turf. 📅 TRIGGER: Apply between September and November before hard freezing weather.",
        dogSafety: "Water granules into the turf within 48 hours of spreading if no rainfall occurs. Block dog access until granules are fully dissolved into the soil."
      },
      {
        id: "seaweed",
        label: "Step 2: Apply Liquid Biostimulant Booster",
        type: "liquid",
        ratePerSqm: 5,
        unit: "ml",
        toolType: "sprayer",
        setting: "2.0%",
        daysAfterFirstStep: 3,
        note: "🍂 CELL CONSOLIDATION: Thickens cellular membranes and boosts plant sap density before the first heavy frost cycles. Maintains deep root structure as daylight hours drop. Can be tank-mixed with liquid autumn iron treatments.",
        dogSafety: "Keep your dog off the lawn during spraying and until the liquid extract is 100% dry on every leaf surface."
      },
      {
        id: "maintenance",
        label: "Step 3: Autumn Leaf & Cleansing Management",
        type: "info",
        daysAfterFirstStep: 7,
        note: "🍁 LEAF CLEARING: Rake or brush fallen leaves off the grass every 2-3 days. Wet leaves block sunlight and trap stagnant moisture, inducing lawn rot and patch disease. ✂️ MOWING ADJUSTMENT: Raise mower cutting height by 1-2 clicks for final autumn cuts to leave a taller solar panel for low winter sun."
      }
    ]
  },
  WINTER: {
    name: "Winter Pack",
    focus: "Frost Defense & Hard Moss Treatment",
    generalGuidelines: {
      overview: "The Winter Pack combines zero-nitrogen Winter Protection Fertiliser, Deeper Green Iron Sulphate, and Biostimulant Booster to block frost damage, kill heavy moss, and protect soil microbial activity during dormancy. Apply during mild windows when the ground is not frozen or waterlogged.",
      bullets: [
        { title: "❄️ FROST GUARD", text: "Zero-nitrogen formulation builds structural hardiness and plant skeleton defence. Blocks cell sap freezing inside grass blades and delivers micro-nutrients that strengthen grass walls against foot traffic and frost weight. Apply to dry lawn and water in thoroughly or apply right before rain." },
        { title: "💀 MOSS CONTROL", text: "Deeper Green Iron Sulphate targets heavy winter moss. Moss blackens, dehydrates, and dies within 24-48 hours of contact. For cosmetic greening only (no active moss), halve the dose to 2.5g per square metre to avoid tip scorch." },
        { title: "🛡️ ROOT INSULATION", text: "Biostimulant Booster protects soil microbial activity throughout winter dormancy. Apply during a mild window when the ground is not frozen, waterlogged, or covered in deep frost." },
        { title: "⚠️ HARD SURFACE PROTECTION", text: "Keep iron sulphate spray off hard stone, porcelain, patios, and pathways to prevent permanent orange rust staining." },
        { title: "🐾 PET & TRAFFIC SAFETY", text: "Water all granular products into the turf and wait until all liquid sprays are 100% dry before allowing dogs or foot traffic on the treated lawn." }
      ]
    },
    steps: [
      {
        id: "fertiliser",
        label: "Step 1: Spread Winter Protection Fertiliser",
        type: "granular",
        ratePerSqm: 30,
        unit: "g",
        toolType: "spreader",
        daysAfterFirstStep: 0,
        note: "❄️ FROST GUARD: Zero-nitrogen formulation builds structural hardiness and plant skeleton defence. Blocks cell sap freezing inside grass blades and delivers micro-nutrients that strengthen grass walls against foot traffic and frost weight. Apply to dry lawn.",
        dogSafety: "Water the mix in thoroughly or apply right before rain to clear the leaf surface. Block dog access until granules are fully dissolved into the soil."
      },
      {
        id: "iron1",
        label: "Step 2: Apply Deeper Green Iron Sulphate (1st dose)",
        type: "chemical",
        ratePerSqm: 2.5,
        unit: "g",
        toolType: "sprayer",
        daysAfterFirstStep: 7,
        note: "💀 1ST DOSE (Winter Pack double dose): Moss — 5g per SQM, rake 7–14 days later. No moss — 2.5g per SQM for green-up and hardening. Can tank-mix with biostimulant. ⚠️ Keep spray off patios and hard surfaces.",
        dogSafety: "Lock dogs away during spraying. Keep paws off treated grass until completely dry to prevent skin irritation or paw staining."
      },
      {
        id: "seaweed",
        label: "Step 3: Apply Liquid Biostimulant Booster",
        type: "liquid",
        ratePerSqm: 5,
        unit: "ml",
        toolType: "sprayer",
        setting: "2.0%",
        daysAfterFirstStep: 10,
        note: "🛡️ ROOT INSULATION: Protects soil microbial activity throughout winter dormancy. Can be tank-mixed with the 1st iron dose for quicker application. Apply during a mild window when the ground is not frozen, waterlogged, or covered in deep frost.",
        dogSafety: "Keep your dog off the lawn during spraying and until the liquid extract is 100% dry on every leaf surface."
      },
      {
        id: "iron2",
        label: "Step 4: Apply Deeper Green Iron Sulphate (2nd dose)",
        type: "chemical",
        ratePerSqm: 2.5,
        unit: "g",
        toolType: "sprayer",
        daysAfterFirstStep: 35,
        note: "💀 2ND DOSE: Apply 4 weeks after the 1st dose (medium dose 2.5g per SQM, or 5g per SQM if moss). Completes the Winter Pack double dose.",
        dogSafety: "Lock dogs away during spraying. Keep paws off treated grass until completely dry to prevent skin irritation or paw staining."
      }
    ]
  }
};

export function makeStepKey(seasonKey, stepId) {
  return `${seasonKey}:${stepId}`;
}

/**
 * Migrate legacy log keys when pack step ids change.
 * @param {Record<string, string>} userLogs
 */
export function migrateUserLogs(userLogs) {
  const next = { ...userLogs };
  if (next['WINTER:iron'] && !next['WINTER:iron1']) {
    next['WINTER:iron1'] = next['WINTER:iron'];
    delete next['WINTER:iron'];
  }
  return next;
}

/** @param {string} dateString @param {number} days */
export function addDaysToDateString(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  result.setDate(result.getDate() + days);
  const y = result.getFullYear();
  const m = String(result.getMonth() + 1).padStart(2, '0');
  const d = String(result.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Resolve the anchor date (Step 1) for a season — logged date wins, else season baseline.
 * @param {string} seasonKey
 * @param {Record<string, string>} userLogs
 * @param {Record<string, Record<string, string>>} pendingDates
 */
export function getSeasonAnchorDate(seasonKey, userLogs, pendingDates) {
  const firstStep = SEASONS[seasonKey].steps[0];
  const logKey = makeStepKey(seasonKey, firstStep.id);
  if (userLogs[logKey]) return userLogs[logKey];
  return pendingDates[seasonKey]?.[firstStep.id] ?? SEASON_START_DATES[seasonKey];
}

/**
 * Compute cascaded pending dates for all incomplete steps in a season.
 * @param {string} seasonKey
 * @param {string} anchorDate
 * @param {Record<string, string>} userLogs
 * @param {Record<string, Record<string, string>> | null | undefined} existingPending
 */
export function cascadeSeasonDates(seasonKey, anchorDate, userLogs, existingPending = null) {
  const steps = SEASONS[seasonKey].steps;
  const seasonPending = { ...(existingPending?.[seasonKey] ?? {}) };

  steps.forEach((step, index) => {
    const logKey = makeStepKey(seasonKey, step.id);
    if (userLogs[logKey]) {
      seasonPending[step.id] = userLogs[logKey];
      return;
    }

    if (index === 0) {
      seasonPending[step.id] = anchorDate;
      return;
    }

    if (step.lockedUntilStepClear === 'weedol' && seasonKey === 'SPRING') {
      const weedolKey = makeStepKey('SPRING', 'weedol');
      const weedolDate = userLogs[weedolKey] ?? anchorDate;
      seasonPending[step.id] = addDaysToDateString(weedolDate, WEEDOL_BARRIER_DAYS);
      return;
    }

    seasonPending[step.id] = addDaysToDateString(anchorDate, step.daysAfterFirstStep ?? 0);
  });

  return seasonPending;
}

/** @param {Record<string, Record<string, string>> | null} [existingPending=null] @param {Record<string, string>} [userLogs] @returns {Record<string, Record<string, string>>} */
export function createInitialPendingDates(existingPending = null, userLogs = /** @type {Record<string, string>} */ ({})) {
  /** @type {Record<string, Record<string, string>>} */
  const pending = {};

  Object.keys(SEASONS).forEach((seasonKey) => {
    const anchor = getSeasonAnchorDate(
      seasonKey,
      userLogs,
      existingPending ?? buildBaselinePending()
    );
    pending[seasonKey] = cascadeSeasonDates(seasonKey, anchor, userLogs, existingPending);
  });

  return pending;
}

/** @returns {Record<string, Record<string, string>>} */
function buildBaselinePending() {
  /** @type {Record<string, Record<string, string>>} */
  const baseline = {};
  Object.keys(SEASONS).forEach((seasonKey) => {
    baseline[seasonKey] = {};
    SEASONS[seasonKey].steps.forEach((step, index) => {
      baseline[seasonKey][step.id] =
        index === 0
          ? SEASON_START_DATES[seasonKey]
          : addDaysToDateString(
              SEASON_START_DATES[seasonKey],
              step.daysAfterFirstStep ?? 0
            );
    });
  });
  return baseline;
}

/**
 * @param {string} seasonKey
 * @param {Record<string, string>} userLogs
 */
export function getGranularRepeatDate(seasonKey, userLogs) {
  const firstStep = SEASONS[seasonKey].steps[0];
  if (!firstStep.granularRepeatDays) return null;

  const logKey = makeStepKey(seasonKey, firstStep.id);
  const loggedDate = userLogs[logKey];
  if (!loggedDate) return null;

  return addDaysToDateString(loggedDate, firstStep.granularRepeatDays);
}

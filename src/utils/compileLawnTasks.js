import { addDaysToDateString } from '../data/LawnPackData';

const GYPSUM_CYCLE_DAYS = 182;

/** @param {string | Date} from @param {string | Date} to */
function daysBetween(from, to) {
  const start = typeof from === 'string' ? new Date(`${from}T12:00:00`) : from;
  const end = typeof to === 'string' ? new Date(`${to}T12:00:00`) : to;
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * @param {Object} input
 * @param {string} input.todayStr
 * @param {boolean} input.isWinterSeason
 * @param {boolean} input.isNatureProvidingFullSoak
 * @param {boolean} input.seedEstablishmentActive
 * @param {string | null} input.mowingLockedUntilIso
 * @param {string | null} input.mowingNextDueIso
 * @param {string | null} input.wateringNextDueIso
 * @param {string | null} input.lastGypsumDate
 */
export function compileLawnTasks({
  todayStr,
  isWinterSeason,
  isNatureProvidingFullSoak,
  seedEstablishmentActive,
  mowingLockedUntilIso,
  mowingNextDueIso,
  wateringNextDueIso,
  lastGypsumDate,
}) {
  /** @param {string} dueDateIso */
  const taskStatusFromDue = (dueDateIso) =>
    daysBetween(dueDateIso, todayStr) >= 0 ? 'urgent' : 'pending';

  /** @type {Array<{ id: string, title: string, dueDate: string, status: 'pending' | 'urgent' | 'completed', module: 'lawn' }>} */
  const compiledTasks = [];

  if (isWinterSeason) {
    compiledTasks.push({
      id: 'lawn-mow',
      title: 'Mow lawn',
      dueDate: todayStr,
      status: 'completed',
      module: 'lawn',
    });
  } else if (seedEstablishmentActive && mowingLockedUntilIso) {
    compiledTasks.push({
      id: 'lawn-mow',
      title: 'Mow lawn',
      dueDate: mowingLockedUntilIso,
      status: 'pending',
      module: 'lawn',
    });
  } else {
    const mowDueDate = mowingNextDueIso ?? todayStr;
    compiledTasks.push({
      id: 'lawn-mow',
      title: 'Mow lawn',
      dueDate: mowDueDate,
      status: taskStatusFromDue(mowDueDate),
      module: 'lawn',
    });
  }

  if (isWinterSeason || isNatureProvidingFullSoak) {
    compiledTasks.push({
      id: 'lawn-water',
      title: 'Water lawn',
      dueDate: todayStr,
      status: 'completed',
      module: 'lawn',
    });
  } else {
    const waterDueDate = wateringNextDueIso ?? todayStr;
    compiledTasks.push({
      id: 'lawn-water',
      title: 'Water lawn',
      dueDate: waterDueDate,
      status: taskStatusFromDue(waterDueDate),
      module: 'lawn',
    });
  }

  const gypsumDueDate = lastGypsumDate
    ? addDaysToDateString(lastGypsumDate, GYPSUM_CYCLE_DAYS)
    : todayStr;
  compiledTasks.push({
    id: 'lawn-gypsum',
    title: 'Apply Liquid Gypsum',
    dueDate: gypsumDueDate,
    status: taskStatusFromDue(gypsumDueDate),
    module: 'lawn',
  });

  return compiledTasks;
}

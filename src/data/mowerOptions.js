/**
 * Lawnmower catalog. heightMode controls how cut recommendations are shown:
 * - settings: numbered lever/click positions (e.g. Ryobi Setting 2)
 * - mm: continuous height adjustment — recommend cut height in millimetres
 *
 * heightBySetting maps the internal care levels (1=lowest/scalp … 4=tallest)
 * to the millimetre height that level means on that mower.
 */
export const MOWER_OPTIONS = {
  RYOBI_33: {
    id: 'RYOBI_33',
    name: 'Ryobi 18V ONE+ 33cm (5-Height System)',
    heightMode: 'settings',
    heightBySetting: {
      1: 25,
      2: 35,
      3: 45,
      4: 50,
    },
  },
  BOSCH_AHM_38G: {
    id: 'BOSCH_AHM_38G',
    name: 'Bosch AHM 38 G Manual Reel (15–50mm)',
    heightMode: 'mm',
    minMm: 15,
    maxMm: 50,
    // Same care targets; scalp uses the mower's lowest available height
    heightBySetting: {
      1: 15,
      2: 35,
      3: 45,
      4: 50,
    },
  },
};

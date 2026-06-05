export const MS_PER_HOUR = 1000 * 60 * 60;
export const SEED_ESTABLISHMENT_DAYS = 21;
export const SEED_GERMINATION_SOIL_TEMP_MIN_C = 10;
export const SEED_GERMINATION_SOIL_TEMP_MAX_C = 25;
export const PET_LOCKOUT_KEY = 'petLockoutUntil';
export const PET_LOCKOUT_HOURS = 24;

export const MOWER_OPTIONS = {
  RYOBI_33: {
    id: 'RYOBI_33',
    name: 'Ryobi 18V ONE+ 33cm (5-Height System)',
  },
};

export const LAWN_SURFACE_OPTIONS = {
  UNEVEN: {
    id: 'UNEVEN',
    label: 'Uneven / Bumpy',
  },
  FLAT: {
    id: 'FLAT',
    label: 'Perfectly Flat / Smooth',
  },
};

export const LEVELLING_GUIDE_METHODS = [
  {
    title: '1. Light Topdressing (Minor bumps up to 20mm)',
    text: 'Spread a 50/50 mix of sharp sand and screened topsoil across low areas during active growth (spring or early autumn). Work the mix in with a lawn lute or stiff rake, keeping grass tips visible. Water lightly and repeat in thin layers rather than one deep dump.',
  },
  {
    title: '2. Deep Spot Filling (Medium dips)',
    text: 'Remove debris from the hollow, fill with topsoil in layers, and firm each layer with your heel or a tamper until level with the surrounding turf. Over-seed the patch or lay fresh turf sods, then keep the area moist until roots establish.',
  },
  {
    title: '3. Turf Lifting (Severe hollows)',
    text: 'Cut an H-shape through the turf around the sunken area. Peel back both flaps carefully, add and compact topsoil underneath until the surface matches the surrounding lawn, then fold the grass flaps back down. Water thoroughly and avoid heavy traffic until re-rooted.',
  },
];

export const PET_SAFETY_CLASS =
  'bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs p-3 rounded-lg flex items-center gap-2 mb-2';

export const DECKING_EDGE_WATERING_SUBTASK = (
  <p className="mt-2 text-[11px] font-medium text-sky-900 bg-sky-50/80 border border-sky-100 rounded p-2 leading-snug">
    🚰 Secondary Task: 2-minute manual hose blast for the decking edges and blind spots.
  </p>
);

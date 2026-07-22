import masterclassManifest from './masterclassManifest.json';

/**
 * Lawn Pack literature served from /public.
 * @typedef {'pdf' | 'docx' | 'image' | 'gallery'} GuideKind
 * @typedef {{ title: string, file?: string, kind: GuideKind, description?: string, images?: string[] }} LawnGuide
 * @typedef {{ title: string, description?: string, guides: LawnGuide[] }} GuideSection
 */

/** @type {GuideSection[]} */
export const LAWN_GUIDE_SECTIONS = [
  {
    title: 'Seasonal pack guides',
    description: 'Application guides for each seasonal delivery.',
    guides: [
      {
        title: 'Spring Pack',
        file: '/The Spring Pack.docx',
        kind: 'docx',
        description: 'March – May · Greener Growth + Biostimulant',
      },
      {
        title: 'Summer Pack',
        file: '/The Summer Pack.docx',
        kind: 'docx',
        description: 'June – August · Summer Thriver + Biostimulant',
      },
      {
        title: 'Autumn Pack',
        file: '/The Autumn Pack.docx',
        kind: 'docx',
        description: 'September – November · Autumn Preparation + Biostimulant',
      },
      {
        title: 'Winter Pack',
        file: '/The Winter Pack.docx',
        kind: 'docx',
        description: 'December – February · Winter Protection + Iron + Biostimulant',
      },
    ],
  },
  {
    title: 'Masterclass series',
    description: 'The 5-part lawn care masterclass from The Lawn Pack.',
    guides: [
      {
        title: 'Part 1: Level Up Your Lawn Game',
        kind: 'gallery',
        images: masterclassManifest['part-1'],
      },
      {
        title: 'Part 2: Scarification & Aeration',
        kind: 'gallery',
        images: masterclassManifest['part-2'],
      },
      {
        title: 'Part 3: Soil, Feed & Seed',
        kind: 'gallery',
        images: masterclassManifest['part-3'],
      },
      {
        title: 'Part 4: Aftercare',
        kind: 'gallery',
        images: masterclassManifest['part-4'],
      },
      {
        title: 'Part 5: Ongoing Care',
        kind: 'gallery',
        images: masterclassManifest['part-5'],
      },
    ],
  },
  {
    title: 'Individual guides',
    description: 'Product-specific and year-round maintenance references.',
    guides: [
      {
        title: 'Iron Sulphate Guide',
        file: '/Iron Sulphate Guide.docx',
        kind: 'docx',
        description: 'Dosing, dilution, and repeat intervals',
      },
      {
        title: 'Starting your lawn from scratch',
        file: '/Starting your lawn from scratch guide.docx',
        kind: 'docx',
      },
      {
        title: 'Maintain your lawn',
        file: '/Lawn Pack, Maintain your lawn Guide.pdf',
        kind: 'pdf',
        description: 'Year-round care and subscription overview',
      },
    ],
  },
];

/** @param {LawnGuide} guide */
export function guideActionLabel(guide) {
  switch (guide.kind) {
    case 'pdf':
    case 'docx':
    case 'gallery':
      return 'Read guide';
    case 'image':
      return 'View image';
    default:
      return 'Open';
  }
}

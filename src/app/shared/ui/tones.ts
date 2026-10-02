import type { Tone } from './stat-card.component';

/**
 * One hue per business entity, used for icon chips everywhere (dashboard tiles, module KPI
 * cards, empty states). A tone says WHAT the thing is — never how it is doing. Status is
 * always carried by the semantic colours (success / warning / danger) plus text or an icon.
 */
export const ENTITY_TONE = {
  focus: 'slate',
  deals: 'violet',
  pipeline: 'violet',
  partners: 'blue',
  tasks: 'emerald',
  tickets: 'sky',
  campaigns: 'amber',
  finance: 'slate',
  automation: 'violet',
  late: 'rose',
} as const satisfies Record<string, Tone>;

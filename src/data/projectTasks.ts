import type { ProjectTaskDefinition } from './projectTaskSchema'

// Project ids drop the upstream daily_/weekly_ prefix (category is derived
// from upstreamIds, not from the id string). Only entries that need merging
// or splitting specify multiple upstreamIds, overriding label / color /
// maxProgress / optional as needed.
export const PROJECT_TASKS = [
  { id: 'mystery_store', upstreamIds: ['daily_mystery_store'] },
  { id: 'guild_checkin', upstreamIds: ['daily_guild_checkin'] },
  { id: 'unstable_clear', upstreamIds: ['daily_unstable_clear'] },
  { id: 'bureau_commissions', upstreamIds: ['daily_bureau_commissions'] },
  {
    id: 'homestead_commissions',
    upstreamIds: ['daily_homestead_commissions'],
  },
  { id: 'world_boss_keys', upstreamIds: ['daily_world_boss_keys'] },
  { id: 'elite_boss_keys', upstreamIds: ['daily_elite_boss_keys'] },
  { id: 'focus', upstreamIds: ['daily_focus'] },
  { id: 'season_pass_activity', upstreamIds: ['daily_season_pass_activity'] },
  { id: 'friendship_list', upstreamIds: ['daily_friendship_list'] },
  { id: 'musician_challenge', upstreamIds: ['daily_musician_challenge'] },
  { id: 'pioneer_awards', upstreamIds: ['weekly_pioneer_awards'] },
  { id: 'reclaim_hub', upstreamIds: ['weekly_reclaim_hub'] },
  { id: 'starland_quests', upstreamIds: ['weekly_starland_quests'] },
  { id: 'illusion_essence', upstreamIds: ['weekly_illusion_essence'] },
  { id: 'guild_activity', upstreamIds: ['weekly_guild_activity'] },
  { id: 'guild_hunt', upstreamIds: ['weekly_guild_hunt'] },
  { id: 'guild_dance', upstreamIds: ['weekly_guild_dance'] },
  { id: 'world_boss_crusade', upstreamIds: ['weekly_world_boss_crusade'] },
  { id: 'dungeon_encounter', upstreamIds: ['weekly_dungeon_encounter'] },
  { id: 'stimen_vaults', upstreamIds: ['weekly_stimen_vaults'] },
  { id: 'season_store_elite', upstreamIds: ['weekly_season_store_elite'] },
  { id: 'season_store', upstreamIds: ['weekly_season_store'] },
  { id: 'guild_store', upstreamIds: ['weekly_guild_store'] },
  { id: 'honor_store', upstreamIds: ['weekly_honor_store'] },
  { id: 'friendship_store', upstreamIds: ['weekly_friendship_store'] },
  { id: 'event_store', upstreamIds: ['weekly_event_store'] },
  { id: 'orb_store', upstreamIds: ['weekly_orb_store'] },
  { id: 'gear_exchange_store', upstreamIds: ['weekly_gear_exchange_store'] },
  { id: 'module_exchange', upstreamIds: ['weekly_module_exchange'] },
  { id: 'sigil_store', upstreamIds: ['weekly_sigil_store'] },
  { id: 'reputation_store', upstreamIds: ['weekly_reputation_store'] },
  { id: 's1_s2_raids', upstreamIds: ['weekly_s1_s2_raids'] },
  { id: 's3_raids_easy', upstreamIds: ['weekly_s3_raids_easy'] },
  { id: 's3_raids_hard', upstreamIds: ['weekly_s3_raids_hard'] },
  { id: 'musician_challenges', upstreamIds: ['weekly_musician_challenges'] },
] satisfies ProjectTaskDefinition[]

// Upstream ids intentionally left out of PROJECT_TASKS (i.e. not referenced
// by any entry above). When adding an entry here, do not add a matching key
// to labels.ja.json.
export const EXCLUDED_UPSTREAM_IDS: string[] = []

import type { ProjectTaskDefinition } from './projectTaskSchema'

// Identity mapping that reuses upstreamTasks.json ids as-is for project ids.
// Only entries that need merging or splitting specify multiple upstreamIds,
// overriding label / color / maxProgress / optional as needed.
export const PROJECT_TASKS = [
  { id: 'daily_mystery_store', upstreamIds: ['daily_mystery_store'] },
  { id: 'daily_guild_checkin', upstreamIds: ['daily_guild_checkin'] },
  { id: 'daily_unstable_clear', upstreamIds: ['daily_unstable_clear'] },
  { id: 'daily_bureau_commissions', upstreamIds: ['daily_bureau_commissions'] },
  {
    id: 'daily_homestead_commissions',
    upstreamIds: ['daily_homestead_commissions'],
  },
  { id: 'daily_world_boss_keys', upstreamIds: ['daily_world_boss_keys'] },
  { id: 'daily_elite_boss_keys', upstreamIds: ['daily_elite_boss_keys'] },
  { id: 'daily_focus', upstreamIds: ['daily_focus'] },
  {
    id: 'daily_season_pass_activity',
    upstreamIds: ['daily_season_pass_activity'],
  },
  { id: 'daily_friendship_list', upstreamIds: ['daily_friendship_list'] },
  {
    id: 'daily_musician_challenge',
    upstreamIds: ['daily_musician_challenge'],
  },
  { id: 'weekly_pioneer_awards', upstreamIds: ['weekly_pioneer_awards'] },
  { id: 'weekly_reclaim_hub', upstreamIds: ['weekly_reclaim_hub'] },
  { id: 'weekly_starland_quests', upstreamIds: ['weekly_starland_quests'] },
  {
    id: 'weekly_illusion_essence',
    upstreamIds: ['weekly_illusion_essence'],
  },
  { id: 'weekly_guild_activity', upstreamIds: ['weekly_guild_activity'] },
  { id: 'weekly_guild_hunt', upstreamIds: ['weekly_guild_hunt'] },
  { id: 'weekly_guild_dance', upstreamIds: ['weekly_guild_dance'] },
  {
    id: 'weekly_world_boss_crusade',
    upstreamIds: ['weekly_world_boss_crusade'],
  },
  {
    id: 'weekly_dungeon_encounter',
    upstreamIds: ['weekly_dungeon_encounter'],
  },
  { id: 'weekly_stimen_vaults', upstreamIds: ['weekly_stimen_vaults'] },
  {
    id: 'weekly_season_store_elite',
    upstreamIds: ['weekly_season_store_elite'],
  },
  { id: 'weekly_season_store', upstreamIds: ['weekly_season_store'] },
  { id: 'weekly_guild_store', upstreamIds: ['weekly_guild_store'] },
  { id: 'weekly_honor_store', upstreamIds: ['weekly_honor_store'] },
  {
    id: 'weekly_friendship_store',
    upstreamIds: ['weekly_friendship_store'],
  },
  { id: 'weekly_event_store', upstreamIds: ['weekly_event_store'] },
  { id: 'weekly_orb_store', upstreamIds: ['weekly_orb_store'] },
  {
    id: 'weekly_gear_exchange_store',
    upstreamIds: ['weekly_gear_exchange_store'],
  },
  {
    id: 'weekly_module_exchange',
    upstreamIds: ['weekly_module_exchange'],
  },
  { id: 'weekly_sigil_store', upstreamIds: ['weekly_sigil_store'] },
  {
    id: 'weekly_reputation_store',
    upstreamIds: ['weekly_reputation_store'],
  },
  { id: 'weekly_s1_s2_raids', upstreamIds: ['weekly_s1_s2_raids'] },
  { id: 'weekly_s3_raids_easy', upstreamIds: ['weekly_s3_raids_easy'] },
  { id: 'weekly_s3_raids_hard', upstreamIds: ['weekly_s3_raids_hard'] },
  {
    id: 'weekly_musician_challenges',
    upstreamIds: ['weekly_musician_challenges'],
  },
] satisfies ProjectTaskDefinition[]

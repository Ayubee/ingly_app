/**
 * Ingly Mobile App - Services Index Export
 */

export * from './supabaseClient';
export * from './storage';
export * from './wordsData';
export * from './syncEngine';
export * from './ttsService';

import supabase from './supabaseClient';
import * as storage from './storage';
import * as wordsData from './wordsData';
import * as syncEngine from './syncEngine';
import * as ttsService from './ttsService';

export {
  supabase,
  storage,
  wordsData,
  syncEngine,
  ttsService,
};

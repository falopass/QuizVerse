import type { Database } from './database';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _DatabaseCheck = Database;

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Quiz = Database['public']['Tables']['quizzes']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type GameSession = Database['public']['Tables']['game_sessions']['Row'];
export type Achievement = Database['public']['Tables']['achievements']['Row'];

// Re-export quiz types
export type { Question, Option, PersonalityResult, Answer, QuizState, QuizAction } from './quiz';

// Auth types
export type User = import('@supabase/supabase-js').User;
export type Session = import('@supabase/supabase-js').Session;
export type Provider = import('@supabase/supabase-js').Provider;

// Helper type to get return type of Supabase queries
export type SupabaseQueryResult<T extends (...args: never[]) => unknown> =
  Awaited<ReturnType<T>> extends { data: infer U } ? U : never;

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

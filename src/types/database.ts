/**
 * Tipos generados de Supabase
 * Se pueden auto-generar con: npx supabase gen types typescript --project-id XXXX
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type QuizType = 'trivia' | 'personality' | 'poll';
export type QuizStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'archived';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ReportReason =
  | 'inappropriate'
  | 'spam'
  | 'incorrect_info'
  | 'hate_speech'
  | 'copyright'
  | 'other';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          points: number;
          quizzes_played: number;
          quizzes_created: number;
          is_admin: boolean;
          is_verified: boolean;
          preferred_language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          points?: number;
          quizzes_played?: number;
          quizzes_created?: number;
          is_admin?: boolean;
          is_verified?: boolean;
          preferred_language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          points?: number;
          quizzes_played?: number;
          quizzes_created?: number;
          is_admin?: boolean;
          is_verified?: boolean;
          preferred_language?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          color: string | null;
          gradient_from: string | null;
          gradient_to: string | null;
          quiz_count: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          gradient_from?: string | null;
          gradient_to?: string | null;
          quiz_count?: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          gradient_from?: string | null;
          gradient_to?: string | null;
          quiz_count?: number;
          sort_order?: number;
          created_at?: string;
        };
      };
      quizzes: {
        Row: {
          id: string;
          creator_id: string | null;
          category_id: string | null;
          title: string;
          slug: string;
          description: string | null;
          cover_image_url: string | null;
          quiz_type: QuizType;
          difficulty: Difficulty;
          language: string;
          questions: Json;
          results: Json | null;
          tags: string[];
          estimated_minutes: number;
          question_count: number;
          plays_count: number;
          shares_count: number;
          avg_score: number | null;
          likes_count: number;
          status: QuizStatus;
          is_featured: boolean;
          is_ai_generated: boolean;
          featured_at: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id?: string | null;
          category_id?: string | null;
          title: string;
          slug: string;
          description?: string | null;
          cover_image_url?: string | null;
          quiz_type?: QuizType;
          difficulty?: Difficulty;
          language?: string;
          questions: Json;
          results?: Json | null;
          tags?: string[];
          estimated_minutes?: number;
          question_count?: number;
          plays_count?: number;
          shares_count?: number;
          avg_score?: number | null;
          likes_count?: number;
          status?: QuizStatus;
          is_featured?: boolean;
          is_ai_generated?: boolean;
          featured_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string | null;
          category_id?: string | null;
          title?: string;
          slug?: string;
          description?: string | null;
          cover_image_url?: string | null;
          quiz_type?: QuizType;
          difficulty?: Difficulty;
          language?: string;
          questions?: Json;
          results?: Json | null;
          tags?: string[];
          estimated_minutes?: number;
          question_count?: number;
          plays_count?: number;
          shares_count?: number;
          avg_score?: number | null;
          likes_count?: number;
          status?: QuizStatus;
          is_featured?: boolean;
          is_ai_generated?: boolean;
          featured_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      game_sessions: {
        Row: {
          id: string;
          quiz_id: string;
          player_id: string | null;
          score: number;
          max_score: number;
          percentage: number;
          result_id: string | null;
          result_title: string | null;
          time_taken_seconds: number | null;
          answers: Json | null;
          share_token: string;
          was_shared: boolean;
          completed_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          player_id?: string | null;
          score?: number;
          max_score: number;
          result_id?: string | null;
          result_title?: string | null;
          time_taken_seconds?: number | null;
          answers?: Json | null;
          share_token?: string;
          was_shared?: boolean;
          completed_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          player_id?: string | null;
          score?: number;
          max_score?: number;
          result_id?: string | null;
          result_title?: string | null;
          time_taken_seconds?: number | null;
          answers?: Json | null;
          share_token?: string;
          was_shared?: boolean;
          completed_at?: string;
        };
      };
      quiz_likes: {
        Row: {
          quiz_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          quiz_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          quiz_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      achievements: {
        Row: {
          id: string;
          name: string;
          description: string;
          icon: string;
          points_reward: number;
          condition_type: string;
          condition_value: number;
        };
        Insert: {
          id: string;
          name: string;
          description: string;
          icon: string;
          points_reward?: number;
          condition_type: string;
          condition_value: number;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          icon?: string;
          points_reward?: number;
          condition_type?: string;
          condition_value?: number;
        };
      };
      user_achievements: {
        Row: {
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
        };
        Insert: {
          user_id: string;
          achievement_id: string;
          unlocked_at?: string;
        };
        Update: {
          user_id?: string;
          achievement_id?: string;
          unlocked_at?: string;
        };
      };
      quiz_reports: {
        Row: {
          id: string;
          quiz_id: string;
          reporter_id: string | null;
          reason: ReportReason;
          details: string | null;
          resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          reporter_id?: string | null;
          reason: ReportReason;
          details?: string | null;
          resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          reporter_id?: string | null;
          reason?: ReportReason;
          details?: string | null;
          resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Views: {};
    Functions: {
      increment_plays: {
        Args: { quiz_uuid: string };
        Returns: void;
      };
      increment_shares: {
        Args: { quiz_uuid: string };
        Returns: void;
      };
      toggle_like: {
        Args: { p_quiz_id: string; p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      quiz_type: 'trivia' | 'personality' | 'poll';
      quiz_status: 'draft' | 'pending' | 'published' | 'rejected' | 'archived';
      difficulty: 'easy' | 'medium' | 'hard';
      report_reason:
        | 'inappropriate'
        | 'spam'
        | 'incorrect_info'
        | 'hate_speech'
        | 'copyright'
        | 'other';
    };
  };
}

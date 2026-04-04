'use client';

import type { Profile } from '@/types/quiz';
import { cn } from '@/lib/utils/cn';

export interface ProfileHeaderProps {
  profile: Profile & {
    achievements_count?: number;
    quizzes_completed?: number;
  };
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-bg-secondary border border-border-subtle p-6 md:p-8">
      {/* Background gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Avatar */}
        <div className="relative">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary p-1">
            <div className="w-full h-full rounded-full bg-bg-secondary flex items-center justify-center text-4xl md:text-5xl">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || profile.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                '👤'
              )}
            </div>
          </div>
          {profile.is_verified && (
            <div className="absolute -bottom-1 -right-1 bg-accent-primary text-white p-1.5 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-1">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-text-secondary mb-3">@{profile.username}</p>
          {profile.bio && (
            <p className="text-text-muted max-w-xl">{profile.bio}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-6 md:gap-8">
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-accent-primary">
              {profile.quizzes_created}
            </div>
            <div className="text-xs text-text-muted">Created</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-accent-secondary">
              {profile.quizzes_played}
            </div>
            <div className="text-xs text-text-muted">Played</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-accent-warm">
              {profile.points.toLocaleString()}
            </div>
            <div className="text-xs text-text-muted">Points</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;

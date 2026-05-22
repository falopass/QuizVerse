'use client';

import type { Profile } from '@/types/quiz';

export interface ProfileHeaderProps {
  profile: Profile & {
    achievements_count?: number;
    quizzes_completed?: number;
  };
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="bg-bg-secondary border-border-subtle relative overflow-hidden rounded-2xl border p-6 md:p-8">
      {/* Background gradient */}
      <div className="bg-accent-primary/10 absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-start">
        {/* Avatar */}
        <div className="relative">
          <div className="from-accent-primary to-accent-secondary h-24 w-24 rounded-full bg-gradient-to-br p-1 md:h-32 md:w-32">
            <div className="bg-bg-secondary flex h-full w-full items-center justify-center rounded-full text-4xl md:text-5xl">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || profile.username}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                '👤'
              )}
            </div>
          </div>
          {profile.is_verified && (
            <div className="bg-accent-primary absolute -right-1 -bottom-1 rounded-full p-1.5 text-white">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
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
          <h1 className="text-text-primary mb-1 text-2xl font-bold md:text-3xl">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-text-secondary mb-3">@{profile.username}</p>
          {profile.bio && <p className="text-text-muted max-w-xl">{profile.bio}</p>}
        </div>

        {/* Stats */}
        <div className="flex gap-6 md:gap-8">
          <div className="text-center">
            <div className="text-accent-primary text-2xl font-bold md:text-3xl">
              {profile.quizzes_created}
            </div>
            <div className="text-text-muted text-xs">Created</div>
          </div>
          <div className="text-center">
            <div className="text-accent-secondary text-2xl font-bold md:text-3xl">
              {profile.quizzes_played}
            </div>
            <div className="text-text-muted text-xs">Played</div>
          </div>
          <div className="text-center">
            <div className="text-accent-warm text-2xl font-bold md:text-3xl">
              {profile.points.toLocaleString()}
            </div>
            <div className="text-text-muted text-xs">Points</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;

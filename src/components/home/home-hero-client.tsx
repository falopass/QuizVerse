'use client';

import { HeroSection, StaggerItem } from './hero-section';

export function HomeHeroClient({ children }: { children: React.ReactNode }) {
  return (
    <HeroSection>
      <StaggerItem>{children}</StaggerItem>
    </HeroSection>
  );
}

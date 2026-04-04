'use client';

import { useEffect, useState } from 'react';

const KEYBOARD_SHORTCUT = 'k';

export function useCommandMenu(openMenu: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (modifier && event.key.toLowerCase() === KEYBOARD_SHORTCUT) {
        event.preventDefault();
        openMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openMenu]);
}

export default useCommandMenu;

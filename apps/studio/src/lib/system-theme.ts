import { studioInterfaceChangeEvent } from '@/lib/studio-interface';

type SystemThemeMedia = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;

export function watchSystemTheme(
  media: SystemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)'),
  root: HTMLElement = document.documentElement,
) {
  const apply = () => {
    const fixedLightPalette = root.dataset.studioInterface === 'rpgMakerMz';
    root.classList.toggle('dark', !fixedLightPalette && media.matches);
    root.style.colorScheme = fixedLightPalette ? 'light' : media.matches ? 'dark' : 'light';
  };
  apply();
  media.addEventListener('change', apply);
  root.addEventListener(studioInterfaceChangeEvent, apply);
  return () => {
    media.removeEventListener('change', apply);
    root.removeEventListener(studioInterfaceChangeEvent, apply);
  };
}

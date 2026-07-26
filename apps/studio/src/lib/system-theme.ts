type SystemThemeMedia = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;

export function watchSystemTheme(
  media: SystemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)'),
  root: HTMLElement = document.documentElement,
) {
  const apply = () => {
    root.classList.toggle('dark', media.matches);
    root.style.colorScheme = media.matches ? 'dark' : 'light';
  };
  apply();
  media.addEventListener('change', apply);
  return () => media.removeEventListener('change', apply);
}

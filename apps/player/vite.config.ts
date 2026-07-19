import { defineConfig } from 'vite';

export default defineConfig({
  // Game packages stay outside the runtime source tree and are copied verbatim.
  publicDir: '../../content',
});

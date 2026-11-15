import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0A0B0D' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0A0B0D' } },
  },
  images: ['public/logo.svg'],
});

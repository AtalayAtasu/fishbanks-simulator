import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_PAGES === 'true' && repo ? `/${repo}/` : '/';

export default defineConfig({
  plugins: [react()],
  base,
});

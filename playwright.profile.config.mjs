import {defineConfig} from '@playwright/test';
import config from './playwright.config.mjs';

export default defineConfig({...config,
  testMatch:'reader-performance.profile.mjs',
  projects:config.projects.filter(project=>project.name==='desktop-chromium')
});

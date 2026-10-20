import {defineConfig} from '@playwright/test';
import config from './playwright.config.mjs';

export default defineConfig({...config,
  testMatch:'library-startup.profile.mjs',
  reporter:[['list']],
  outputDir:'library-startup-results/test-output',
  use:{...config.use,trace:'off',screenshot:'off'},
  projects:config.projects.filter(project=>project.name==='desktop-chromium')
});

import {defineConfig,devices} from '@playwright/test';
import {baseURL} from './tests/browser/fixture.mjs';

export default defineConfig({
  testDir:'./tests/browser',testMatch:'*.spec.mjs',fullyParallel:false,workers:1,
  forbidOnly:!!process.env.CI,retries:0,timeout:30000,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL,ignoreHTTPSErrors:true,trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}},
    {name:'desktop-firefox',use:{...devices['Desktop Firefox']}},
    {name:'desktop-webkit',use:{...devices['Desktop Safari']}},
    {name:'mobile-webkit',use:{...devices['iPhone 13']}}
  ],
  webServer:{command:'node scripts/browser-server.mjs',url:baseURL,ignoreHTTPSErrors:true,
    reuseExistingServer:false,timeout:120000,stdout:'pipe',gracefulShutdown:{signal:'SIGTERM',timeout:5000}}
});

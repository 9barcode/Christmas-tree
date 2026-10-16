import { defineConfig } from '@apps-in-toss/web-framework/config';
export default defineConfig({
  appName: process.env.TOSS_APP_NAME || 'christmas-tree-decorating',
  brand: { primaryColor: '#175C43' },
  permissions: [],
  webView: { bounces: false, pullToRefreshEnabled: false, overScrollMode: 'never', allowsBackForwardNavigationGestures: false },
  webBundleDir: 'dist/toss',
});

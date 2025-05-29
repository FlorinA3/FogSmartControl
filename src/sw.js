import * as Sentry from '@sentry/service-worker';

Sentry.init({
  dsn: 'YOUR_DSN_HERE',
  release: 'fog-control@1.0.0'
});

self.addEventListener('error', event => {
  Sentry.captureException(event.error);
});

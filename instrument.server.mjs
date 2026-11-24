import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
  dsn: "https://0877f96bb4efef7bc0a22622b6ac2f5b@o4511860280197120.ingest.de.sentry.io/4512215108943952",
  // SDK v11 "no default PII": no inferred IP, cookies, headers, bodies or query strings.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
});

import * as Sentry from "@sentry/tanstackstart-react";

// Error reports only. Sentry SDK v11 replaced `sendDefaultPii` with
// `dataCollection`: the values below are its "no default PII" setting (no
// inferred IP, no cookies, headers, bodies or query strings). No Session
// Replay integration is added. See /privacy, "Error reports (Sentry)".
Sentry.init({
  dsn: "https://0877f96bb4efef7bc0a22622b6ac2f5b@o4511860280197120.ingest.de.sentry.io/4512215108943952",
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
});

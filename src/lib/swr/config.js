// file location: src/lib/swr/config.js
// Global SWR configuration for the HNP system.
// Provides stale-while-revalidate defaults tuned for workshop usage.

export const swrConfig = {
  revalidateOnFocus: true, // refetch when user tabs back to the app
  revalidateOnReconnect: true, // refetch after network recovery
  dedupingInterval: 5000, // deduplicate identical requests within 5 seconds
  focusThrottleInterval: 10000, // throttle focus-triggered revalidation to 10 seconds
  errorRetryCount: 2, // retry failed requests twice before giving up
  errorRetryInterval: 3000, // wait 3 seconds between retries
  shouldRetryOnError: true, // enable automatic error retry
};

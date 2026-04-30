// Shared helpers for presentation mock files.
// Each presentation mock wraps a real `src/components/page-ui/*` file with
// demo props so the slide layout always tracks the live page UI. These
// helpers cut boilerplate when the same demo user, no-op handler, or
// placeholder component shows up across many pages.
import React from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import StatusMessage from "@/components/ui/StatusMessage";
import { ContentWidth, PageShell, SectionShell } from "@/components/ui";
import { SearchBar } from "@/components/ui/searchBarAPI";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import FilterToolbarRow from "@/components/ui/layout-system/FilterToolbarRow";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { SectionCard } from "@/components/Section";
import { MetricCard, StatusTag } from "@/components/HR/MetricCard";

export const DEMO_USER = {
  id: "demo-user",
  user_id: "demo-user",
  username: "Demo User",
  display_name: "Demo User",
  full_name: "Demo User",
  email: "demo@hnp.example",
  roles: ["demo"],
  role: "demo",
};

export const noop = () => {};

// Placeholder for sub-components a page-ui file expects to receive when we
// don't want to import the real one inside a mock (e.g. components that hit
// Supabase or take heavy hook-derived props of their own).
export const NoopComponent = React.forwardRef(function NoopComponent(
  { children, style },
  ref
) {
  return React.createElement(
    "div",
    {
      ref,
      "data-presentation-stub": true,
      style: { ...style, minHeight: 0 },
    },
    children
  );
});

// Common UI primitives every page is likely to receive as props. Mock files
// can spread this into their overrides so they only need to specify the
// page-specific data and handlers.
export const SHARED_UI_DEPS = {
  Button,
  ContentWidth,
  DevLayoutSection,
  DropdownField,
  CalendarField,
  FilterToolbarRow,
  InputField,
  Link,
  MetricCard,
  PageShell,
  PageSkeleton,
  SearchBar,
  SectionCard,
  SectionShell,
  StatusMessage,
  StatusTag,
  TabGroup,
  popupCardStyles,
  popupOverlayStyles,
};

// Heuristic prop matchers — used by createDemoProps below to supply safe
// fallback values when a page-ui file destructures a prop the mock didn't
// explicitly override.
//
// HANDLER_RE only matches names where a canonical handler prefix is followed
// by a Capital letter (camelCase boundary). This keeps `setShow`, `onClick`,
// `handleSubmit` recognised as handlers, while `searchTerm`, `filterValue`,
// `sortOrder`, `keyName`, `formatString` stay as data — last time the regex
// included verbs like `search`/`filter`/`sort` it grabbed `searchTerm.trim()`
// and crashed because handlers don't have `.trim`.
const HANDLER_RE = /^(set|on|handle|toggle|reset|open|close|cancel|confirm|submit|save|delete|refresh|reload|navigate|register|unregister|emit|dispatch|fetch|add|create|update|remove|approve|reject|prefetch|format|get|build|calculate|derive|compute|count|parse|render|validate|transform|normalize|serialize|resolve|capture|detect|prime|run|insert|copy|move|complete|finish|mark|edit|apply|persist|clear|change|select|go|emit|raise|notify|track|log)[A-Z]/;
const COLLECTION_RE = /(List|Items|Records|Rows|Entries|Logs|Updates|Notes|Messages|Jobs|Parts|Vehicles|Customers|Users|Categories|Departments|Options|Choices|Types|Statuses|Reports|Files|Cards|Sections|Tabs|Steps|Links|Filters|Results|Tasks|Slides|Buckets|Groups|Rooms|Roles|Tags|Photos|Images|Pages|Picks|Counts|Detections|Suggestions|Threads|Recipients|Reactions|Definitions|Locations|Lines|Histories|Bookings|Appointments|Notifications|Boundaries|Errors)$/;
const BOOLEAN_RE = /^(is|has|can|should|allow|show|enable|disable|requires|did|was|were)[A-Z]/;
const NUMBER_RE = /(Count|Index|Total|Length|Size|Page|Limit|Offset)$/;
const STYLE_RE = /(Style|Styles|Theme|Class|ClassName)$/;

// Recursive "safe" placeholder used for unknown props that look like nested
// data structures (dashboardData, metrics, summary, etc.). Returns itself for
// any property access so chains like `dashboardData.dailySummary.inProgress`
// don't throw. Coerces to "" / 0 / [] / false depending on how it's used so
// it renders cleanly inside JSX, template literals and conditionals.
//
// The target is a plain object (not a function) so `typeof SAFE_VALUE` is
// "object" — React's child reconciler then checks Symbol.iterator and
// iterates an empty sequence, so accidentally rendering SAFE_VALUE directly
// produces nothing instead of throwing "Objects are not valid as a React
// child".
const SAFE_VALUE = new Proxy({}, {
  get(_t, key) {
    if (key === Symbol.iterator) return function* iter() {}; // empty iterable
    if (key === Symbol.asyncIterator) return undefined;
    if (key === Symbol.toPrimitive) return () => "";
    if (key === "toString") return () => "";
    if (key === "valueOf") return () => 0;
    if (key === "toJSON") return () => null;
    if (key === "then") return undefined; // not a thenable
    if (key === "$$typeof") return undefined; // not a React element
    if (key === "type") return undefined;
    if (key === "props") return {};
    if (key === "ref") return null;
    if (key === "key") return null;
    if (key === "length") return 0;
    if (key === "size") return 0;
    // Common array methods — return safe equivalents so .map/.filter chains
    // don't blow up when a page-ui assumed an array.
    if (key === "map" || key === "filter" || key === "flatMap") return () => [];
    if (key === "forEach") return () => undefined;
    if (key === "reduce") return (_fn, init) => init;
    if (key === "find") return () => undefined;
    if (key === "some" || key === "every" || key === "includes") return () => false;
    if (key === "join") return () => "";
    if (key === "slice" || key === "concat") return () => [];
    if (key === "split") return () => [""];
    if (key === "trim" || key === "toLowerCase" || key === "toUpperCase") return () => "";
    if (typeof key === "symbol") return undefined;
    return SAFE_VALUE;
  },
});

function defaultForName(prop) {
  if (typeof prop !== "string") return undefined;
  if (prop === "view") return "section1";
  if (prop === "user") return DEMO_USER;
  if (prop === "session") return { user: DEMO_USER };
  if (prop === "router") return { query: {}, asPath: "/", pathname: "/", push: noop, replace: noop, back: noop };
  if (prop === "loading" || prop === "saving" || prop === "isLoading" || prop === "isSaving" || prop === "isFetching" || prop === "submitting") return false;
  if (prop === "error" || prop === "errorMessage" || prop === "notificationError" || prop === "renderError") return "";
  if (prop in SHARED_UI_DEPS) return SHARED_UI_DEPS[prop];
  if (HANDLER_RE.test(prop)) return noop;
  if (/^[A-Z]/.test(prop)) return NoopComponent;
  if (COLLECTION_RE.test(prop)) return [];
  if (BOOLEAN_RE.test(prop)) return false;
  if (NUMBER_RE.test(prop)) return 0;
  if (STYLE_RE.test(prop)) return {};
  // Anything else gets the recursive safe value so nested access doesn't crash.
  return SAFE_VALUE;
}

// Returns a Proxy props object suitable for passing to a page-ui component
// via React.createElement. Any prop not listed in `overrides` falls back to
// a heuristic default keyed off the prop name.
export function createDemoProps(overrides = {}) {
  const target = { ...SHARED_UI_DEPS, ...overrides };
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === "symbol") return t[prop];
      if (Object.prototype.hasOwnProperty.call(t, prop)) return t[prop];
      return defaultForName(prop);
    },
    has() {
      return true;
    },
  });
}

// Convenience: render a page-ui component with demo props.
//
// We intentionally call `Ui(props)` directly rather than going through
// React.createElement(Ui, proxy). React.createElement copies enumerable own
// properties off the second argument via `for...in`, which would strip every
// Proxy-supplied fallback (only the explicit `overrides` keys survive). By
// calling Ui as a function we keep the Proxy intact, so any prop the page-ui
// destructures hits the heuristic default for its name (NoopComponent for
// PascalCase, [] for plurals, no-op for handlers, etc.).
//
// Page-ui files in this codebase are pure presentation (no hooks of their
// own). If a future page-ui needs hooks, it should be wrapped in a real
// component component before being mocked.
export function MockPage({ Ui, overrides }) {
  const props = createDemoProps(overrides);
  return Ui(props);
}

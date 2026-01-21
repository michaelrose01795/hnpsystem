import { buildVhcRowStatusView } from "../src/lib/vhc/summaryStatus.js";

const tests = [];

const addTest = (name, input, expected) => {
  tests.push({ name, input, expected });
};

const runTest = ({ name, input, expected }) => {
  const result = buildVhcRowStatusView(input);
  const failures = [];
  Object.entries(expected).forEach(([key, value]) => {
    if (result[key] !== value) {
      failures.push(`${key}: expected ${value}, got ${result[key]}`);
    }
  });
  return { name, passed: failures.length === 0, failures };
};

const baseInput = {
  rawSeverity: "red",
  displayStatus: null,
  decisionValue: "pending",
  labourHoursValue: "",
  labourComplete: false,
  partsNotRequired: false,
  resolvedPartsCost: 0,
  partsCost: "",
  totalOverride: "",
};

addTest(
  "1. Pending + red severity + missing labour+parts -> section red, status Add labour & parts",
  { ...baseInput },
  { sectionKey: "red", label: "Add labour & parts" }
);

addTest(
  "2. Pending + red severity + missing labour -> section red, status Add labour",
  { ...baseInput, resolvedPartsCost: 100 },
  { sectionKey: "red", label: "Add labour" }
);

addTest(
  "3. Pending + amber severity + missing parts -> section amber, status Add parts",
  { ...baseInput, rawSeverity: "amber", labourHoursValue: "1", labourComplete: true },
  { sectionKey: "amber", label: "Add parts" }
);

addTest(
  "4. Pending + red severity + labour+parts ready -> section red, status Awaiting customer decision",
  { ...baseInput, labourHoursValue: "1", labourComplete: true, resolvedPartsCost: 150 },
  { sectionKey: "red", label: "Awaiting customer decision" }
);

addTest(
  "5. Authorized + red severity -> section authorized, background red, status Authorised, dot green",
  { ...baseInput, decisionValue: "authorized", resolvedPartsCost: 150 },
  { sectionKey: "authorized", label: "Authorised", dotStateKey: "approved", severityKey: "red" }
);

addTest(
  "6. Declined + amber severity -> section declined, status Declined, dot red",
  { ...baseInput, rawSeverity: "amber", decisionValue: "declined" },
  { sectionKey: "declined", label: "Declined", dotStateKey: "declined" }
);

addTest(
  "7. Completed + red severity -> section authorized, status Completed",
  { ...baseInput, decisionValue: "completed" },
  { sectionKey: "authorized", label: "Completed" }
);

addTest(
  "8. Reset authorized -> pending restores section to original severity",
  { ...baseInput, decisionValue: "pending", displayStatus: "red" },
  { sectionKey: "red" }
);

addTest(
  "9. Stale display_status=authorized but approval pending -> severity section",
  { ...baseInput, displayStatus: "authorized" },
  { sectionKey: "red", severityKey: "red" }
);

addTest(
  "10. Bulk reset behaves same as single reset",
  { ...baseInput, decisionValue: "pending", displayStatus: "amber", rawSeverity: "amber" },
  { sectionKey: "amber" }
);

const results = tests.map(runTest);
const failed = results.filter((result) => !result.passed);

results.forEach((result) => {
  if (result.passed) {
    console.log(`PASS: ${result.name}`);
  } else {
    console.log(`FAIL: ${result.name}`);
    result.failures.forEach((failure) => console.log(`  - ${failure}`));
  }
});

if (failed.length > 0) {
  console.log(`\n${failed.length} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${results.length} tests passed.`);
}

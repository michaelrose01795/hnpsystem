// file location: src/lib/auth/allAccessSession.test.js
//
// The All Access demo login is a synthetic, code-minted session. These tests
// lock the two halves of its contract:
//   1. IDENTIFICATION is exact — only the session the credentials provider
//      actually returns is recognised, so a crafted user object cannot claim it.
//   2. It really does open everything — every workspace group, every page in
//      its sidebar — EXCEPT the Developer Platform, which stays dev-only
//      (🔒 DEVELOPER SIDEBAR LOCK).

import { describe, it, expect } from "vitest";
import {
  ALL_ACCESS_SESSION_USER,
  ALL_ACCESS_USER_ID,
  isAllAccessToken,
  isAllAccessUser,
} from "@/lib/auth/allAccessSession";
import {
  ALL_ACCESS_ROLE,
  hasAnyRole,
  isCustomerRole,
  isMobileTechnician,
} from "@/lib/auth/roles";
import { ALL_ACCESS_USER_PROFILE } from "@/lib/database/allAccessUser";
import {
  ALL_ACCESS_EMAIL,
  excludeAllAccessUser,
  withoutAllAccessUser,
} from "@/lib/database/allAccessVisibility";
import {
  hasCustomerBookingRequestAccess,
  hasServiceActionAccess,
} from "@/lib/auth/serviceActionRoles";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import { resolveJobCardPermissions } from "@/features/jobCards/workflow/permissions";
import { resolveScope, SCOPE_LEVELS } from "@/lib/reporting/permissionScope";
import { resolveDepartmentForRoles } from "@/lib/reporting/config/departments";
import { canAccessPath } from "@/lib/auth/pageAccess";
import {
  getRoleWorkspaceModules,
  getWorkspaceGroups,
  WORKSPACE_DEPARTMENTS,
} from "@/config/workspace/manifest";

const ROLES = [ALL_ACCESS_ROLE];

describe("all access session — identification", () => {
  it("recognises the session the credentials provider mints", () => {
    expect(isAllAccessUser(ALL_ACCESS_SESSION_USER)).toBe(true);
    expect(
      isAllAccessToken({
        userId: ALL_ACCESS_USER_ID,
        roles: [ALL_ACCESS_ROLE],
        isDevLogin: true,
      })
    ).toBe(true);
  });

  it("rejects anything that is not that exact session", () => {
    expect(isAllAccessUser(null)).toBe(false);
    // A real staff account cannot become all-access by holding the id...
    expect(isAllAccessUser({ id: ALL_ACCESS_USER_ID, roles: ["admin"], isDevLogin: true })).toBe(false);
    // ...nor by holding the role without being the code-minted dev login, which
    // is the half an ordinary email/password session can never produce.
    expect(isAllAccessUser({ id: 42, roles: [ALL_ACCESS_ROLE], isDevLogin: false })).toBe(false);
    expect(isAllAccessToken({ userId: 42, roles: ["admin manager"], isDevLogin: true })).toBe(false);
  });

  it("is identified by its role, not its id, so the real users row works", () => {
    // The live session carries the demo account's numeric users.user_id; the
    // synthetic id is only the offline fallback. Both must be recognised.
    expect(isAllAccessUser({ ...ALL_ACCESS_SESSION_USER, id: 42 })).toBe(true);
  });
});

describe("all access session — database identity", () => {
  it("has made-up staff details and no usable password", () => {
    expect(ALL_ACCESS_USER_PROFILE.email).toBe(ALL_ACCESS_EMAIL);
    expect(ALL_ACCESS_USER_PROFILE.first_name).toBeTruthy();
    expect(ALL_ACCESS_USER_PROFILE.last_name).toBeTruthy();
    // Every profile field the page renders is populated, so nothing reads empty.
    for (const field of [
      "job_title",
      "department",
      "phone",
      "employment_type",
      "employment_status",
      "start_date",
      "contracted_hours",
      "hourly_rate",
      "annual_salary",
      "payroll_reference",
      "national_insurance_number",
      "home_address",
      "emergency_contact",
    ]) {
      expect(ALL_ACCESS_USER_PROFILE[field], field).toBeTruthy();
    }
    // 'unset' makes verifyPassword() return false for ANY submitted password,
    // so the email/password form can never sign in as this account.
    expect(ALL_ACCESS_USER_PROFILE.password_algo).toBe("unset");
    expect(ALL_ACCESS_USER_PROFILE.password_hash).toBe("");
  });
});

describe("all access session — invisibility", () => {
  it("filters itself out of a users query", () => {
    // Minimal stand-in for the Supabase builder: records the filter applied.
    const calls = [];
    const builder = {
      neq(column, value) {
        calls.push([column, value]);
        return this;
      },
    };
    expect(excludeAllAccessUser(builder)).toBe(builder);
    expect(calls).toEqual([["email", ALL_ACCESS_EMAIL]]);
  });

  it("filters itself out of rows already in memory, case-insensitively", () => {
    const rows = [
      { email: "real.tech@example.com" },
      { email: ALL_ACCESS_EMAIL.toUpperCase() },
      { email: "real.manager@example.com" },
    ];
    expect(withoutAllAccessUser(rows).map((row) => row.email)).toEqual([
      "real.tech@example.com",
      "real.manager@example.com",
    ]);
  });

  it("keys the filter off the same address the seeded row uses", () => {
    // If these ever drift, the demo account becomes visible to everyone.
    expect(ALL_ACCESS_USER_PROFILE.email).toBe(ALL_ACCESS_EMAIL);
  });
});

describe("all access session — reach", () => {
  it("satisfies every role check", () => {
    expect(hasAnyRole(ROLES, ["admin manager"])).toBe(true);
    expect(hasAnyRole(ROLES, ["techs", "mot tester"])).toBe(true);
    // A role list that is NOT all-access is still evaluated normally.
    expect(hasAnyRole(["techs"], ["admin manager"])).toBe(false);
  });

  it("gets every workspace group except Developer", () => {
    const groups = getWorkspaceGroups(ROLES).map((group) => group.key);
    const expected = WORKSPACE_DEPARTMENTS.filter(
      (department) =>
        (department.category === "general" || department.category === "departments") &&
        department.key !== "developer"
    ).map((department) => department.key);
    expect(groups).toEqual(expected);
  });

  it("gets a sidebar of modules whose every page it can also land on", () => {
    const modules = getRoleWorkspaceModules(ROLES);
    expect(modules.length).toBeGreaterThan(1);
    const hrefs = modules.flatMap((navigationModule) =>
      navigationModule.items.map((item) => item.href)
    );
    expect(hrefs.length).toBeGreaterThan(40);
    const unlandable = hrefs
      .map((href) => href.split("?")[0].split("#")[0])
      .filter((href) => !canAccessPath(href, ROLES));
    expect(unlandable).toEqual([]);
  });

  it("can navigate to and land on the technician dashboard", () => {
    const hrefs = getRoleWorkspaceModules(ROLES).flatMap((navigationModule) =>
      navigationModule.items.map((item) => item.href)
    );
    expect(hrefs).toContain("/tech/dashboard");
    expect(canAccessPath("/tech/dashboard", ROLES)).toBe(true);
  });

  it("gets every accounts permission, with no narrowing filters", () => {
    const permissions = deriveAccountPermissions(ROLES);
    for (const grant of [
      "canViewAccounts",
      "canCreateAccount",
      "canEditAccount",
      "canFreezeAccount",
      "canAdjustBalance",
      "canViewInvoices",
      "canEditInvoices",
      "canCreateTransactions",
      "canExport",
      "navEligible",
    ]) {
      expect(permissions[grant], grant).toBe(true);
    }
    expect(permissions.restrictedAccountTypes).toBeNull();
    expect(permissions.restrictInvoicesToJobs).toBe(false);
  });

  it("gets every role-gated job-card right and tab", () => {
    const permissions = resolveJobCardPermissions({ userRoles: ROLES, jobStatus: "In Progress" });
    expect(permissions.canEditBase).toBe(true);
    expect(permissions.canEdit).toBe(true);
    expect(permissions.canManageDocuments).toBe(true);
    expect(permissions.canViewPartsTab).toBe(true);
    expect(permissions.isWorkshopManager).toBe(true);
    expect(permissions.tabs.map((tab) => tab.id)).toContain("parts");
  });

  it("gets executive reporting scope over every department", () => {
    const scope = resolveScope(ROLES);
    expect(scope.level).toBe(SCOPE_LEVELS.EXECUTIVE);
    expect(scope.sensitive.pii).toBe(true);
    expect(scope.sensitive.financial).toBe(true);
  });

  it("resolves to a department so department-derived surfaces are not empty", () => {
    expect(resolveDepartmentForRoles(ROLES)).toBe("management");
  });

  it("is NOT treated as a customer or a mobile technician", () => {
    // These predicates pick a NARROWER view; answering yes would restrict, not open.
    expect(isCustomerRole(ALL_ACCESS_ROLE)).toBe(false);
    expect(isMobileTechnician(ROLES)).toBe(false);
  });

  it("passes the service-action gates that drive job creation and booking requests", () => {
    expect(hasServiceActionAccess(ROLES)).toBe(true);
    expect(hasCustomerBookingRequestAccess(ROLES)).toBe(true);
    // A role outside the lists is still refused.
    expect(hasServiceActionAccess(["techs"])).toBe(false);
  });

  it("never surfaces the Developer Platform", () => {
    const hrefs = getRoleWorkspaceModules(ROLES).flatMap((navigationModule) =>
      navigationModule.items.map((item) => item.href)
    );
    expect(hrefs.filter((href) => href.startsWith("/dev"))).toEqual([]);
  });
});

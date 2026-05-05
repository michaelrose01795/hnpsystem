// file location: /src/components/LoginDropdown.js
import React, { useEffect, useMemo } from "react";
import { Dropdown } from "@/components/ui/dropdownAPI";

const ROLE_ALIASES = {
  "valet service": ["valet"],
};
const DEFAULT_DEV_LOGIN_CATEGORY = "retail";
const DEFAULT_DEV_LOGIN_DEPARTMENT = "workshop";
const DEFAULT_DEV_LOGIN_USER = "michael";

const normalizeValue = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const isPreferredDevLoginDepartment = (category, department) =>
  normalizeValue(category) === DEFAULT_DEV_LOGIN_CATEGORY &&
  normalizeValue(department) === DEFAULT_DEV_LOGIN_DEPARTMENT;

const isPreferredDevLoginUser = (user) =>
  normalizeValue(user?.name).split(" ").includes(DEFAULT_DEV_LOGIN_USER);

const isManagerRole = (role) => normalizeValue(role).includes("manager");

const getDepartmentPairKey = (label) =>
  normalizeValue(label)
    .replace(/\bmanager\b/g, "")
    .replace(/\bdepartment\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const sortDepartmentGroups = (groups) =>
  [...groups].sort((a, b) => {
    const aPairKey = getDepartmentPairKey(a.label);
    const bPairKey = getDepartmentPairKey(b.label);
    const aWorkshop = aPairKey === "workshop";
    const bWorkshop = bPairKey === "workshop";

    if (aWorkshop !== bWorkshop) return aWorkshop ? -1 : 1;
    if (aPairKey !== bPairKey) return aPairKey.localeCompare(bPairKey);
    if (a.isManagerRole !== b.isManagerRole) return a.isManagerRole ? 1 : -1;
    return a.label.localeCompare(b.label);
  });

const resolveDepartmentRoster = (source, department) => {
  if (!source || !department) return null;
  if (source[department]) return source[department];
  const aliases = ROLE_ALIASES[String(department).toLowerCase()] || [];
  for (const alias of aliases) {
    const aliasMatchKey = Object.keys(source).find(
      (key) => key.toLowerCase() === String(alias).toLowerCase()
    );
    if (aliasMatchKey) return source[aliasMatchKey];
  }
  const matchKey = Object.keys(source).find(
    (key) => key.toLowerCase() === department.toLowerCase()
  );
  return matchKey ? source[matchKey] : null;
};

const toUserOption = (user, index, fallbackDepartment) =>
  typeof user === "string"
    ? {
        id: `${fallbackDepartment}-${index}`,
        name: user,
        role: fallbackDepartment,
      }
    : {
        id: user.id ?? user.user_id ?? `${fallbackDepartment}-${index}`,
        name:
          user.name ||
          user.displayName ||
          user.fullName ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          user.email ||
          `User ${index + 1}`,
        email: user.email || "",
        department: user.department || fallbackDepartment,
        role: user.role || fallbackDepartment,
        customerId: user.customerId || user.customer_id || null,
      };

/**
 * LoginDropdown
 * Props:
 * - selectedCategory: Retail or Sales selection
 * - setSelectedCategory: setter for category
 * - selectedDepartment: department within the category
 * - setSelectedDepartment: setter for department
 * - selectedUser: currently selected user
 * - setSelectedUser: setter for user
 * - usersByRole: object containing users grouped by role
 * - roleCategories: mapping of category -> departments
 */
export default function LoginDropdown({
  selectedCategory,
  setSelectedCategory,
  selectedDepartment,
  setSelectedDepartment,
  selectedUser,
  setSelectedUser,
  allUsers,
  usersByRole,
  usersByRoleDetailed,
  roleCategories,
  onSingleUserDepartmentLogin,
  className = "",
}) {
  const formatUserName = (role, user) => {
    if (isManagerRole(role)) {
      return `${user} (Manager)`;
    }

    return user;
  };

  const categorizedUsers = useMemo(() => {
    if (!selectedCategory) return [];

    const allowedRoles = new Set(
      (roleCategories?.[selectedCategory] || []).map((role) => normalizeValue(role))
    );

    const baseUsers =
      Array.isArray(allUsers) && allUsers.length > 0
        ? allUsers
        : Object.values(usersByRoleDetailed || {}).flat();

    return baseUsers.filter((user) => allowedRoles.has(normalizeValue(user?.role)));
  }, [allUsers, roleCategories, selectedCategory, usersByRoleDetailed]);

  const departmentGroups = useMemo(() => {
    if (!selectedCategory) return [];

    const groups = new Map();

    (roleCategories?.[selectedCategory] || []).forEach((department) => {
      const directUsers = categorizedUsers.filter(
        (user) => normalizeValue(user?.role) === normalizeValue(department)
      );
      const fallbackUsers =
        resolveDepartmentRoster(usersByRoleDetailed, department) ||
        resolveDepartmentRoster(usersByRole, department) ||
        [];
      const users = directUsers.length > 0 ? directUsers : fallbackUsers;

      if (users.length === 0) return;

      const firstUser = users.find((user) => typeof user !== "string");
      const label = isManagerRole(department)
        ? department
        : String(firstUser?.department || department).trim() || department;
      const key = normalizeValue(label);
      const existing = groups.get(key);

      if (existing) {
        existing.users.push(...users);
        return;
      }

      groups.set(key, {
        key,
        label,
        users: [...users],
        isManagerRole: isManagerRole(department),
      });
    });

    return sortDepartmentGroups(Array.from(groups.values()));
  }, [
    categorizedUsers,
    roleCategories,
    selectedCategory,
    usersByRole,
    usersByRoleDetailed,
  ]);

  const userOptions = useMemo(() => {
    if (!selectedDepartment) return [];
    const selectedGroup = departmentGroups.find(
      (group) => group.key === normalizeValue(selectedDepartment)
    );
    const detailed = resolveDepartmentRoster(usersByRoleDetailed, selectedDepartment);
    const fallback = resolveDepartmentRoster(usersByRole, selectedDepartment);
    const source =
      (Array.isArray(selectedGroup?.users) && selectedGroup.users.length > 0
        ? selectedGroup.users
        : null) ||
      (Array.isArray(detailed) && detailed.length > 0 ? detailed : fallback || []);

    return source.map((user, index) =>
      toUserOption(user, index, selectedDepartment)
    );
  }, [departmentGroups, selectedDepartment, usersByRole, usersByRoleDetailed]);

  useEffect(() => {
    if (!selectedUser || userOptions.length === 0) return;
    const selectedId = String(
      selectedUser.id ?? selectedUser.user_id ?? selectedUser.email ?? selectedUser.name ?? ""
    );
    const selectedName = String(
      selectedUser.name ?? selectedUser.displayName ?? selectedUser.fullName ?? ""
    )
      .toLowerCase()
      .trim();
    const match =
      userOptions.find((user) => {
        const candidateId = String(
          user.id ?? user.user_id ?? user.email ?? user.name ?? ""
        );
        return candidateId && selectedId && candidateId === selectedId;
      }) ||
      userOptions.find((user) => {
        const candidateName = String(user.name ?? "").toLowerCase().trim();
        return candidateName && selectedName && candidateName === selectedName;
      });
    if (!match) {
      setSelectedUser(null);
      return;
    }
    if (match !== selectedUser) {
      setSelectedUser(match);
    }
  }, [userOptions, selectedUser, setSelectedUser]);

  useEffect(() => {
    if (!selectedDepartment || userOptions.length !== 1) return;
    const onlyUser = userOptions[0];
    if (!onlyUser) return;
    if (!selectedUser || selectedUser.id !== onlyUser.id) {
      setSelectedUser(onlyUser);
    }
  }, [selectedDepartment, userOptions, selectedUser, setSelectedUser]);

  useEffect(() => {
    if (!isPreferredDevLoginDepartment(selectedCategory, selectedDepartment)) return;
    if (selectedUser || userOptions.length === 0) return;
    const preferredUser = userOptions.find(isPreferredDevLoginUser);
    if (preferredUser) {
      setSelectedUser(preferredUser);
    }
  }, [
    selectedCategory,
    selectedDepartment,
    selectedUser,
    setSelectedUser,
    userOptions,
  ]);

  const wrapperClassName = ["login-dropdown", className].filter(Boolean).join(" ").trim();

  const categoryOptions = useMemo(
    () =>
      Object.keys(roleCategories || {}).map((category) => ({
        key: category,
        value: category,
        label: category,
      })),
    [roleCategories]
  );

  const departmentOptions = useMemo(() => {
    if (!selectedCategory) return [];
    return departmentGroups.map((department) => ({
      key: department.key,
      value: department.label,
      label: department.label,
      description: `${department.isManagerRole ? "Manager role - " : ""}${department.users.length} user${department.users.length === 1 ? "" : "s"}`,
    }));
  }, [departmentGroups, selectedCategory]);

  const userDropdownOptions = useMemo(
    () =>
      userOptions.map((user) => {
        const label = formatUserName(selectedDepartment, user.name);
        const userId = String(user.id ?? user.user_id ?? user.email ?? user.name ?? "");
        return {
          key: userId,
          value: userId,
          label,
          description: user.email || user.role || "",
          raw: user,
        };
      }),
    [userOptions, selectedDepartment]
  );

  const selectedUserId = selectedUser
    ? String(selectedUser.id ?? selectedUser.user_id ?? selectedUser.email ?? selectedUser.name ?? "")
    : "";

  return (
    <div className={wrapperClassName}>
      <Dropdown
        label="Select Area"
        placeholder="Choose an area"
        options={categoryOptions}
        value={selectedCategory || ""}
        onChange={(raw) => {
          const nextCategory =
            (typeof raw === "string" && raw) || raw?.value || raw?.label || "";
          setSelectedCategory(nextCategory);
          setSelectedDepartment("");
          setSelectedUser(null);
        }}
        className="login-dropdown__control"
      />

      <Dropdown
        label="Select Department"
        placeholder="Choose a department"
        options={departmentOptions}
        value={selectedDepartment || ""}
        disabled={!selectedCategory}
        onChange={(raw) => {
          const nextDepartment =
            (typeof raw === "string" && raw) || raw?.value || raw?.label || "";
          const nextGroup = departmentGroups.find(
            (group) => group.key === normalizeValue(nextDepartment)
          );
          const nextUsers = (nextGroup?.users || []).map((user, index) =>
            toUserOption(user, index, nextDepartment)
          );
          setSelectedDepartment(nextDepartment);
          if (nextUsers.length === 1) {
            const onlyUser = nextUsers[0];
            setSelectedUser(onlyUser);
            onSingleUserDepartmentLogin?.({
              category: selectedCategory,
              department: nextDepartment,
              user: onlyUser,
            });
            return;
          }
          setSelectedUser(null);
        }}
        className="login-dropdown__control"
      />

      <Dropdown
        label="Select User"
        placeholder="Choose a user"
        options={userDropdownOptions}
        value={selectedUserId}
        disabled={!selectedDepartment}
        onChange={(raw, option) => {
          const candidateId = String(option?.value ?? option?.key ?? "");
          const nextUser =
            userOptions.find(
              (user) =>
                String(user.id ?? user.user_id ?? user.email ?? user.name ?? "") ===
                candidateId
            ) ||
            (raw && typeof raw === "object" ? raw : null);
          setSelectedUser(nextUser);
        }}
        className="login-dropdown__control"
      />
    </div>
  );
}

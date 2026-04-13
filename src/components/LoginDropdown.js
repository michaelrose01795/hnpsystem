// file location: /src/components/LoginDropdown.js
import React, { useEffect, useMemo } from "react";
import { Dropdown } from "@/components/dropdownAPI";

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
  className = "",
}) {
  // Format user display names for managers
  const formatUserName = (role, user) => {
    const managerRoles = [
      "Admin Manager",
      "Accounts Manager",
      "Service Manager",
      "Workshop Manager",
      "Parts Manager",
    ];

    if (managerRoles.includes(role)) {
      return `${user} (Manager)`; // append (Manager) for clarity
    }

    return user;
  };

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

    categorizedUsers.forEach((user, index) => {
      const departmentLabel =
        String(user?.department || "").trim() ||
        String(user?.role || "").trim() ||
        `Department ${index + 1}`;
      const key = normalizeValue(departmentLabel);
      const existing = groups.get(key);

      if (existing) {
        existing.users.push(user);
        return;
      }

      groups.set(key, {
        key,
        label: departmentLabel,
        users: [user],
      });
    });

    if (groups.size > 0) {
      return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    return (roleCategories?.[selectedCategory] || [])
      .filter((department) =>
        resolveDepartmentRoster(usersByRoleDetailed, department) ||
        resolveDepartmentRoster(usersByRole, department)
      )
      .map((department) => ({
        key: normalizeValue(department),
        label: department,
        users: resolveDepartmentRoster(usersByRoleDetailed, department) ||
          resolveDepartmentRoster(usersByRole, department) ||
          [],
      }));
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
      typeof user === "string"
        ? {
            id: `${selectedDepartment}-${index}`,
            name: user,
            role: selectedDepartment,
          }
        : {
            id: user.id ?? user.user_id ?? `${selectedDepartment}-${index}`,
            name:
              user.name ||
              user.displayName ||
              user.fullName ||
              `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              user.email ||
              `User ${index + 1}`,
            email: user.email || "",
            department: user.department || selectedDepartment,
            role: user.role || selectedDepartment,
          }
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
      description: `${department.users.length} user${department.users.length === 1 ? "" : "s"}`,
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
          setSelectedDepartment(nextDepartment);
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

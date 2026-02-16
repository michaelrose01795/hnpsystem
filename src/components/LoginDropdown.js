// file location: /src/components/LoginDropdown.js
import React, { useEffect, useMemo } from "react";
import { Dropdown } from "@/components/dropdownAPI";

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
    const matchKey = Object.keys(source).find(
      (key) => key.toLowerCase() === department.toLowerCase()
    );
    return matchKey ? source[matchKey] : null;
  };

  const getUsersForDepartment = (department) => {
    const detailed = resolveDepartmentRoster(usersByRoleDetailed, department);
    const fallback = resolveDepartmentRoster(usersByRole, department);
    const source =
      Array.isArray(detailed) && detailed.length > 0 ? detailed : fallback || [];

    return source.map((user, index) =>
      typeof user === "string"
        ? {
            id: `${department}-${index}`,
            name: user,
            role: department,
          }
        : {
            id: user.id ?? user.user_id ?? `${department}-${index}`,
            name:
              user.name ||
              user.displayName ||
              user.fullName ||
              `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              user.email ||
              `User ${index + 1}`,
            email: user.email || "",
            role: user.role || department,
          }
    );
  };

  const userOptions = useMemo(() => {
    if (!selectedDepartment) return [];
    return getUsersForDepartment(selectedDepartment);
  }, [selectedDepartment, usersByRole, usersByRoleDetailed]);

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
    return (roleCategories?.[selectedCategory] || [])
      .filter((department) =>
        resolveDepartmentRoster(usersByRoleDetailed, department) ||
        resolveDepartmentRoster(usersByRole, department)
      )
      .map((department) => ({
        key: department,
        value: department,
        label: department,
      }));
  }, [roleCategories, selectedCategory, usersByRole, usersByRoleDetailed]);

  const userDropdownOptions = useMemo(
    () =>
      userOptions.map((user) => {
        const label = formatUserName(selectedDepartment, user.name);
        const userId = String(user.id ?? user.user_id ?? user.email ?? user.name ?? "");
        return {
          key: userId,
          value: userId,
          label,
          description: user.email || "",
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
          const nextId =
            (typeof raw === "object" && String(raw.id ?? raw.user_id ?? raw.value ?? "")) ||
            option?.value ||
            option?.key ||
            "";
          const nextUser =
            (typeof raw === "object" && raw) ||
            userOptions.find(
              (user) =>
                String(user.id ?? user.user_id ?? user.email ?? user.name ?? "") ===
                String(nextId)
            ) ||
            null;
          setSelectedUser(nextUser);
        }}
        className="login-dropdown__control"
      />
    </div>
  );
}

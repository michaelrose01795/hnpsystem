// file location: /src/components/LoginDropdown.js
import React, { useEffect, useMemo } from "react";

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

  const getUsersForDepartment = (department) =>
    (usersByRole[department] || []).map((user, index) =>
      typeof user === "string"
        ? {
            id: `${department}-${index}`,
            name: user,
            role: department,
          }
        : {
            id: String(user.id ?? user.user_id ?? `${department}-${index}`),
            name:
              user.name ||
              user.displayName ||
              user.fullName ||
              `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              user.email ||
              `User ${index + 1}`,
            email: user.email || "",
            role: user.role || department,
          }
    );

  const userOptions = useMemo(() => {
    if (!selectedDepartment) return [];
    return getUsersForDepartment(selectedDepartment);
  }, [selectedDepartment, usersByRole]);

  useEffect(() => {
    if (!selectedDepartment || userOptions.length !== 1) return;
    const onlyUser = userOptions[0];
    if (!onlyUser) return;
    if (!selectedUser || selectedUser.id !== onlyUser.id) {
      setSelectedUser(onlyUser);
    }
  }, [selectedDepartment, userOptions, selectedUser, setSelectedUser]);

  const wrapperClassName = ["login-dropdown", className].filter(Boolean).join(" ").trim();

  return (
    <div className={wrapperClassName}>
      {/* Retail vs Sales selector */}
      <div className={`login-select-wrapper ${selectedCategory ? "has-value" : ""}`}>
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setSelectedDepartment("");
            setSelectedUser(null);
          }}
          className="login-select"
        >
          <option value=""></option>
          {Object.keys(roleCategories).map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <label className="login-select-label">Select Area</label>
      </div>

      {/* Department selector - filtered by category */}
      {selectedCategory && (
        <div className={`login-select-wrapper ${selectedDepartment ? "has-value" : ""}`}>
          <select
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value);
              setSelectedUser(null);
            }}
            className="login-select"
          >
            <option value=""></option>
            {(roleCategories[selectedCategory] || [])
              .filter((department) => usersByRole[department])
              .map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
          </select>
          <label className="login-select-label">Select Department</label>
        </div>
      )}

      {/* User selector */}
      {selectedDepartment && (
        <div className={`login-select-wrapper ${selectedUser ? "has-value" : ""}`}>
          <select
            value={selectedUser?.id || ""}
            onChange={(e) => {
              const nextUser = userOptions.find(
                (user) => String(user.id) === e.target.value
              );
              setSelectedUser(nextUser || null);
            }}
            className="login-select"
          >
            <option value=""></option>
            {userOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {formatUserName(selectedDepartment, user.name)}
              </option>
            ))}
          </select>
          <label className="login-select-label">Select User</label>
        </div>
      )}
    </div>
  );
}

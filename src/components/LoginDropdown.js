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

  const dropdownFieldClasses =
    "w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-inner shadow-slate-200/40 transition focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";

  return (
    <div className={`flex flex-col space-y-3 ${className}`}>
      {/* Retail vs Sales selector */}
      <select
        value={selectedCategory}
        onChange={(e) => {
          setSelectedCategory(e.target.value);
          setSelectedDepartment("");
          setSelectedUser(null);
        }}
        className={dropdownFieldClasses}
      >
        <option value="">Select Area</option>
        {Object.keys(roleCategories).map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      {/* Department selector - filtered by category */}
      {selectedCategory && (
        <select
          value={selectedDepartment}
          onChange={(e) => {
            setSelectedDepartment(e.target.value);
            setSelectedUser(null);
          }}
          className={dropdownFieldClasses}
        >
          <option value="">Select Department</option>
          {(roleCategories[selectedCategory] || [])
            .filter((department) => usersByRole[department])
            .map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
        </select>
      )}

      {/* User selector */}
      {selectedDepartment && (
        <select
          value={selectedUser?.id || ""}
          onChange={(e) => {
            const nextUser = userOptions.find(
              (user) => String(user.id) === e.target.value
            );
            setSelectedUser(nextUser || null);
          }}
          className={dropdownFieldClasses}
        >
          <option value="">Select User</option>
          {userOptions.map((user) => (
            <option key={user.id} value={user.id}>
              {formatUserName(selectedDepartment, user.name)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

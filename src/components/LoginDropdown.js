// file location: /src/components/LoginDropdown.js
import React from "react";

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

  return (
    <div className="flex flex-col space-y-2">
      {/* Retail vs Sales selector */}
      <select
        value={selectedCategory}
        onChange={(e) => {
          setSelectedCategory(e.target.value);
          setSelectedDepartment("");
          setSelectedUser("");
        }}
        className="p-2 border border-gray-300 rounded"
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
            setSelectedUser("");
          }}
          className="p-2 border border-gray-300 rounded"
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
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="p-2 border border-gray-300 rounded"
        >
          <option value="">Select User</option>
          {(usersByRole[selectedDepartment] || []).map((user) => (
            <option key={user} value={user}>
              {formatUserName(selectedDepartment, user)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

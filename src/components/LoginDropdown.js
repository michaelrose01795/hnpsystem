// file location: /src/components/LoginDropdown.js
import React from "react";

/**
 * LoginDropdown
 * Props:
 * - selectedRole: currently selected role
 * - setSelectedRole: setter for role
 * - selectedUser: currently selected user
 * - setSelectedUser: setter for user
 * - usersByRole: object containing users grouped by role
 */
export default function LoginDropdown({
  selectedRole,
  setSelectedRole,
  selectedUser,
  setSelectedUser,
  usersByRole,
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
      {/* Role selector */}
      <select
        value={selectedRole}
        onChange={(e) => {
          setSelectedRole(e.target.value);
          setSelectedUser(""); // reset user when role changes
        }}
        className="p-2 border border-gray-300 rounded"
      >
        <option value="">Select Role</option>
        {Object.keys(usersByRole).map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>

      {/* User selector */}
      {selectedRole && (
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="p-2 border border-gray-300 rounded"
        >
          <option value="">Select User</option>
          {usersByRole[selectedRole].map((user) => (
            <option key={user} value={user}>
              {formatUserName(selectedRole, user)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

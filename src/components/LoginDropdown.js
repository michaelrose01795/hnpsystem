// file location: /src/components/LoginDropdown.js
import React, { useEffect, useMemo, useRef, useState } from "react";

const mergeClassNames = (...classes) => classes.filter(Boolean).join(" ");

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
 * - styleApi: optional styling config to override default dropdown appearance
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
  styleApi,
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

  const includeDefaultClasses = styleApi?.inheritDefaultClasses !== false;
  const enableCustomFieldRendering = typeof styleApi?.renderField === "function";

  const [openFieldKey, setOpenFieldKey] = useState(null);
  const closeOnOutsideClick = styleApi?.closeOnOutsideClick !== false;
  const containerRef = useRef(null);

  useEffect(() => {
    if (!enableCustomFieldRendering || !closeOnOutsideClick) return undefined;
    const handlePointerDown = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) return;
      setOpenFieldKey(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [enableCustomFieldRendering, closeOnOutsideClick]);

  useEffect(() => {
    if (!enableCustomFieldRendering) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenFieldKey(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enableCustomFieldRendering]);

  useEffect(() => {
    setOpenFieldKey(null);
  }, [selectedCategory, selectedDepartment]);

  const handleCategoryChange = (nextCategory) => {
    setSelectedCategory(nextCategory);
    setSelectedDepartment("");
    setSelectedUser(null);
  };

  const handleDepartmentChange = (nextDepartment) => {
    setSelectedDepartment(nextDepartment);
    setSelectedUser(null);
  };

  const handleUserChangeById = (userId) => {
    if (!userId) {
      setSelectedUser(null);
      return;
    }
    const nextUser = userOptions.find((user) => String(user.id) === String(userId));
    setSelectedUser(nextUser || null);
  };

  const handleUserChangeByOption = (option) => {
    if (!option || !option.payload) {
      setSelectedUser(null);
      return;
    }
    setSelectedUser(option.payload);
  };

  const categoryOptions = Object.keys(roleCategories).map((category) => ({
    value: category,
    label: category,
  }));

  const departmentOptions =
    selectedCategory && roleCategories[selectedCategory]
      ? roleCategories[selectedCategory]
          .filter((department) => usersByRole[department])
          .map((department) => ({
            value: department,
            label: department,
          }))
      : [];

  const userOptionObjects = userOptions.map((user) => ({
    value: String(user.id),
    label: formatUserName(selectedDepartment, user.name),
    payload: user,
  }));

  const fieldConfigs = [
    {
      key: "category",
      label: "Select Area",
      value: selectedCategory,
      displayValue: selectedCategory,
      options: categoryOptions,
      placeholderOption: { value: "", label: "Select Area", isPlaceholder: true },
      onChangeValue: handleCategoryChange,
      hasValue: Boolean(selectedCategory),
    },
    selectedCategory
      ? {
          key: "department",
          label: "Select Department",
          value: selectedDepartment,
          displayValue: selectedDepartment,
          options: departmentOptions,
          placeholderOption: { value: "", label: "Select Department", isPlaceholder: true },
          onChangeValue: handleDepartmentChange,
          hasValue: Boolean(selectedDepartment),
        }
      : null,
    selectedDepartment
      ? {
          key: "user",
          label: "Select User",
          value: selectedUser?.id ? String(selectedUser.id) : "",
          displayValue: selectedUser
            ? formatUserName(
                selectedDepartment,
                selectedUser.name ||
                  selectedUser.displayName ||
                  selectedUser.fullName ||
                  selectedUser.email ||
                  ""
              )
            : "",
          options: userOptionObjects,
          placeholderOption: { value: "", label: "Select User", isPlaceholder: true },
          onChangeValue: handleUserChangeById,
          onChangeOption: handleUserChangeByOption,
          hasValue: Boolean(selectedUser),
        }
      : null,
  ].filter(Boolean);

  const containerClassName = mergeClassNames(
    includeDefaultClasses ? "login-dropdown" : "",
    styleApi?.containerClassName,
    className
  );

  const buildFieldProps = (fieldKey, state) => {
    const overrides = styleApi?.getFieldProps?.(fieldKey, state) || {};
    return {
      wrapperClassName: mergeClassNames(
        includeDefaultClasses ? "login-select-wrapper" : "",
        styleApi?.fieldClassName,
        overrides.wrapperClassName,
        state.hasValue ? "has-value" : ""
      ),
      wrapperStyle: {
        ...(styleApi?.fieldStyle || {}),
        ...(overrides.wrapperStyle || {}),
      },
      selectClassName: mergeClassNames(
        includeDefaultClasses ? "login-select" : "",
        styleApi?.selectClassName,
        overrides.selectClassName
      ),
      selectStyle: {
        ...(styleApi?.selectStyle || {}),
        ...(overrides.selectStyle || {}),
      },
      labelClassName: mergeClassNames(
        includeDefaultClasses ? "login-select-label" : "",
        styleApi?.labelClassName,
        overrides.labelClassName
      ),
      labelStyle: {
        ...(styleApi?.labelStyle || {}),
        ...(overrides.labelStyle || {}),
      },
      optionClassName: mergeClassNames(
        styleApi?.optionClassName,
        overrides.optionClassName
      ),
      optionStyle: {
        ...(styleApi?.optionStyle || {}),
        ...(overrides.optionStyle || {}),
      },
    };
  };

  const renderDefaultField = (config, fieldProps) => (
    <div
      key={config.key}
      className={fieldProps.wrapperClassName}
      style={fieldProps.wrapperStyle}
    >
      <select
        value={config.value}
        onChange={(e) => config.onChangeValue?.(e.target.value)}
        className={fieldProps.selectClassName}
        style={fieldProps.selectStyle}
      >
        <option
          value=""
          className={fieldProps.optionClassName}
          style={fieldProps.optionStyle}
        ></option>
        {config.options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className={fieldProps.optionClassName}
            style={fieldProps.optionStyle}
          >
            {option.label}
          </option>
        ))}
      </select>
      <label className={fieldProps.labelClassName} style={fieldProps.labelStyle}>
        {config.label}
      </label>
    </div>
  );

  const handleToggleField = (fieldKey) => {
    setOpenFieldKey((current) => (current === fieldKey ? null : fieldKey));
  };

  const renderCustomField = (config, fieldProps) => {
    if (!enableCustomFieldRendering) return null;
    const context = {
      ...config,
      fieldKey: config.key,
      fieldProps,
      isOpen: openFieldKey === config.key,
      toggleOpen: () => handleToggleField(config.key),
      closeDropdown: () => setOpenFieldKey(null),
      options: config.options,
    };
    return (
      <React.Fragment key={config.key}>
        {styleApi.renderField(context)}
      </React.Fragment>
    );
  };

  return (
    <div
      className={containerClassName}
      style={styleApi?.containerStyle}
      ref={enableCustomFieldRendering ? containerRef : null}
    >
      {fieldConfigs.map((config) => {
        const fieldProps = buildFieldProps(config.key, {
          hasValue: config.hasValue,
        });
        if (enableCustomFieldRendering) {
          return renderCustomField(config, fieldProps);
        }
        return renderDefaultField(config, fieldProps);
      })}
    </div>
  );
}

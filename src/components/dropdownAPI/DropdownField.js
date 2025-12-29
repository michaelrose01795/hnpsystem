// file location: /src/components/dropdownAPI/DropdownField.js
import React, { useMemo } from "react";
import Dropdown from "./Dropdown";

const getNodeText = (node) => {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (React.isValidElement(node)) return getNodeText(node.props?.children);
  return "";
};

const normalizeOptionInput = (option, index) => {
  if (typeof option === "string" || typeof option === "number") {
    return {
      key: `option-${index}`,
      value: option,
      label: String(option),
      description: "",
      disabled: false,
      rawValue: option,
    };
  }

  if (option && typeof option === "object") {
    const rawValue =
      option.rawValue ??
      option.value ??
      option.id ??
      option.key ??
      option.name ??
      option.label ??
      "";
    const label =
      option.label ??
      option.name ??
      option.title ??
      option.displayName ??
      (typeof rawValue === "string" && rawValue.length > 0
        ? rawValue
        : `Option ${index + 1}`);

    return {
      key: option.key ?? option.id ?? `option-${index}`,
      value: rawValue,
      label,
      description: option.description ?? option.subtitle ?? "",
      disabled: Boolean(option.disabled),
      rawValue,
      placeholder: Boolean(option.placeholder),
    };
  }

  return {
    key: `option-${index}`,
    value: option,
    label: `Option ${index + 1}`,
    description: "",
    disabled: false,
    rawValue: option,
  };
};

/**
 * DropdownField
 * Provides a select-like API on top of the Dropdown component so existing code
 * can migrate away from native <select> without drastic rewrites.
 *
 * Accepts either an `options` array or traditional `<option>` children.
 */
export default function DropdownField({
  options,
  children,
  value,
  defaultValue,
  placeholder,
  label,
  disabled = false,
  helperText = "",
  className = "",
  size = "md",
  name,
  id,
  required = false,
  onChange,
  onValueChange,
  ...rest
}) {
  const childMeta = useMemo(() => {
    if (!children) return { options: [], placeholder: undefined };

    const derived = [];
    let placeholderText;

    React.Children.forEach(children, (child, index) => {
      if (!React.isValidElement(child) || child.type !== "option") return;
      const labelText = child.props?.label ?? getNodeText(child.props?.children);
      const valueProp =
        child.props?.value !== undefined ? child.props.value : labelText;
      const option = {
        key: child.key ?? child.props?.value ?? `child-option-${index}`,
        value: valueProp,
        label: labelText || `Option ${index + 1}`,
        description: child.props?.["data-description"] ?? "",
        disabled: Boolean(child.props?.disabled),
        rawValue: valueProp,
      };

      if (child.props?.hidden) {
        if (!placeholderText) {
          placeholderText = labelText || placeholder || "";
        }
        return;
      }

      derived.push(option);
    });

    return { options: derived, placeholder: placeholderText };
  }, [children, placeholder]);

  const optionMeta = useMemo(() => {
    if (!options || options.length === 0) {
      return { options: [], placeholder: undefined };
    }

    const normalized = options.map((option, index) => normalizeOptionInput(option, index));
    const placeholderOption = normalized.find((option) => option.placeholder);
    return {
      options: normalized.filter((option) => !option.placeholder),
      placeholder: placeholderOption?.label,
    };
  }, [options]);

  const sourceOptions = optionMeta.options.length ? optionMeta.options : childMeta.options;
  const resolvedPlaceholder =
    placeholder ?? optionMeta.placeholder ?? childMeta.placeholder ?? "Select an option";

  const dropdownOptions = useMemo(
    () =>
      sourceOptions.map((option, index) => {
        const rawValue =
          option.rawValue !== undefined ? option.rawValue : option.value;
        const valueString =
          rawValue === null || rawValue === undefined ? "" : String(rawValue);

        return {
          key: option.key ?? `dropdown-field-option-${index}`,
          label: option.label ?? `Option ${index + 1}`,
          value: valueString,
          description: option.description ?? "",
          disabled: Boolean(option.disabled),
          raw: {
            rawValue,
            option,
          },
        };
      }),
    [sourceOptions]
  );

  const controlledValue =
    value !== undefined
      ? value
      : defaultValue !== undefined
      ? defaultValue
      : "";
  const dropdownValue =
    controlledValue === null || controlledValue === undefined
      ? ""
      : String(controlledValue);

  const emitChange = (finalValue, meta) => {
    onValueChange?.(finalValue, meta?.option ?? meta);
    if (typeof onChange === "function") {
      const syntheticEvent = {
        target: {
          value: finalValue,
          name,
        },
        currentTarget: {
          value: finalValue,
          name,
        },
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onChange(syntheticEvent, meta?.option ?? meta);
    }
  };

  const handleDropdownChange = (raw, option) => {
    const resolved =
      option?.raw?.rawValue !== undefined
        ? option.raw.rawValue
        : option?.value ?? raw ?? "";
    emitChange(resolved, option?.raw);
  };

  return (
    <Dropdown
      id={id}
      label={label}
      placeholder={resolvedPlaceholder}
      options={dropdownOptions}
      value={dropdownValue}
      onChange={handleDropdownChange}
      disabled={disabled}
      helperText={helperText}
      className={className}
      size={size}
      aria-required={required || undefined}
      {...rest}
    />
  );
}

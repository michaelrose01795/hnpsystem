// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: /src/pages/login.js
import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import LoginDropdown from "@/components/LoginDropdown";
import CustomerViewPreview from "@/components/CustomerViewPreview";
import { supabase } from "@/lib/supabaseClient"; // Database connection
import { roleCategories } from "@/config/users"; // Dev users config

const FIELD_MAX_WIDTH = 380;
const mergeLoginDropdownClasses = (...classes) => classes.filter(Boolean).join(" ");
const loginDropdownStyleTestApi = {
  inheritDefaultClasses: false,
  containerClassName: "login-dropdown login-dropdown--test",
  fieldClassName: "login-dropdown--test-field",
  selectClassName: "login-dropdown--test-select",
  labelClassName: "login-dropdown--test-label",
  optionClassName: "login-dropdown--test-option",
  closeOnOutsideClick: true,
  renderField: ({
    fieldKey,
    label,
    value,
    displayValue,
    placeholderOption,
    options,
    fieldProps,
    isOpen,
    toggleOpen,
    closeDropdown,
    onChangeValue,
    onChangeOption,
  }) => {
    const optionList = [
      ...(placeholderOption ? [placeholderOption] : []),
      ...options,
    ];

    const handleSelect = (option) => {
      if (!option || option.isPlaceholder) {
        onChangeOption?.(null);
        onChangeValue?.("");
      } else {
        onChangeOption?.(option);
        onChangeValue?.(option.value || "");
      }
      closeDropdown?.();
    };

    return (
      <div
        key={fieldKey}
        className={mergeLoginDropdownClasses(fieldProps.wrapperClassName, isOpen ? "open" : "")}
        style={fieldProps.wrapperStyle}
      >
        <button
          type="button"
          className={mergeLoginDropdownClasses(
            fieldProps.selectClassName,
            displayValue ? "has-value" : "",
            isOpen ? "is-open" : ""
          )}
          style={fieldProps.selectStyle}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label}
          onClick={() => toggleOpen?.()}
        >
          <span className="login-dropdown--test-value">
            {displayValue || placeholderOption?.label || label}
          </span>
        </button>
        <label
          className={mergeLoginDropdownClasses(
            fieldProps.labelClassName,
            displayValue ? "has-value" : "",
            isOpen ? "is-open" : ""
          )}
          style={fieldProps.labelStyle}
        >
          {label}
        </label>
        <div
          className={mergeLoginDropdownClasses(
            "login-dropdown--test-options",
            isOpen ? "open" : ""
          )}
          role="listbox"
        >
          {optionList.map((option) => (
            <button
              type="button"
              key={`${fieldKey}-${option.value || "placeholder"}`}
              className={mergeLoginDropdownClasses(
                "login-dropdown--test-option",
                value && option.value === value ? "is-active" : "",
                option.isPlaceholder ? "is-placeholder" : ""
              )}
              role="option"
              aria-selected={Boolean(value) && option.value === value}
              onClick={() => handleSelect(option)}
            >
              <span>{option.label}</span>
            </button>
          ))}
          {options.length === 0 && (
            <div className="login-dropdown--test-empty">No options available</div>
          )}
        </div>
      </div>
    );
  },
};

const LoginCard = ({ title, subtitle, children, contentMaxWidth = FIELD_MAX_WIDTH }) => (
  <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
    <div
      style={{
        borderRadius: "32px",
        border: "1px solid rgba(15, 23, 42, 0.08)",
        background: "var(--surface)",
        boxShadow: "0 30px 70px rgba(15, 23, 42, 0.15)",
        padding: "2.25rem",
        backdropFilter: "blur(18px)",
        width: "100%",
        maxWidth: contentMaxWidth + 72,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            color: "var(--text-primary)",
            fontSize: "1.5rem",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              color: "var(--text-secondary, #64748b)",
              fontSize: "0.95rem",
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="login-card-inner"
        style={{ maxWidth: contentMaxWidth, margin: "24px auto 0" }}
      >
        {children}
      </div>
    </div>
  </div>
);

export default function LoginPage() {
  const CUSTOMER_PORTAL_URL =
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL || "https://www.hpautomotive.co.uk";
  // Safe destructuring from context
  const userContext = useUser();
  const devLogin = userContext?.devLogin;
  const user = userContext?.user;
  const setUser = userContext?.setUser;
  const { usersByRole, isLoading: rosterLoading, refreshRoster } = useRoster();

  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingDevUsers, setLoadingDevUsers] = useState(true);

  // Developer login handler
  const handleDevLogin = async () => {
    if (!devLogin) {
      alert("Developer login is not available. User context is missing.");
      return;
    }
    if (!selectedCategory || !selectedDepartment || !selectedUser) {
      alert("Please select an area, department, and user.");
      return;
    }
    const result = await devLogin(selectedUser, selectedDepartment);
    if (result?.success === false) {
      alert("Dev login failed. Please try again.");
    }
  };

  // Supabase email/password login
  const handleDbLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    try {
      const response = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      const data = response?.data;
      const error = response?.error;

      if (error || !data) {
        setErrorMessage("User not found.");
        return;
      }

      if (data.password !== password) {
        setErrorMessage("Incorrect password.");
        return;
      }

      setUser?.({
        id: data.id,
        name: `${data.first_name} ${data.last_name}`,
        email: data.email,
        role: data.role,
      });
    } catch (err) {
      console.error("❌ Login error:", err);
      setErrorMessage("Login failed, please try again.");
    }
  };

  // Redirect once user is logged in
  useEffect(() => {
    if (user) {
      router.push("/newsfeed");
    }
  }, [user, router]);

  useEffect(() => {
    // ⚠️ Mock data found — replacing with Supabase query
    // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
    if (!rosterLoading) {
      setLoadingDevUsers(false);
    }
  }, [rosterLoading]);

  return (
    <Layout>
      <div className="login-page-wrapper">
        <div className="login-stack">
          <div className="login-brand">
            <img
              src="/images/logo/LightLogo.png"
              alt="HP Automotive"
              className="login-logo login-logo-light"
            />
            <img
              src="/images/logo/DarkLogo.png"
              alt="HP Automotive"
              className="login-logo login-logo-dark"
            />
          </div>

          <div className="login-card-stack">
            <LoginCard title="Login" subtitle="Secure access with your email and password">
              <form onSubmit={handleDbLogin} className="login-form">
                <div className="login-field">
                  <label htmlFor="email" className="login-label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@hpautomotive.co.uk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="login-input"
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="password" className="login-label">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                    required
                  />
                </div>

                {errorMessage && (
                  <p className="login-error" role="alert">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  className="login-button"
                  style={{ background: "var(--primary)" }}
                >
                  Login
                </button>
              </form>
            </LoginCard>

            <LoginCard
              title="Developer Login"
              subtitle="Use predefined personas to explore the platform safely"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <LoginDropdown
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  selectedDepartment={selectedDepartment}
                  setSelectedDepartment={setSelectedDepartment}
                  selectedUser={selectedUser}
                  setSelectedUser={setSelectedUser}
                  usersByRole={usersByRole}
                  roleCategories={roleCategories}
                  styleApi={loginDropdownStyleTestApi}
                />

                {(loadingDevUsers || rosterLoading) && (
                  <p className="login-loading-text">Loading database users for dev login...</p>
                )}


                <button
                  onClick={handleDevLogin}
                  className="login-button"
                  style={{ background: "var(--primary)" }}
                >
                  Dev Login
                </button>
              </div>
            </LoginCard>
          </div>
        </div>
      </div>
    </Layout>
  );
}

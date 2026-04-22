// file location: src/components/page-ui/login-ui.js

export default function LoginPageUi(props) {
  const {
    BrandLogo,
    Button,
    LoginCard,
    LoginDropdown,
    PageSkeleton,
    allUsers,
    allowDevUserSelection,
    closeResetModal,
    email,
    errorMessage,
    handleDbLogin,
    handleDevLogin,
    handlePasswordReset,
    handlePasswordRevertDecision,
    isResettingPassword,
    isRevertingPassword,
    loadingDevUsers,
    loginRoleCategories,
    openResetModal,
    password,
    resetEmail,
    resetPassword,
    resetStatus,
    resetStatusType,
    revertResultMessage,
    revertResultType,
    rosterLoading,
    selectedCategory,
    selectedDepartment,
    selectedUser,
    setEmail,
    setPassword,
    setResetEmail,
    setResetPassword,
    setSelectedCategory,
    setSelectedDepartment,
    setSelectedUser,
    setShowRevertResult,
    showResetModal,
    showRevertPrompt,
    showRevertResult,
    usersByRole,
    usersByRoleDetailed,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <PageSkeleton />; // render extracted page section.

    case "section2":
      return <>
      <div className="login-page-wrapper">
        <div className="login-center-stage">
          <div className="login-brand">
            <BrandLogo alt="HP Automotive" className="login-logo" />
          </div>
          <LoginCard className="login-card--auth" title="Login">
            <form onSubmit={handleDbLogin} className="login-form">
              <div className="login-field">
                <label htmlFor="email" className="login-label">
                  Email
                </label>
                <input id="email" name="email" type="email" autoComplete="username" placeholder="email@humphriesandpark.co.uk" value={email} onChange={e => setEmail(e.target.value)} className="app-input" required />
              </div>

              <div className="login-field">
                <label htmlFor="password" className="login-label">
                  Password
                </label>
                <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} className="app-input" required />
              </div>

              {errorMessage && <p className="login-error" role="alert">
                  {errorMessage}
                </p>}

              <Button type="submit" variant="primary" style={{
            width: "100%"
          }}>
                Login
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={openResetModal} style={{
            alignSelf: "center",
            marginTop: "8px"
          }}>
                Reset password
              </Button>
            </form>
          </LoginCard>
        </div>
        {allowDevUserSelection && <div className="login-dev-panel">
            <LoginCard className="login-card--dev" title="Developer Login">
              <div className="login-dev-content">
                <LoginDropdown selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedDepartment={selectedDepartment} setSelectedDepartment={setSelectedDepartment} selectedUser={selectedUser} setSelectedUser={setSelectedUser} allUsers={allUsers} usersByRole={usersByRole} usersByRoleDetailed={usersByRoleDetailed} roleCategories={loginRoleCategories} />

                <p className={["login-loading-text", !(loadingDevUsers || rosterLoading) ? "is-hidden" : ""].filter(Boolean).join(" ")}>
                  Loading database users for dev login...
                </p>


                <Button type="button" onClick={handleDevLogin} variant="primary" style={{
            width: "100%"
          }}>
                  Dev Login
                </Button>
              </div>
            </LoginCard>
          </div>}
      </div>
      {showResetModal && <div style={{
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1400,
    padding: "16px"
  }}>
          <div style={{
      width: "100%",
      maxWidth: "420px",
      background: "var(--surface)",
      borderRadius: "var(--radius-md)",
      border: "none",
      padding: "18px",
      boxShadow: "var(--shadow-xl)"
    }}>
            <h3 style={{
        margin: 0,
        fontSize: "1.1rem",
        color: "var(--text-primary)"
      }}>
              Reset Password
            </h3>
            <p style={{
        margin: "8px 0 14px",
        fontSize: "0.85rem",
        color: "var(--text-secondary)"
      }}>
              Enter your email and your new password.
            </p>
            <form onSubmit={handlePasswordReset} style={{
        display: "grid",
        gap: "10px"
      }}>
              <input type="email" value={resetEmail} onChange={event => setResetEmail(event.target.value)} placeholder="Email" required className="app-input" />
              <input type="password" value={resetPassword} onChange={event => setResetPassword(event.target.value)} placeholder="New password" required className="app-input" />
              {resetStatus && <p style={{
          margin: 0,
          fontSize: "0.8rem",
          color: resetStatusType === "error" ? "var(--danger)" : resetStatusType === "success" ? "var(--success)" : "var(--text-secondary)"
        }}>
                  {resetStatus}
                </p>}
              <div style={{
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
          marginTop: "4px"
        }}>
                <Button type="button" variant="secondary" size="sm" onClick={closeResetModal}>
                  Close
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isResettingPassword}>
                  {isResettingPassword ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </form>
          </div>
        </div>}
      {showRevertPrompt && <div style={{
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1450,
    padding: "16px"
  }}>
          <div style={{
      width: "100%",
      maxWidth: "460px",
      background: "var(--surface)",
      borderRadius: "var(--radius-md)",
      border: "none",
      padding: "18px",
      boxShadow: "var(--shadow-xl)"
    }}>
            <h3 style={{
        margin: 0,
        fontSize: "1.05rem",
        color: "var(--text-primary)"
      }}>
              Are you sure this wasn't you?
            </h3>
            <p style={{
        margin: "8px 0 14px",
        fontSize: "0.85rem",
        color: "var(--text-secondary)"
      }}>
              If you click "Yes, it wasn't me", your previous password will be restored.
            </p>
            <div style={{
        display: "flex",
        gap: "8px",
        justifyContent: "flex-end"
      }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => handlePasswordRevertDecision(false)} disabled={isRevertingPassword}>
                No, this was me
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={() => handlePasswordRevertDecision(true)} disabled={isRevertingPassword}>
                {isRevertingPassword ? "Reverting..." : "Yes, it wasn't me"}
              </Button>
            </div>
          </div>
        </div>}
      {showRevertResult && <div style={{
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1460,
    padding: "16px"
  }}>
          <div style={{
      width: "100%",
      maxWidth: "520px",
      background: "var(--surface)",
      borderRadius: "var(--radius-md)",
      border: "none",
      borderTop: "4px solid #b91c1c",
      padding: "22px",
      boxShadow: "var(--shadow-xl)",
      textAlign: "center"
    }}>
            <h3 style={{
        margin: 0,
        fontSize: "1.15rem",
        color: "var(--text-primary)"
      }}>
              {revertResultType === "success" ? "Password Reverted" : "Password Revert Failed"}
            </h3>
            <p style={{
        margin: "10px 0 18px",
        fontSize: "0.9rem",
        color: "var(--text-secondary)"
      }}>
              {revertResultMessage}
            </p>
            <Button type="button" variant="primary" size="sm" onClick={() => setShowRevertResult(false)}>
              Close
            </Button>
          </div>
        </div>}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}

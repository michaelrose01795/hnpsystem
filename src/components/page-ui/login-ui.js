// file location: src/components/page-ui/login-ui.js
import LayerSurface from "@/components/ui/LayerSurface";

export default function LoginPageUi(props) {
  const {
    BrandLogo,
    Button,
    LoginCard,
    LoginDropdown,
    allUsers,
    allowDevUserSelection,
    closeResetModal,
    email,
    errorMessage,
    handleDbLogin,
    handleDevLogin,
    handleDevPlatformSelect,
    handleLoginIdentityInput,
    handlePasswordReset,
    handlePresentationSelect,
    isRedirecting,
    isResettingPassword,
    loadingDevUsers,
    loginFullName,
    loginRoleCategories,
    loginUserId,
    openResetModal,
    password,
    resetEmail,
    resetStatus,
    resetStatusType,
    rosterLoading,
    selectedCategory,
    selectedDepartment,
    selectedUser,
    setPassword,
    setResetEmail,
    setSelectedCategory,
    setSelectedDepartment,
    setSelectedUser,
    showResetModal,
    usersByRole,
    usersByRoleDetailed,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section2":
      return <>
      <div
        className="login-page-wrapper"
        style={{
          flexDirection: "column",
          overflowY: "auto"
        }}>
        <div
          style={{
            width: "min(calc(520px + var(--login-dev-panel-width) + var(--login-dev-panel-gap)), 100%)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
            alignItems: "center",
            justifyItems: "center",
            gap: "var(--login-dev-panel-gap)"
          }}>
          <div className="login-center-stage">
            <div className="login-brand">
              <BrandLogo
                alt="HP Automotive"
                className="login-logo"
                priority
                sizes="(max-width: 390px) 200px, (max-width: 640px) 230px, (max-width: 820px) 380px, 452px"
                recolor={false}
              />
            </div>
            <LoginCard className="login-card--auth" title="Login">
              <form onSubmit={handleDbLogin} className="login-form" aria-busy={isRedirecting}>
                <div className="login-identity-grid" aria-label="Login user lookup">
                  <label className="login-field login-identity-field" htmlFor="loginFullName">
                    <span className="login-label">Full name</span>
                    <input id="loginFullName" name="fullName" type="text" autoComplete="name" placeholder="Enter full name" value={loginFullName} onChange={e => handleLoginIdentityInput("name", e.target.value)} className="app-input" disabled={isRedirecting} />
                  </label>

                  <label className="login-field login-identity-field" htmlFor="loginUserId">
                    <span className="login-label">User id</span>
                    <input id="loginUserId" name="userId" type="text" inputMode="numeric" placeholder="Enter user id" value={loginUserId} onChange={e => handleLoginIdentityInput("id", e.target.value)} className="app-input" disabled={isRedirecting} />
                  </label>

                  <label className="login-field login-identity-field login-identity-field--email" htmlFor="email">
                    <span className="login-label">Email</span>
                    <input id="email" name="email" type="email" autoComplete="username" placeholder="Enter email" value={email} onChange={e => handleLoginIdentityInput("email", e.target.value)} className="app-input" required disabled={isRedirecting} />
                  </label>
                </div>

                <div className="login-field">
                  <label htmlFor="password" className="login-label">
                    Password
                  </label>
                  <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} className="app-input" required disabled={isRedirecting} />
                </div>

                {errorMessage && <p className="login-error" role="alert">
                    {errorMessage}
                  </p>}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--layout-card-gap)" }}> {/* Local 50/50 login actions; no shared layout primitive matches this row. */}
                  <Button type="submit" variant="primary" style={{ width: "100%" }} disabled={isRedirecting}>
                    {isRedirecting ? "Signing in..." : "Login"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={openResetModal} style={{ width: "100%" }} disabled={isRedirecting}>
                    Reset password
                  </Button>
                </div>
              </form>
            </LoginCard>
          </div>
          {allowDevUserSelection && <div className="login-dev-panel">
              <LoginCard className="login-card--dev" title="Developer Login">
                <div className="login-dev-content">
                  <LoginDropdown selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} selectedDepartment={selectedDepartment} setSelectedDepartment={setSelectedDepartment} selectedUser={selectedUser} setSelectedUser={setSelectedUser} allUsers={allUsers} usersByRole={usersByRole} usersByRoleDetailed={usersByRoleDetailed} roleCategories={loginRoleCategories} onSingleUserDepartmentLogin={handleDevLogin} onPresentationSelect={handlePresentationSelect} onDevPlatformSelect={handleDevPlatformSelect} />

                  <p className={["login-loading-text", !(loadingDevUsers || rosterLoading) ? "is-hidden" : ""].filter(Boolean).join(" ")}>
                    Loading database users for dev login...
                  </p>


                  <Button type="button" onClick={handleDevLogin} variant="primary" disabled={isRedirecting} style={{
              width: "100%"
            }}>
                    {isRedirecting ? "Signing in..." : "Dev Login"}
                  </Button>
                </div>
              </LoginCard>
            </div>}
        </div>
        {allowDevUserSelection && <LayerSurface
          as="section"
          aria-label="Manager preview guide"
          radius="var(--radius-xl)"
          padding="var(--section-card-padding)"
          style={{
            width: "min(1280px, calc(100% - 32px))",
            alignSelf: "center",
            boxShadow: "var(--shadow-xl)"
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: "var(--layout-card-gap)"
            }}>
              <div>
                <h2 style={{
                  color: "var(--text-1)",
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  margin: 0
                }}>
                  Thank you for taking the time to look at the system I have been creating
                </h2>
                <p style={{
                  color: "var(--text-1)",
                  margin: "8px 0 0"
                }}>
                  Please have a play with the system and explore how it supports each department.
                </p>
                <p style={{
                  color: "var(--text-1)",
                  margin: "8px 0 0"
                }}>
                  <strong>Note:</strong> All data and information in this demonstration is completely made up and nothing is real. You can use the system normally and explore it safely.
                </p>
              </div>
              <div>
                <h3 style={{
                  color: "var(--text-1)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  margin: 0
                }}>
                  What to do
                </h3>
                <p style={{
                  color: "var(--text-1)",
                  margin: "8px 0 0"
                }}>
                  In Developer Login, open the first dropdown. Select <strong>Retail</strong>, then choose Workshop Manager, Parts Manager, Techs, Valet Service, or Service. You can also select <strong>Sales</strong>, then choose Admin Manager.
                </p>
                <p style={{
                  color: "var(--text-1)",
                  margin: "8px 0 0"
                }}>
                  Once you are logged in, click your role at the bottom of the sidebar, below <strong>Account</strong>, to open your profile page.
                </p>
              </div>
            </div>
          </LayerSurface>}
      </div>
      {showResetModal && <div style={{
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "var(--z-modal)",
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
        color: "var(--text-1)"
      }}>
              Reset Password
            </h3>
            <p style={{
        margin: "8px 0 14px",
        fontSize: "0.85rem",
        color: "var(--text-1)"
      }}>
              Enter your email. If we have an account for you, we&apos;ll send a link to choose a new password.
            </p>
            <form onSubmit={handlePasswordReset} style={{
        display: "grid",
        gap: "10px"
      }}>
              <input type="email" value={resetEmail} onChange={event => setResetEmail(event.target.value)} placeholder="Email" required className="app-input" />
              {resetStatus && <p style={{
          margin: 0,
          fontSize: "0.8rem",
          color: resetStatusType === "error" ? "var(--danger)" : resetStatusType === "success" ? "var(--success)" : "var(--text-1)"
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
                  {isResettingPassword ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
            </form>
          </div>
        </div>}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}

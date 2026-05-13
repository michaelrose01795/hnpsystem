// file location: src/pages/website/login.js
// Public-facing customer portal entry. Single email-first flow:
//   step 1 → enter email and click Continue.
//   step 2 → the API classifies the email:
//     • has_account            → password field (sign in)
//     • customer_no_password   → set a password to claim existing record
//     • new                    → full signup form
// Dev-only impersonation dropdown sits below when canShowDevLogin()
// returns true, mirroring the staff /login page.

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTheme } from "@/styles/themeProvider";
import { siteContent } from "@/singlescroll/data/siteContent";
import { canShowDevLogin } from "@/lib/dev-tools/config";
import useWebsiteScope from "@/singlescroll/hooks/useWebsiteScope";
import WebsiteSelect from "@/singlescroll/components/WebsiteSelect";
import styles from "@/singlescroll/styles/singlescroll.module.css";

const STEP_EMAIL = "email";
const STEP_SIGNIN = "signin";
const STEP_SET_PASSWORD = "set_password";
const STEP_SIGNUP = "signup";

export default function CustomerLoginPage() {
  const router = useRouter();
  const { setTemporaryOverride } = useTheme();
  useWebsiteScope();
  const [step, setStep] = useState(STEP_EMAIL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupExtras, setSignupExtras] = useState({
    firstname: "",
    lastname: "",
    mobile: "",
  });
  const [matchedName, setMatchedName] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const devEnabled = useMemo(() => canShowDevLogin(), []);
  const [devCustomers, setDevCustomers] = useState([]);
  const [devCustomerId, setDevCustomerId] = useState("");
  const [devLoading, setDevLoading] = useState(false);
  const pageTitle = `Sign in - ${siteContent.brand.name}`;

  useEffect(() => {
    setTemporaryOverride({ mode: "dark", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

  // Skip the page entirely if the user is already signed in.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/website/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.authenticated && data?.customer) {
          router.replace("/website/profile");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Pre-fetch the customers list for the dev dropdown.
  useEffect(() => {
    if (!devEnabled) return undefined;
    let cancelled = false;
    setDevLoading(true);
    fetch("/api/website/auth/dev-list", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.success) return;
        setDevCustomers(data.customers || []);
      })
      .finally(() => {
        if (!cancelled) setDevLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [devEnabled]);

  const resetToEmailStep = () => {
    setStep(STEP_EMAIL);
    setPassword("");
    setMatchedName(null);
    setSignupExtras({ firstname: "", lastname: "", mobile: "" });
    setError("");
  };

  const handleEmailContinue = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/website/auth/email-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not check that email.");
      }
      if (data.state === "has_account") {
        setStep(STEP_SIGNIN);
      } else if (data.state === "customer_no_password") {
        setMatchedName(data.customer || null);
        setStep(STEP_SET_PASSWORD);
      } else {
        setStep(STEP_SIGNUP);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/website/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not sign in.");
      }
      router.replace("/website/profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/website/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not set your password.");
      }
      router.replace("/website/profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/website/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, ...signupExtras }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not create account.");
      }
      router.replace("/website/profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!devCustomerId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/website/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ customerId: devCustomerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Dev login failed.");
      }
      router.replace("/website/profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <div className={styles.authShell}>
        <main className={styles.authMain}>
          <div className={styles.authCard}>
            <Link href="/website" className={styles.authBackLink}>
              Back to website
            </Link>

            <div className={styles.authBrand}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={siteContent.brand.logoUrl}
                alt={siteContent.brand.name}
              />
              <span className={styles.authBrandText}>
                <span className={styles.authBrandName}>Customer portal</span>
              </span>
            </div>

            {step === STEP_EMAIL ? (
              <>
                <h1 className={styles.authTitle}>Sign in or create account</h1>
                <p className={styles.authSubtitle}>
                  Enter your email to continue. We'll find your existing
                  account or set you up with a new one.
                </p>
                {error ? <p className={styles.authError}>{error}</p> : null}
                <form className={styles.authForm} onSubmit={handleEmailContinue}>
                  <div className={styles.authField}>
                    <label className={styles.authLabel} htmlFor="email">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      autoFocus
                      className={styles.authInput}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className={`app-btn ${styles.authSubmit}`}
                    disabled={submitting}
                  >
                    {submitting ? "Checking…" : "Continue"}
                  </button>
                </form>
              </>
            ) : null}

            {step === STEP_SIGNIN ? (
              <>
                <h1 className={styles.authTitle}>Welcome back</h1>
                <p className={styles.authSubtitle}>
                  We found your account. Enter your password to sign in as{" "}
                  <strong>{email}</strong>.
                </p>
                {error ? <p className={styles.authError}>{error}</p> : null}
                <form className={styles.authForm} onSubmit={handleSignIn}>
                  <div className={styles.authField}>
                    <label className={styles.authLabel} htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      autoFocus
                      className={styles.authInput}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className={`app-btn ${styles.authSubmit}`}
                    disabled={submitting}
                  >
                    {submitting ? "Signing in…" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    className={`app-btn ${styles.profileGhostBtn}`}
                    onClick={resetToEmailStep}
                  >
                    Use a different email
                  </button>
                </form>
              </>
            ) : null}

            {step === STEP_SET_PASSWORD ? (
              <>
                <h1 className={styles.authTitle}>
                  {matchedName?.firstname
                    ? `Welcome, ${matchedName.firstname}`
                    : "We found your record"}
                </h1>
                <p className={styles.authSubtitle}>
                  Your email is on file with us. Set a password to claim your
                  customer portal account — your vehicles, jobs and invoices
                  will be linked automatically.
                </p>
                {error ? <p className={styles.authError}>{error}</p> : null}
                <form className={styles.authForm} onSubmit={handleSetPassword}>
                  <div className={styles.authField}>
                    <label className={styles.authLabel} htmlFor="set-password">
                      Create a password (min. 12 characters)
                    </label>
                    <input
                      id="set-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      autoFocus
                      className={styles.authInput}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className={`app-btn ${styles.authSubmit}`}
                    disabled={submitting}
                  >
                    {submitting ? "Setting up…" : "Set password & sign in"}
                  </button>
                  <button
                    type="button"
                    className={`app-btn ${styles.profileGhostBtn}`}
                    onClick={resetToEmailStep}
                  >
                    Use a different email
                  </button>
                </form>
              </>
            ) : null}

            {step === STEP_SIGNUP ? (
              <>
                <h1 className={styles.authTitle}>Create your account</h1>
                <p className={styles.authSubtitle}>
                  We don't have you on file yet. Fill in a few details to get
                  set up.
                </p>
                {error ? <p className={styles.authError}>{error}</p> : null}
                <form className={styles.authForm} onSubmit={handleSignup}>
                  <div className={styles.authRow}>
                    <div className={styles.authField}>
                      <label className={styles.authLabel}>First name</label>
                      <input
                        type="text"
                        autoComplete="given-name"
                        required
                        className={styles.authInput}
                        value={signupExtras.firstname}
                        onChange={(e) =>
                          setSignupExtras({
                            ...signupExtras,
                            firstname: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className={styles.authField}>
                      <label className={styles.authLabel}>Last name</label>
                      <input
                        type="text"
                        autoComplete="family-name"
                        required
                        className={styles.authInput}
                        value={signupExtras.lastname}
                        onChange={(e) =>
                          setSignupExtras({
                            ...signupExtras,
                            lastname: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.authField}>
                    <label className={styles.authLabel}>Mobile (optional)</label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      className={styles.authInput}
                      value={signupExtras.mobile}
                      onChange={(e) =>
                        setSignupExtras({
                          ...signupExtras,
                          mobile: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className={styles.authField}>
                    <label className={styles.authLabel}>
                      Password (min. 12 characters)
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      className={styles.authInput}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className={`app-btn ${styles.authSubmit}`}
                    disabled={submitting}
                  >
                    {submitting ? "Creating account…" : "Create account"}
                  </button>
                  <button
                    type="button"
                    className={`app-btn ${styles.profileGhostBtn}`}
                    onClick={resetToEmailStep}
                  >
                    Use a different email
                  </button>
                </form>
              </>
            ) : null}

            <p className={styles.authFootnote}>
              By continuing you agree to {siteContent.brand.name}'s privacy and
              data policy.
            </p>
          </div>

          {devEnabled ? (
            <div className={`${styles.authCard} ${styles.authDevCard}`}>
              <span className={styles.authDevTag}>Dev tools</span>
              <h2 className={styles.authDevTitle}>Impersonate customer</h2>
              <p className={styles.authSubtitle}>
                Test mode only. Pick any customer and you'll sign in as them
                — exactly the same view they would see.
              </p>
              <form className={styles.authForm} onSubmit={handleDevLogin}>
                <div className={styles.authField}>
                  <label className={styles.authLabel}>Customer</label>
                  <WebsiteSelect
                    value={devCustomerId}
                    onChange={setDevCustomerId}
                    placeholder={
                      devLoading ? "Loading customers…" : "Select a customer…"
                    }
                    required
                    options={devCustomers.map((c) => {
                      const name =
                        [c.firstname, c.lastname].filter(Boolean).join(" ") ||
                        c.email ||
                        c.id;
                      return {
                        value: c.id,
                        label: name,
                        hint: c.email || undefined,
                      };
                    })}
                  />
                </div>
                <button
                  type="submit"
                  className={`app-btn ${styles.authSubmit}`}
                  disabled={submitting || !devCustomerId}
                >
                  {submitting ? "Logging in…" : "Log in as customer"}
                </button>
              </form>
            </div>
          ) : null}
        </main>
      </div>
    </>
  );
}

CustomerLoginPage.getLayout = (page) => page;

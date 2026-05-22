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
import { siteContent } from "@/features/website/data/siteContent";
import { canShowDevLogin } from "@/lib/dev-tools/config";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import useWebsiteScope from "@/features/website/hooks/useWebsiteScope";
import useWebsiteTheme from "@/features/website/hooks/useWebsiteTheme";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";

const STEP_EMAIL = "email";
const STEP_SIGNIN = "signin";
const STEP_SET_PASSWORD = "set_password";
const STEP_SIGNUP = "signup";

export default function CustomerLoginPage() {
  const router = useRouter();
  useWebsiteScope();
  useWebsiteTheme();
  const [step, setStep] = useState(STEP_EMAIL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupExtras, setSignupExtras] = useState({
    firstname: "",
    lastname: "",
    mobile: "",
    telephone: "",
    postcode: "",
    address: "",
  });
  const [addressManual, setAddressManual] = useState(false);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressLookupMessage, setAddressLookupMessage] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSuggestionId, setAddressSuggestionId] = useState("");
  const [matchedName, setMatchedName] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const devEnabled = useMemo(() => !isPresentationMode() && canShowDevLogin(), []);
  const [devCustomers, setDevCustomers] = useState([]);
  const [devCustomerId, setDevCustomerId] = useState("");
  const [devLoading, setDevLoading] = useState(false);
  const pageTitle = `Sign in - ${siteContent.brand.name}`;

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
    setSignupExtras({
      firstname: "",
      lastname: "",
      mobile: "",
      telephone: "",
      postcode: "",
      address: "",
    });
    setAddressManual(false);
    setAddressLookupMessage("");
    setAddressSuggestions([]);
    setAddressSuggestionId("");
    setError("");
  };

  const updateSignupField = (field, value) => {
    setSignupExtras((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleAddressLookup = async () => {
    const postcode = signupExtras.postcode.trim();
    setAddressLookupMessage("");
    setAddressSuggestions([]);
    setAddressSuggestionId("");
    if (!postcode) {
      setAddressLookupMessage("Enter a postcode first.");
      return;
    }

    setAddressLookupLoading(true);
    try {
      const res = await fetch(`/api/postcode-lookup?postcode=${encodeURIComponent(postcode)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not find addresses for that postcode.");
      }
      const suggestions = data.suggestions || [];
      setAddressSuggestions(suggestions);
      setAddressLookupMessage(
        suggestions.length
          ? "Choose the matching address below."
          : "No addresses found. Enter the address manually.",
      );
      if (suggestions.length === 1) {
        const match = suggestions[0];
        setAddressSuggestionId(String(match.id));
        setSignupExtras((current) => ({
          ...current,
          postcode: match.postcode || current.postcode,
          address: match.fullAddress || match.label || current.address,
        }));
      }
    } catch (err) {
      setAddressLookupMessage(err.message);
      setAddressManual(true);
    } finally {
      setAddressLookupLoading(false);
    }
  };

  const handleAddressSuggestion = (suggestionId) => {
    const suggestion = addressSuggestions.find((item) => String(item.id) === String(suggestionId));
    if (!suggestion) return;
    setAddressSuggestionId(String(suggestionId));
    setSignupExtras((current) => ({
      ...current,
      postcode: suggestion.postcode || current.postcode,
      address: suggestion.fullAddress || suggestion.label || current.address,
    }));
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
      <div className={"authShell"} data-presentation="website-login">
        <main className={"authMain"}>
          <div className={"authCard"} data-presentation="website-login-card">
            <div className={"authTopRow"}>
              <Link href="/website" className={"authBackLink"}>
                Back to website
              </Link>

              <div className={"authBrand"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={siteContent.brand.logoUrl}
                  alt={siteContent.brand.name}
                />
              </div>
            </div>

            {step === STEP_EMAIL ? (
              <>
                <h1 className={"authTitle"}>Sign in or create account</h1>
                <p className={"authSubtitle"}>
                  Enter your email to continue. We'll find your existing
                  account or set you up with a new one.
                </p>
                {error ? <p className={"authError"}>{error}</p> : null}
                <form className={"authForm"} onSubmit={handleEmailContinue}>
                  <div className={"authField"}>
                    <label className={"authLabel"} htmlFor="email">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      autoFocus
                      className={"authInput"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className={`app-btn authSubmit`}
                    disabled={submitting}
                  >
                    {submitting ? "Checking…" : "Continue"}
                  </button>
                </form>
              </>
            ) : null}

            {step === STEP_SIGNIN ? (
              <>
                <h1 className={"authTitle"}>Welcome back</h1>
                <p className={"authSubtitle"}>
                  We found your account. Enter your password to sign in as{" "}
                  <strong>{email}</strong>.
                </p>
                {error ? <p className={"authError"}>{error}</p> : null}
                <form className={"authForm"} onSubmit={handleSignIn}>
                  <div className={"authField"}>
                    <label className={"authLabel"} htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      autoFocus
                      className={"authInput"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className={`app-btn authSubmit`}
                    disabled={submitting}
                  >
                    {submitting ? "Signing in…" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    className={`app-btn profileGhostBtn`}
                    onClick={resetToEmailStep}
                  >
                    Use a different email
                  </button>
                </form>
              </>
            ) : null}

            {step === STEP_SET_PASSWORD ? (
              <>
                <h1 className={"authTitle"}>
                  {matchedName?.firstname
                    ? `Welcome, ${matchedName.firstname}`
                    : "We found your record"}
                </h1>
                <p className={"authSubtitle"}>
                  Your email is on file with us. Set a password to claim your
                  customer portal account — your vehicles, jobs and invoices
                  will be linked automatically.
                </p>
                {error ? <p className={"authError"}>{error}</p> : null}
                <form className={"authForm"} onSubmit={handleSetPassword}>
                  <div className={"authField"}>
                    <label className={"authLabel"} htmlFor="set-password">
                      Create a password (min. 12 characters)
                    </label>
                    <input
                      id="set-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      autoFocus
                      className={"authInput"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className={`app-btn authSubmit`}
                    disabled={submitting}
                  >
                    {submitting ? "Setting up…" : "Set password & sign in"}
                  </button>
                  <button
                    type="button"
                    className={`app-btn profileGhostBtn`}
                    onClick={resetToEmailStep}
                  >
                    Use a different email
                  </button>
                </form>
              </>
            ) : null}

            {step === STEP_SIGNUP ? (
              <>
                <div className={"signupHeader"}>
                  <span className={"signupEyebrow"}>New customer</span>
                  <h1 className={"authTitle"}>Create your account</h1>
                  <p className={"authSubtitle"}>
                    We don't have you on file yet. Add your details and we'll
                    open your customer portal.
                  </p>
                  <div className={"signupEmailSummary"}>
                    <span>Email</span>
                    <strong>{email}</strong>
                  </div>
                </div>
                {error ? <p className={"authError"}>{error}</p> : null}
                <form
                  className={`authForm signupForm`}
                  onSubmit={handleSignup}
                >
                  <div className={"signupPanel"}>
                    <div className={"authRow"}>
                      <div className={"authField"}>
                        <label className={"authLabel"}>
                          First name <span className={"requiredMark"}>*</span>
                        </label>
                        <input
                          type="text"
                          autoComplete="given-name"
                          required
                          autoFocus
                          className={"authInput"}
                          value={signupExtras.firstname}
                          onChange={(e) => updateSignupField("firstname", e.target.value)}
                        />
                      </div>
                      <div className={"authField"}>
                        <label className={"authLabel"}>
                          Second name <span className={"requiredMark"}>*</span>
                        </label>
                        <input
                          type="text"
                          autoComplete="family-name"
                          required
                          className={"authInput"}
                          value={signupExtras.lastname}
                          onChange={(e) => updateSignupField("lastname", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className={"authField"}>
                      <label className={"authLabel"}>
                        Mobile <span className={"requiredMark"}>*</span>
                      </label>
                      <input
                        type="tel"
                        autoComplete="tel"
                        required
                        className={"authInput"}
                        value={signupExtras.mobile}
                        onChange={(e) => updateSignupField("mobile", e.target.value)}
                      />
                    </div>
                    <div className={"authField"}>
                      <label className={"authLabel"}>Telephone</label>
                      <input
                        type="tel"
                        autoComplete="tel-national"
                        className={"authInput"}
                        value={signupExtras.telephone}
                        onChange={(e) => updateSignupField("telephone", e.target.value)}
                      />
                    </div>
                    <div className={"authField"}>
                      <label className={"authLabel"}>
                        Postcode <span className={"requiredMark"}>*</span>
                      </label>
                      <div className={"postcodeLookupRow"}>
                        <input
                          type="text"
                          autoComplete="postal-code"
                          required
                          className={"authInput"}
                          value={signupExtras.postcode}
                          onChange={(e) => updateSignupField("postcode", e.target.value.toUpperCase())}
                        />
                        <button
                          type="button"
                          className={`app-btn postcodeLookupButton`}
                          onClick={handleAddressLookup}
                          disabled={addressLookupLoading}
                        >
                          {addressLookupLoading ? "Searching" : "Search"}
                        </button>
                      </div>
                      {addressLookupMessage ? (
                        <span className={"signupHint"}>{addressLookupMessage}</span>
                      ) : null}
                    </div>
                    {addressSuggestions.length > 0 ? (
                      <div className={"authField"}>
                        <label className={"authLabel"}>Select address</label>
                        <WebsiteNativeSelect
                          value={addressSuggestionId}
                          onChange={handleAddressSuggestion}
                          placeholder="Choose address"
                          options={addressSuggestions.map((suggestion) => ({
                            value: suggestion.id,
                            label: suggestion.label,
                          }))}
                        />
                      </div>
                    ) : null}
                    <div className={"authField"}>
                      <div className={"addressFieldHeader"}>
                        <label className={"authLabel"}>
                          Full address <span className={"requiredMark"}>*</span>
                        </label>
                        <button
                          type="button"
                          className={"addressManualButton"}
                          onClick={() => setAddressManual((current) => !current)}
                        >
                          {addressManual ? "Use lookup" : "Enter manually"}
                        </button>
                      </div>
                      <textarea
                        autoComplete="street-address"
                        required
                        readOnly={!addressManual && addressSuggestions.length > 0}
                        className={`authInput authTextarea`}
                        value={signupExtras.address}
                        onChange={(e) => updateSignupField("address", e.target.value)}
                      />
                    </div>
                    <div className={"authField"}>
                      <label className={"authLabel"}>
                        Password <span className={"requiredMark"}>*</span>
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        required
                        className={"authInput"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <span className={"signupHint"}>
                        Use at least 12 characters.
                      </span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className={`app-btn authSubmit`}
                    disabled={submitting}
                  >
                    {submitting ? "Creating account…" : "Create account"}
                  </button>
                  <button
                    type="button"
                    className={`app-btn profileGhostBtn`}
                    onClick={resetToEmailStep}
                  >
                    Use a different email
                  </button>
                </form>
              </>
            ) : null}

            <p className={"authFootnote"}>
              By continuing you agree to {siteContent.brand.name}'s privacy and
              data policy.
            </p>
          </div>

          {devEnabled ? (
            <div className={`authCard authDevCard`}>
              <span className={"authDevTag"}>Dev tools</span>
              <h2 className={"authDevTitle"}>Impersonate customer</h2>
              <p className={"authSubtitle"}>
                Test mode only. Pick any customer and you'll sign in as them
                — exactly the same view they would see.
              </p>
              <form className={"authForm"} onSubmit={handleDevLogin}>
                <div className={"authField"}>
                  <label className={"authLabel"}>Customer</label>
                  <WebsiteNativeSelect
                    value={devCustomerId}
                    onChange={setDevCustomerId}
                    required
                    placeholder={devLoading ? "Loading customers..." : "Select a customer..."}
                    options={devCustomers.map((c) => {
                      const name =
                        [c.firstname, c.lastname].filter(Boolean).join(" ") ||
                        c.email ||
                        c.id;
                      const label = c.email ? `${name} - ${c.email}` : name;
                      return {
                        value: c.id,
                        label,
                        hint: c.email || undefined,
                      };
                    })}
                  />
                </div>
                <button
                  type="submit"
                  className={`app-btn authSubmit`}
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

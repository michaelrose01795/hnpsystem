// file location: src/features/website/showcase/sections/AuthShowcase.js
//
// /website/dev — @family auth: the /website/login card, sign-up panel and dev
// impersonation card. Markup mirrors src/pages/website/login.js: fields take
// the shared control rule, "Continue" / "Sign in" are the one primary
// (.app-btn) per step, and every other button is the raw-<button> secondary.

import BrandLogo from "@/components/BrandLogo";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";
import { Row, ShowcaseSection } from "../ShowcasePrimitives";

const noop = () => {};

export default function AuthShowcase({ section }) {
  return (
    <ShowcaseSection id="auth" section={section}>
      <Row label="Email step" note=".authCard · .authTopRow · .authBackLink · .authInput (type=email) · .authSubmit">
        <div className="website-dev-auth-frame">
          <div className="authShell">
            <main className="authMain">
              <div className="authCard">
                <div className="authTopRow">
                  <a href="#marketing" className="authBackLink">
                    Back to website
                  </a>
                  <div className="authBrand">
                    <BrandLogo alt="Humphries and Parks" />
                  </div>
                </div>
                <h3 className="authTitle">Sign in or create account</h3>
                <p className="authSubtitle">
                  Enter your email to continue. We&apos;ll find your existing account or set you up with a new one.
                </p>
                <form className="authForm" onSubmit={(event) => event.preventDefault()}>
                  <div className="authField">
                    <label className="authLabel" htmlFor="dev-auth-email">
                      Email
                    </label>
                    <input id="dev-auth-email" type="email" autoComplete="off" className="authInput" />
                  </div>
                  <button type="submit" className="app-btn authSubmit">
                    Continue
                  </button>
                </form>
                <p className="authFootnote">By continuing you agree to our privacy and data policy.</p>
              </div>
              <div className="authCard authDevCard">
                <span className="authDevTag">Dev tools</span>
                <h3 className="authDevTitle">Impersonate customer</h3>
                <p className="authSubtitle">Test mode only. Pick any customer and you&apos;ll sign in as them.</p>
                <form className="authForm" onSubmit={(event) => event.preventDefault()}>
                  <div className="authField">
                    <label className="authLabel">Customer</label>
                    <WebsiteNativeSelect
                      value=""
                      onChange={noop}
                      placeholder="Select a customer..."
                      options={[{ value: "demo", label: "Jordan Reyes", hint: "jordan@example.com" }]}
                    />
                  </div>
                  <button type="submit" className="app-btn authSubmit" disabled>
                    Log in as customer
                  </button>
                </form>
              </div>
            </main>
          </div>
        </div>
      </Row>

      <Row label="Sign-in step" note=".authError · .authInput (type=password) · .profileGhostBtn (secondary)">
        <div className="website-dev-auth-frame">
          <div className="authShell">
            <main className="authMain">
              <div className="authCard">
                <h3 className="authTitle">Welcome back</h3>
                <p className="authSubtitle">
                  We found your account. Enter your password to sign in as <strong>you@example.com</strong>.
                </p>
                <p className="authError">That password did not match. Try again.</p>
                <form className="authForm" onSubmit={(event) => event.preventDefault()}>
                  <div className="authField">
                    <label className="authLabel" htmlFor="dev-auth-password">
                      Password
                    </label>
                    <input id="dev-auth-password" type="password" autoComplete="off" className="authInput" />
                  </div>
                  <button type="submit" className="app-btn authSubmit">
                    Sign in
                  </button>
                  <button type="button" className="profileGhostBtn">
                    Use a different email
                  </button>
                </form>
              </div>
            </main>
          </div>
        </div>
      </Row>

      <Row label="Sign-up panel" note=".signupHeader · .signupEmailSummary · .signupPanel · .authRow · .postcodeLookupRow · .addressFieldHeader">
        <div className="website-dev-auth-frame">
          <div className="authShell">
            <main className="authMain">
              <div className="authCard">
                <div className="signupHeader">
                  <span className="signupEyebrow">New customer</span>
                  <h3 className="authTitle">Create your account</h3>
                  <p className="authSubtitle">We don&apos;t have you on file yet. Add your details and we&apos;ll open your customer portal.</p>
                  <div className="signupEmailSummary">
                    <span>Email</span>
                    <strong>you@example.com</strong>
                  </div>
                </div>
                <form className="authForm" onSubmit={(event) => event.preventDefault()}>
                  <div className="signupPanel">
                    <div className="authRow">
                      <div className="authField">
                        <label className="authLabel" htmlFor="dev-auth-first">
                          First name <span className="requiredMark">*</span>
                        </label>
                        <input id="dev-auth-first" type="text" className="authInput" />
                      </div>
                      <div className="authField">
                        <label className="authLabel" htmlFor="dev-auth-last">
                          Second name <span className="requiredMark">*</span>
                        </label>
                        <input id="dev-auth-last" type="text" className="authInput" />
                      </div>
                    </div>
                    <div className="authField">
                      <label className="authLabel" htmlFor="dev-auth-postcode">
                        Postcode <span className="requiredMark">*</span>
                      </label>
                      <div className="postcodeLookupRow">
                        <input id="dev-auth-postcode" type="text" className="authInput" placeholder="TN15 6AA" />
                        <button type="button" className="postcodeLookupButton">
                          Search
                        </button>
                      </div>
                      <span className="signupHint">Choose the matching address below.</span>
                    </div>
                    <div className="authField">
                      <div className="addressFieldHeader">
                        <label className="authLabel" htmlFor="dev-auth-address">
                          Full address <span className="requiredMark">*</span>
                        </label>
                        <button type="button" className="addressManualButton">
                          Enter manually
                        </button>
                      </div>
                      <textarea id="dev-auth-address" className="authInput" />
                    </div>
                  </div>
                  <button type="submit" className="app-btn authSubmit">
                    Create account
                  </button>
                  <button type="button" className="profileGhostBtn">
                    Use a different email
                  </button>
                </form>
              </div>
            </main>
          </div>
        </div>
      </Row>
    </ShowcaseSection>
  );
}

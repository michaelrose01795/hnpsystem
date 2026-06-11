// Presentation overlays for the personal account / privacy pages.
// Deck order is driven by docs/ui/ui-presentation; workflowIndex values
// here only need to be unique numbers.

export const profilePrivacySlide = {
  id: "profile-privacy",
  route: "/profile/privacy",
  title: "Privacy & Your Data",
  roles: null,
  workflowIndex: 140,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Every user can see their own data",
      body: "Staff can review the personal data held about them, manage consent and exercise their data rights without going through an admin.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Consent on the user's terms",
      body: "Marketing and reminder consents are granted or withdrawn here, and the change is recorded in the consent ledger.",
    },
  ],
};

export const accountSecuritySlide = {
  id: "account-security",
  route: "/security",
  title: "Account Security",
  roles: null,
  workflowIndex: 141,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Password and recent activity",
      body: "Users change their password and review recent sign-in activity from one place, so an unfamiliar login is easy to spot.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Visibility deters misuse",
      body: "Showing each session's time, IP and device makes account sharing and stale logins obvious.",
    },
  ],
};

export const passwordResetNewSlide = {
  id: "password-reset-new",
  route: "/password-reset/new",
  title: "Set a New Password",
  roles: null,
  workflowIndex: 142,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "Guided password reset",
      body: "A signed reset link brings the user to a single, clear form to set a new password — no admin involvement needed.",
    },
    {
      kind: "feature",
      position: "bottom-left",
      title: "Safe by design",
      body: "The link is time-limited and single-use, and the strength rules are enforced before the new password is accepted.",
    },
  ],
};

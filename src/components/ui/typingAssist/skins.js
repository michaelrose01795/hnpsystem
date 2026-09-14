// file location: src/components/ui/typingAssist/skins.js
//
// Class names for the typing assistant's MIRROR (underlines, ghost word, Tab
// key cap) in its two skins. Written out in full, never assembled from a
// prefix, so both design checks can see every class:
//   staff    — src/styles/families/typing-assist.css (html.staff-scope)
//   website  — `@family typing-assist` in src/styles/custglobal.css
//
// The popovers carry their classes literally in their own markup: the staff one
// in GlobalTypingAssist.js, the customer one in
// src/features/website/components/WebsiteTypingAssistPopover.js.

export const TYPING_ASSIST_SKINS = {
  staff: {
    overlay: "app-typing-assist",
    markSpelling: "app-typing-assist__mark app-typing-assist__mark--spelling",
    markGrammar: "app-typing-assist__mark app-typing-assist__mark--grammar",
    ghost: "app-typing-assist__ghost",
    hint: "app-typing-assist__hint",
  },
  website: {
    overlay: "website-typing-assist",
    markSpelling: "website-typing-assist__mark website-typing-assist__mark--spelling",
    markGrammar: "website-typing-assist__mark website-typing-assist__mark--grammar",
    ghost: "website-typing-assist__ghost",
    hint: "website-typing-assist__hint",
  },
};

export const TYPING_ASSIST_ACTIVE = "is-active";

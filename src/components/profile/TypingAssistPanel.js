// file location: src/components/profile/TypingAssistPanel.js
//
// Staff settings for the global typing assistant (spelling, grammar, Tab word
// prediction). Opened from the Typing button on /profile. Everything here is
// stored on this device only — see src/lib/typingAssist/settings.js.

import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import useTypingAssistSettings from "@/hooks/useTypingAssistSettings";

const OPTIONS = [
  {
    key: "spelling",
    label: "Spelling",
    hint: "Straight red underline under misspelt words. Click the word for UK English suggestions.",
  },
  {
    key: "ukSpelling",
    label: "UK English spellings",
    hint: "Also flag American spellings, such as color, organize and center.",
  },
  {
    key: "grammar",
    label: "Grammar and punctuation",
    hint: "Straight blue underline for grammar, punctuation and UK usage, such as a / an and advice / advise.",
  },
  {
    key: "predictions",
    label: "Word prediction",
    hint: "Shows the likely next word in grey as you type. Press Tab to accept it, Esc to dismiss.",
  },
  {
    key: "learn",
    label: "Learn from my typing",
    hint: "Improves predictions from the words you use most. Only correctly spelt words are learned.",
  },
];

// A labelled checkbox (.app-toggle-field): the whole row, caption included, is
// the 44px touch target.
function OptionRow({ id, label, hint, checked, disabled = false, onChange }) {
  return (
    <label className="app-toggle-field" htmlFor={id} style={{ alignItems: "flex-start", minHeight: "44px" }}>
      <input
        id={id}
        type="checkbox"
        className="app-toggle app-toggle--checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
        <strong>{label}</strong>
        {hint ? <span className="app-field-hint">{hint}</span> : null}
      </span>
    </label>
  );
}

export default function TypingAssistPanel() {
  const { settings, update, reset, dictionary, removeWord, clearLearned } = useTypingAssistSettings();
  const off = !settings.enabled;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap)" }}>
      <LayerTheme gap="var(--layout-card-gap)">
        <h2>Typing assistant</h2>
        <p className="app-field-hint">
          Checks what you type in every text box, search bar and notes field across the app. Registrations, part numbers
          and other codes are ignored, and password, e-mail and phone fields are skipped. Nothing you type leaves this
          device.
        </p>
        <OptionRow
          id="typing-assist-enabled"
          label="Turn on the typing assistant"
          hint="When off, the browser's own spellcheck is used instead."
          checked={settings.enabled}
          onChange={(value) => update({ enabled: value })}
        />
        {OPTIONS.map((option) => (
          <OptionRow
            key={option.key}
            id={`typing-assist-${option.key}`}
            label={option.label}
            hint={option.hint}
            checked={settings[option.key]}
            disabled={off || (option.key === "ukSpelling" && !settings.spelling) || (option.key === "learn" && !settings.predictions)}
            onChange={(value) => update({ [option.key]: value })}
          />
        ))}
      </LayerTheme>

      <LayerTheme gap="var(--layout-card-gap)">
        <h3>Keyboard</h3>
        <p className="app-field-hint">Tab accepts the grey predicted word. Esc dismisses it or closes suggestions.</p>
        <p className="app-field-hint">Click an underlined word, or press Ctrl+. with the caret on it, to see corrections.</p>
        <p className="app-field-hint">Use the arrow keys and Enter to choose a correction.</p>
      </LayerTheme>

      <LayerTheme gap="var(--layout-card-gap)">
        <h3>My dictionary</h3>
        {dictionary.length ? (
          <div className="app-table-scroll">
            <table className="app-data-table app-data-table--compact">
              <tbody>
                {dictionary.map((word) => (
                  <tr key={word}>
                    <td>{word}</td>
                    <td style={{ width: "1%", whiteSpace: "nowrap" }}>
                      <Button type="button" variant="secondary" size="xs" onClick={() => removeWord(word)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="app-field-hint">No words added yet. Choose Add to dictionary on a word you want accepted.</p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <Button type="button" variant="secondary" onClick={clearLearned}>
            Clear learned predictions
          </Button>
          <Button type="button" variant="secondary" onClick={reset}>
            Reset settings
          </Button>
        </div>
      </LayerTheme>
    </div>
  );
}

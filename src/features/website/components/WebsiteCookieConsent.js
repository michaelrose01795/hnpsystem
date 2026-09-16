// file location: src/features/website/components/WebsiteCookieConsent.js
//
// The /website presentation of the global cookie banner. State, storage and
// the consent API call stay in src/components/CookieBanner.js, which renders
// this under `html.website-scope`. Styled by custglobal.css (.ws-consent*):
// raw <button> is the secondary control and .app-btn the primary, so Reject
// and Accept share one size and shape (PECR reject parity) and the panel
// follows the website theme.

export default function WebsiteCookieConsent({
  categories,
  selections,
  onToggle,
  showCustomise,
  onCustomise,
  onSave,
  onReject,
  onAccept,
}) {
  return (
    <div className="ws-consent" role="dialog" aria-label="Cookie consent">
      <h2 className="ws-consent-title">Cookies on this site</h2>
      <p className="ws-consent-text">
        We use essential cookies to make the site work. With your permission we&apos;d
        also like to use other cookies to remember preferences, measure usage, and improve
        the service. You can change your choice at any time on the privacy page.
      </p>

      {showCustomise && (
        <div className="ws-consent-options">
          {categories.map((cat) => (
            <label key={cat.key} className="ws-consent-option" data-locked={cat.locked ? "true" : undefined}>
              <input
                type="checkbox"
                checked={cat.locked ? true : Boolean(selections[cat.key])}
                disabled={cat.locked}
                onChange={(e) => onToggle(cat.key, e.target.checked)}
              />
              <span>
                <span className="ws-consent-option-label">
                  {cat.label}
                  {cat.locked && <span className="ws-consent-option-flag">(always on)</span>}
                </span>
                <span className="ws-consent-option-note">{cat.description}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="ws-consent-actions">
        {showCustomise ? (
          <button type="button" onClick={onSave}>
            Save Choices
          </button>
        ) : (
          <button type="button" onClick={onCustomise}>
            Customise
          </button>
        )}
        <button type="button" onClick={onReject}>
          Reject All
        </button>
        <button type="button" className="app-btn" onClick={onAccept}>
          Accept All
        </button>
      </div>
    </div>
  );
}

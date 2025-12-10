// file location: src/components/accounts/AccountForm.js // header comment per requirement
import React, { useEffect, useState } from "react"; // import React and hooks for component logic
import PropTypes from "prop-types"; // import PropTypes for runtime validation
import { ACCOUNT_TYPES, ACCOUNT_STATUSES, DEFAULT_ACCOUNT_FORM_VALUES } from "@/config/accounts"; // import shared account constants
const fieldGroupStyles = { // shared style object for form sections
  background: "var(--surface)", // white card background
  border: "1px solid var(--surface-light)", // subtle outline to match DMS cards
  borderRadius: "16px", // rounded corners for card look
  padding: "20px", // consistent spacing inside card
  display: "flex", // use flex layout for responsive grid
  flexWrap: "wrap", // wrap fields on smaller screens
  gap: "16px", // spacing between fields
}; // close fieldGroupStyles definition
const inputStyles = { // shared input style for text/number fields
  width: "100%", // inputs expand to fill container
  padding: "10px 12px", // comfortable padding for inputs
  borderRadius: "10px", // match rest of UI elements
  border: "1px solid var(--surface-light)", // subtle border
  background: "var(--surface-light)", // slightly tinted background
}; // close inputStyles definition
const labelStyles = { // shared label style
  fontSize: "0.85rem", // small uppercase label style
  fontWeight: 600, // bold label text per DMS aesthetic
  textTransform: "uppercase", // uppercase to match design system
  color: "var(--text-secondary)", // muted tone for labels
  letterSpacing: "0.05em", // extra spacing for readability
}; // close labelStyles definition
const fieldDefinitions = [ // describe fields rendered under core account info
  { name: "customer_id", label: "Customer ID", type: "text" }, // text field for customer relationship
  { name: "account_type", label: "Account Type", type: "select", options: ACCOUNT_TYPES }, // select for account type
  { name: "balance", label: "Balance", type: "number" }, // numeric field for balance
  { name: "credit_limit", label: "Credit Limit", type: "number" }, // numeric field for credit limit
  { name: "credit_terms", label: "Credit Terms (Days)", type: "number" }, // numeric field for terms
  { name: "status", label: "Status", type: "select", options: ACCOUNT_STATUSES }, // select for account status
]; // close fieldDefinitions array
const billingFields = [ // describe billing contact fields to render
  { name: "billing_name", label: "Billing Name", type: "text" }, // billing contact name
  { name: "billing_email", label: "Billing Email", type: "email" }, // billing email address
  { name: "billing_phone", label: "Billing Phone", type: "tel" }, // billing phone number
  { name: "billing_address_line1", label: "Address Line 1", type: "text" }, // primary address line
  { name: "billing_address_line2", label: "Address Line 2", type: "text" }, // secondary address line
  { name: "billing_city", label: "City", type: "text" }, // city field
  { name: "billing_postcode", label: "Postcode", type: "text" }, // postcode/zip field
  { name: "billing_country", label: "Country", type: "text" }, // country field
]; // close billingFields definition
const textareaStyles = { ...inputStyles, minHeight: "100px" }; // extend input style for textarea height
export default function AccountForm({ initialValues, onSubmit, isSubmitting, readOnly, onCancel }) { // component definition handling account create/edit
  const [formValues, setFormValues] = useState({ ...DEFAULT_ACCOUNT_FORM_VALUES, ...initialValues }); // initialize form state from defaults merged with incoming values
  useEffect(() => { // sync form state whenever initialValues change (e.g., when loading account record)
    setFormValues((prev) => ({ ...prev, ...initialValues })); // merge new initial values on top of existing state
  }, [initialValues]); // rerun effect when initialValues reference changes
  const handleChange = (event) => { // handle field value changes from inputs
    const { name, value, type } = event.target; // extract name/value from target input
    if (!name) return; // guard inputs without name attribute
    const parsedValue = type === "number" ? Number(value) : value; // convert numeric inputs to numbers
    setFormValues((prev) => ({ ...prev, [name]: parsedValue })); // update state with new value
  }; // close handleChange definition
  const handleSubmit = (event) => { // handle form submission event
    event.preventDefault(); // prevent browser default submission behavior
    if (typeof onSubmit === "function") { // ensure onSubmit prop exists
      onSubmit(formValues); // pass current formValues to parent handler
    } // close guard
  }; // close handleSubmit handler
  const isFrozen = (formValues.status || "").toLowerCase() === "frozen"; // compute if account currently frozen to show warning
  return ( // render form structure
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}> // wrap form fields with vertical spacing
      <section style={fieldGroupStyles}> // core account details card
        <header style={{ flexBasis: "100%" }}> // section header row spanning full width
          <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Core Account Details</h2> // section title styling
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>Maintain account type, balance, and status.</p> // section subtitle
        </header>
        {fieldDefinitions.map((field) => ( // render mapped fields for core details
          <label key={field.name} style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: "6px" }}> // label container with responsive width
            <span style={labelStyles}>{field.label}</span> // label text using shared style
            {field.type === "select" ? ( // render select for specified fields
              <select name={field.name} value={formValues[field.name] || ""} onChange={handleChange} disabled={readOnly || (field.name === "account_type" && !!formValues.account_id)} style={inputStyles}> // select input configured with shared style
                {(field.options || []).map((option) => ( // map available options to option elements
                  <option key={option} value={option}>{option}</option> // option element using value as label
                ))}
              </select>
            ) : ( // render fallback to text/number input
              <input name={field.name} type={field.type} value={formValues[field.name] ?? ""} onChange={handleChange} disabled={readOnly && field.name !== "status"} style={inputStyles} step={field.type === "number" ? "0.01" : undefined} /> // input element with shared style and numeric step when necessary
            )}
          </label>
        ))}
        <label style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: "6px" }}> // text area for internal notes
          <span style={labelStyles}>Internal Notes</span> // label for notes field
          <textarea name="notes" style={textareaStyles} value={formValues.notes || ""} onChange={handleChange} disabled={readOnly} placeholder="Credit control notes, reminders, or manual adjustments." /> // textarea element capturing notes
        </label>
        {isFrozen && ( // show warning message when account is frozen
          <div style={{ flexBasis: "100%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "12px", padding: "14px" }}> // warning card highlighting freeze rule
            <strong style={{ display: "block", color: "#92400e", marginBottom: "4px" }}>Frozen Account</strong> // warning title text
            <p style={{ margin: 0, color: "#92400e", fontSize: "0.9rem" }}>New invoices cannot be assigned to frozen accounts until status changes back to Active.</p> // warning description aligning with requirements
          </div>
        )}
      </section>
      <section style={fieldGroupStyles}> // billing details card container
        <header style={{ flexBasis: "100%" }}> // header row for billing section
          <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.25rem" }}>Billing Contact</h2> // billing section title
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>Keep invoicing information up to date for statements.</p> // billing subtitle
        </header>
        {billingFields.map((field) => ( // render billing input fields via map
          <label key={field.name} style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: "6px" }}> // wrapper for field label/input
            <span style={labelStyles}>{field.label}</span> // label text
            <input name={field.name} type={field.type} value={formValues[field.name] ?? ""} onChange={handleChange} disabled={readOnly} style={inputStyles} /> // input element bound to state
          </label>
        ))}
      </section>
      {!readOnly && ( // render action buttons only when form is editable
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}> // action row container
          {onCancel && ( // optionally render cancel button when handler provided
            <button type="button" onClick={onCancel} style={{ borderRadius: "10px", padding: "10px 16px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", color: "var(--text-secondary)", fontWeight: 600 }}>
              Cancel // cancel button label
            </button>
          )}
          <button type="submit" disabled={isSubmitting} style={{ borderRadius: "10px", padding: "10px 18px", border: "none", background: "var(--primary)", color: "white", fontWeight: 700, minWidth: "160px", cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? "Saving…" : "Save Account"} // show saving state text when submitting
          </button>
        </div>
      )}
    </form>
  ); // close AccountForm render
} // close component definition
AccountForm.propTypes = { // prop validation for the component
  initialValues: PropTypes.object, // optional initial form values
  onSubmit: PropTypes.func.isRequired, // submission handler required to persist data
  isSubmitting: PropTypes.bool, // flag controlling disabled state of submit button
  readOnly: PropTypes.bool, // toggle read-only mode for view pages
  onCancel: PropTypes.func, // optional cancel callback to close form
}; // close propTypes
AccountForm.defaultProps = { // provide defaults for optional props
  initialValues: DEFAULT_ACCOUNT_FORM_VALUES, // start with shared defaults
  isSubmitting: false, // default not submitting
  readOnly: false, // default to editable form
  onCancel: undefined, // cancel handler optional
}; // close defaultProps

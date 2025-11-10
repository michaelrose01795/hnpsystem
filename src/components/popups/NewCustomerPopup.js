// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/popups/NewCustomerPopup.js
import React, { useState } from "react"; // import React hooks
import { addCustomerToDatabase } from "@/lib/database/customers"; // import database function

export default function NewCustomerPopup({ onClose, onSelect }) {
  // State for all form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [number, setNumber] = useState("");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");
  const [country, setCountry] = useState("");
  const [postcode, setPostcode] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [telephone, setTelephone] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Function to handle "Add Customer"
  const handleAdd = async () => {
    // Combine address fields into one string
    const address = `${number} ${street}, ${town}, ${country}, ${postcode}`;

    // Prevent incomplete submission
    if (!firstName.trim() || !lastName.trim()) {
      alert("Please enter both first and last names.");
      return;
    }

    setLoading(true);

    try {
      // Call the shared database function
      const newCustomer = await addCustomerToDatabase({
        firstName,
        lastName,
        address,
        email,
        mobile,
        telephone,
      });

      // If insert succeeded, send data to parent
      if (newCustomer && typeof onSelect === "function") {
        onSelect(newCustomer);
      }

      // Close popup
      if (typeof onClose === "function") onClose();
    } catch (error) {
      console.error("❌ Error adding customer:", error);
      alert(error.message || "Failed to add customer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ UI layout for popup
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          width: "420px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Add New Customer</h3>

        {/* Form fields */}
        {[
          ["First Name", firstName, setFirstName],
          ["Last Name", lastName, setLastName],
          ["Number", number, setNumber],
          ["Street", street, setStreet],
          ["Town/City", town, setTown],
          ["Country", country, setCountry],
          ["Postcode", postcode, setPostcode],
          ["Email", email, setEmail],
          ["Mobile", mobile, setMobile],
          ["Telephone", telephone, setTelephone],
        ].map(([label, value, setter]) => (
          <div key={label}>
            <label>{label}:</label>
            <input
              type={label === "Email" ? "email" : "text"}
              value={value}
              onChange={(e) => setter(e.target.value)}
              style={{ width: "100%", marginBottom: "8px" }}
            />
          </div>
        ))}

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "12px",
          }}
        >
          <button onClick={onClose} style={{ padding: "8px 16px" }}>
            Close
          </button>
          <button
            onClick={handleAdd}
            disabled={loading}
            style={{
              padding: "8px 16px",
              backgroundColor: "#FF4040",
              color: "white",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Saving..." : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

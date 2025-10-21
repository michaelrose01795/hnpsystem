// file location: src/components/popups/NewCustomerPopup.js
import React, { useState } from "react"; // Import React and useState hook

// NewCustomerPopup component, receives onClose and onSelect from parent
export default function NewCustomerPopup({ onClose, onSelect }) {
  // firstName state for customer's first name
  const [firstName, setFirstName] = useState(""); // Track first name
  // lastName state for customer's last name
  const [lastName, setLastName] = useState(""); // Track last name
  // number state for house/building number
  const [number, setNumber] = useState(""); // Track address number
  // street state for street name
  const [street, setStreet] = useState(""); // Track street
  // town state for town/city
  const [town, setTown] = useState(""); // Track town/city
  // country state for country
  const [country, setCountry] = useState(""); // Track country
  // postcode state for postcode
  const [postcode, setPostcode] = useState(""); // Track postcode
  // email state for customer's email
  const [email, setEmail] = useState(""); // Track email
  // mobile state for mobile number
  const [mobile, setMobile] = useState(""); // Track mobile
  // telephone state for landline
  const [telephone, setTelephone] = useState(""); // Track telephone

  // handleAdd aggregates field values and calls parent onSelect + onClose
  const handleAdd = () => {
    // Build address string from address parts
    const address = `${number} ${street}, ${town}, ${country}, ${postcode}`; // Build address
    // Safely call onSelect if provided
    if (typeof onSelect === "function") {
      onSelect({
        firstName, // customer's first name
        lastName, // customer's last name
        address, // aggregated address
        email, // customer's email
        mobile, // customer's mobile
        telephone, // customer's telephone
      });
    } else {
      console.error("onSelect is not defined or not a function.");
    }
    // Close the popup after adding
    if (typeof onClose === "function") onClose(); // Close popup
  }; // End handleAdd

  // JSX returned by component (overlay + form)
  return (
    // Overlay container that covers the screen
    <div
      style={{
        position: "fixed", // fixed overlay
        top: 0, // top 0
        left: 0, // left 0
        width: "100%", // full width
        height: "100%", // full height
        backgroundColor: "rgba(0,0,0,0.5)", // translucent background
        display: "flex", // center content
        justifyContent: "center", // center horizontally
        alignItems: "center", // center vertically
        zIndex: 1000, // ensure on top
      }}
    >
      {/* Inner popup card */}
      <div
        style={{
          backgroundColor: "white", // popup background
          padding: "24px", // padding
          borderRadius: "8px", // rounded corners
          width: "420px", // fixed width
          maxHeight: "90vh", // limit height
          overflowY: "auto", // scroll when tall
        }}
      >
        {/* Title */}
        <h3 style={{ marginTop: 0 }}>Add New Customer</h3> {/* Heading */}

        {/* First Name */}
        <label>First Name:</label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Last Name */}
        <label>Last Name:</label>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Number */}
        <label>Number:</label>
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Street */}
        <label>Street:</label>
        <input
          type="text"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Town/City */}
        <label>Town/City:</label>
        <input
          type="text"
          value={town}
          onChange={(e) => setTown(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Country */}
        <label>Country:</label>
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Postcode */}
        <label>Postcode:</label>
        <input
          type="text"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Email */}
        <label>Email:</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Mobile */}
        <label>Mobile:</label>
        <input
          type="text"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Telephone */}
        <label>Telephone:</label>
        <input
          type="text"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          style={{ width: "100%", marginBottom: "8px" }}
        />

        {/* Buttons row */}
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
            style={{
              padding: "8px 16px",
              backgroundColor: "#FF4040",
              color: "white",
            }}
          >
            Add Customer
          </button>
        </div>
      </div>
    </div>
  ); // End return
}

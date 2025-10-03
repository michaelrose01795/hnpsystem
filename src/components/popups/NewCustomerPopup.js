// file location: src/components/popups/NewCustomerPopup.js
import React, { useState } from "react"; // Import React and useState hook

// NewCustomerPopup component, receives onClose and onAdd from parent
export default function NewCustomerPopup({ onClose, onAdd }) {
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

  // handleAdd aggregates field values and calls parent onAdd + onClose
  const handleAdd = () => {
    // Build address string from address parts
    const address = `${number} ${street}, ${town}, ${country}, ${postcode}`; // Build address
    // Call onAdd with the new customer object
    onAdd({
      firstName, // customer's first name
      lastName, // customer's last name
      address, // aggregated address
      email, // customer's email
      mobile, // customer's mobile
      telephone, // customer's telephone
    }); // Pass new customer back to parent
    // Close the popup after adding
    onClose(); // Close popup
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
        <label>First Name:</label> {/* Label */}
        <input
          type="text" // text input
          value={firstName} // bind to state
          onChange={(e) => setFirstName(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Last Name */}
        <label>Last Name:</label> {/* Label */}
        <input
          type="text" // text input
          value={lastName} // bind to state
          onChange={(e) => setLastName(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Number */}
        <label>Number:</label> {/* Label */}
        <input
          type="text" // text input
          value={number} // bind to state
          onChange={(e) => setNumber(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Street */}
        <label>Street:</label> {/* Label */}
        <input
          type="text" // text input
          value={street} // bind to state
          onChange={(e) => setStreet(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Town/City */}
        <label>Town/City:</label> {/* Label */}
        <input
          type="text" // text input
          value={town} // bind to state
          onChange={(e) => setTown(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Country */}
        <label>Country:</label> {/* Label */}
        <input
          type="text" // text input
          value={country} // bind to state
          onChange={(e) => setCountry(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Postcode */}
        <label>Postcode:</label> {/* Label */}
        <input
          type="text" // text input
          value={postcode} // bind to state
          onChange={(e) => setPostcode(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Email */}
        <label>Email:</label> {/* Label */}
        <input
          type="email" // email input
          value={email} // bind to state
          onChange={(e) => setEmail(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Mobile */}
        <label>Mobile:</label> {/* Label */}
        <input
          type="text" // text input
          value={mobile} // bind to state
          onChange={(e) => setMobile(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Telephone */}
        <label>Telephone:</label> {/* Label */}
        <input
          type="text" // text input
          value={telephone} // bind to state
          onChange={(e) => setTelephone(e.target.value)} // update state
          style={{ width: "100%", marginBottom: "8px" }} // styling
        />
        {/* Buttons row */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
          {/* Close button */}
          <button onClick={onClose} style={{ padding: "8px 16px" }}>
            Close
          </button>
          {/* Add Customer button */}
          <button onClick={handleAdd} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white" }}>
            Add Customer
          </button>
        </div>
      </div>
    </div>
  ); // End return
}
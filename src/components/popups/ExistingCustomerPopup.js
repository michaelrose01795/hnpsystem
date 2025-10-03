// file location: src/components/popups/ExistingCustomerPopup.js
import React, { useState } from "react"; // Import React and state hook

// ExistingCustomerPopup component accepts onClose and onSelect callbacks
export default function ExistingCustomerPopup({ onClose, onSelect }) {
  // search state tracks the search input text
  const [search, setSearch] = useState(""); // Search query state
  // sample customer list (replace with real data API later)
  const [customerList] = useState([
    { id: 1, firstName: "John", lastName: "Doe", address: "1 Street, Town, UK, AB1 2CD", email: "john@example.com", mobile: "07123456789", telephone: "0123456789" },
    { id: 2, firstName: "Jane", lastName: "Smith", address: "2 Avenue, City, UK, XY1 9YZ", email: "jane@example.com", mobile: "07234567890", telephone: "0987654321" },
  ]); // Initial sample list
  // selectedCustomer state stores currently highlighted customer
  const [selectedCustomer, setSelectedCustomer] = useState(null); // Selected customer

  // Filter customerList by search query (case-insensitive)
  const filteredList = search
    ? customerList.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()))
    : []; // Filter results

  // handleAdd sends selected customer to parent and closes popup
  const handleAdd = () => {
    if (selectedCustomer) { // Only proceed when a selection exists
      onSelect(selectedCustomer); // Send selection to parent
      onClose(); // Close the popup
    }
  }; // End handleAdd

  // Render popup content
  return (
    // Full screen overlay
    <div
      style={{
        position: "fixed", // overlay
        top: 0, // top 0
        left: 0, // left 0
        width: "100%", // full width
        height: "100%", // full height
        backgroundColor: "rgba(0,0,0,0.5)", // translucent bg
        display: "flex", // center content
        justifyContent: "center", // horizontal center
        alignItems: "center", // vertical center
        zIndex: 1000, // top layer
      }}
    >
      {/* Inner card */}
      <div
        style={{
          backgroundColor: "white", // popup bg
          padding: "24px", // padding
          borderRadius: "8px", // rounded corners
          width: "420px", // width
          maxHeight: "90vh", // height limit
          overflowY: "auto", // scroll
        }}
      >
        {/* Header */}
        <h3 style={{ marginTop: 0 }}>Select Existing Customer</h3> {/* Title */}
        {/* Search input */}
        <input
          type="text" // text input
          value={search} // bind to search state
          onChange={(e) => setSearch(e.target.value)} // update search
          placeholder="Search by name" // placeholder text
          style={{ width: "100%", marginBottom: "12px", padding: "6px" }} // style
        />
        {/* If filtered results exist, show list */}
        {filteredList.length > 0 && (
          <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "12px" }}>
            {/* Map results to clickable rows */}
            {filteredList.map(c => (
              <div
                key={c.id} // unique key
                onClick={() => setSelectedCustomer(c)} // select on click
                style={{
                  padding: "8px", // padding
                  cursor: "pointer", // pointer cursor
                  backgroundColor: selectedCustomer?.id === c.id ? "#f0f0f0" : "white" // highlight selected
                }}
              >
                {c.firstName} {c.lastName} {/* Display name */}
              </div>
            ))}
          </div>
        )}
        {/* Show details of selected customer */}
        {selectedCustomer && (
          <div style={{ marginBottom: "12px" }}>
            <p><strong>Name:</strong> {selectedCustomer.firstName} {selectedCustomer.lastName}</p> {/* Name */}
            <p><strong>Address:</strong> {selectedCustomer.address}</p> {/* Address */}
            <p><strong>Email:</strong> {selectedCustomer.email}</p> {/* Email */}
            <p><strong>Mobile:</strong> {selectedCustomer.mobile}</p> {/* Mobile */}
            <p><strong>Telephone:</strong> {selectedCustomer.telephone}</p> {/* Telephone */}
          </div>
        )}
        {/* Buttons row */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={onClose} style={{ padding: "8px 16px" }}>Close</button> {/* Close */}
          <button onClick={handleAdd} disabled={!selectedCustomer} style={{ padding: "8px 16px", backgroundColor: "#FF4040", color: "white" }}>
            Add Customer
          </button> {/* Add selected */}
        </div>
      </div>
    </div>
  ); // End return
} // End component
// file location: src/pages/job-cards/create/index.js
// Replace the handleFetchVehicleData function with this improved version

// ✅ FIXED: DVLA API Fetch with better error handling and debugging
const handleFetchVehicleData = async () => {
  // validate that registration number is entered
  if (!vehicle.reg.trim()) {
    setError("Please enter a registration number");
    showNotification("vehicle", "error", "✗ Please enter a registration number");
    return;
  }

  setIsLoadingVehicle(true); // show loading state
  setError(""); // clear any previous errors
  setVehicleNotification(null); // clear any previous notifications

  try {
    const regUpper = vehicle.reg.trim().toUpperCase(); // normalize registration to uppercase
    console.log("🚗 Fetching vehicle data from DVLA API for:", regUpper);

    // ✅ Fetch ONLY from DVLA API via our backend endpoint
    const response = await fetch("/api/vehicles/dvla", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ registration: regUpper }),
    });

    console.log("📡 DVLA API response status:", response.status);
    console.log("📡 Response headers:", Object.fromEntries(response.headers.entries()));

    // Get response text first for better error handling
    const responseText = await response.text();
    console.log("📡 Response body:", responseText);

    // if API request fails, throw error with details
    if (!response.ok) {
      let errorMessage = "Failed to fetch vehicle details from DVLA";
      
      try {
        // Try to parse error response as JSON
        const errorData = JSON.parse(responseText);
        console.error("❌ DVLA API error data:", errorData);
        
        // Use specific error message if available
        errorMessage = errorData.message || errorData.error || errorMessage;
        
        // Show suggestion if available
        if (errorData.suggestion) {
          errorMessage += `\n${errorData.suggestion}`;
        }
      } catch (parseError) {
        // If response isn't JSON, use the text as error message
        console.error("❌ Could not parse error response:", parseError);
        errorMessage = responseText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    // Parse successful response
    let data;
    try {
      data = JSON.parse(responseText);
      console.log("✅ DVLA API response data:", data);
    } catch (parseError) {
      console.error("❌ Could not parse DVLA response:", parseError);
      throw new Error("Invalid response from DVLA API");
    }

    // if no data returned or empty object, show error
    if (!data || Object.keys(data).length === 0) {
      throw new Error("No vehicle data found for that registration from DVLA");
    }

    // Check if this is mock data
    if (data._isMockData) {
      console.warn("⚠️ Using mock DVLA data (API key not configured)");
      showNotification("vehicle", "success", "⚠️ Using test data - Add DVLA_API_KEY for real data");
    }

    // ✅ Extract data from DVLA response and populate vehicle fields
    const vehicleData = {
      reg: regUpper,
      makeModel: data.make && data.model 
        ? `${data.make} ${data.model}`.trim() 
        : data.make || "Unknown",
      colour: data.colour || "Not provided",
      chassis: data.vin || "Not provided",
      engine: data.engineNumber || data.engineCapacity?.toString() || "Not provided",
      mileage: data.motTests && data.motTests.length > 0 
        ? data.motTests[0].odometerValue || "" 
        : vehicle.mileage || "",
    };

    console.log("✅ Setting vehicle data from DVLA:", vehicleData);
    
    // ✅ Update vehicle state with DVLA data
    setVehicle(vehicleData);
    
    // ✅ Update MOT date in maintenance if available from DVLA
    if (data.motExpiryDate) {
      setMaintenance(prev => ({
        ...prev,
        nextMotDate: data.motExpiryDate
      }));
    }

    if (!data._isMockData) {
      showNotification("vehicle", "success", "✓ Vehicle details fetched from DVLA!");
    }

    // ✅ After successful DVLA fetch, check if vehicle exists in our database
    const { data: existingVehicle, error: vehicleSearchError } = await supabase
      .from("vehicles")
      .select("*, customer_id")
      .or(`registration.eq.${regUpper},reg_number.eq.${regUpper}`)
      .maybeSingle();

    console.log("💾 Database vehicle check result:", existingVehicle, vehicleSearchError);

    // ✅ If vehicle exists in database AND has a linked customer, auto-fill customer details
    if (existingVehicle && existingVehicle.customer_id && !vehicleSearchError) {
      console.log("💾 Vehicle found in database with linked customer, fetching customer...");

      const { data: linkedCustomer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", existingVehicle.customer_id)
        .single();

      console.log("👤 Linked customer result:", linkedCustomer, customerError);

      // if linked customer found, populate customer state
      if (linkedCustomer && !customerError) {
        setCustomer({
          id: linkedCustomer.id,
          firstName: linkedCustomer.firstname || linkedCustomer.firstName,
          lastName: linkedCustomer.lastname || linkedCustomer.lastName,
          email: linkedCustomer.email,
          mobile: linkedCustomer.mobile,
          telephone: linkedCustomer.telephone,
          address: linkedCustomer.address,
          postcode: linkedCustomer.postcode,
        });
        console.log("✅ Customer auto-filled from database");
        showNotification("customer", "success", "✓ Customer details auto-filled from database!");
      }
    }

  } catch (err) {
    console.error("❌ Error fetching vehicle data:", err);
    console.error("❌ Error stack:", err.stack);
    
    // Set user-friendly error message
    const errorMessage = err.message || "Could not fetch vehicle details";
    setError(errorMessage);
    showNotification("vehicle", "error", `✗ ${errorMessage}`);

    // set vehicle with "Not provided" for all fields except reg
    setVehicle({
      reg: vehicle.reg.trim().toUpperCase(),
      makeModel: "Not provided",
      colour: "Not provided",
      chassis: "Not provided",
      engine: "Not provided",
      mileage: vehicle.mileage || "",
    });
  } finally {
    setIsLoadingVehicle(false); // always stop loading state
  }
};
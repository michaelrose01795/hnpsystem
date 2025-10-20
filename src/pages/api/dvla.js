// file location: src/pages/api/dvla.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { registration } = req.body;
  if (!registration) {
    return res.status(400).json({ error: "No registration provided" });
  }

  try {
    const dvlaRes = await fetch(
      "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
      {
        method: "POST",
        headers: {
          "x-api-key": process.env.DVLA_API_KEY, // server-side only
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registrationNumber: registration }),
      }
    );

    if (!dvlaRes.ok) {
      const text = await dvlaRes.text();
      return res.status(dvlaRes.status).json({ error: text });
    }

    const data = await dvlaRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

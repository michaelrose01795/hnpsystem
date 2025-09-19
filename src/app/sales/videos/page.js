"use client";
import VideoCreationForm from "@/components/Sales/VideoCreationForm";
import { useState } from "react";

export default function VideoPage() {
  const [cars] = useState([
    { id: 1, make: "Renault", model: "Clio 1.3L", year: 2023 },
    { id: 2, make: "Suzuki", model: "Swift 1.2L", year: 2021 },
    { id: 3, make: "Mitsubishi", model: "ASX 1.6L", year: 2020 },
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Video Creation</h1>
      <VideoCreationForm cars={cars} />
    </div>
  );
}
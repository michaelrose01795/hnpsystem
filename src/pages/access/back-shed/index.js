// file location: src/pages/access/back-shed/index.js
//
// /access/back-shed — the Back Shed quick screen. Every store page is this
// same file with a different store key (see src/config/stockAccessStores.js).
// Printed QR labels open /access/back-shed?item=<id>.
"use client";

import React from "react";
import { getStockAccessStore } from "@/config/stockAccessStores";
import { StockAccessStorePage, stockAccessLayout } from "@/features/stockAccess/StockAccessPages";

const STORE = getStockAccessStore("back-shed");

export default function BackShedPage() {
  return <StockAccessStorePage store={STORE} />;
}

BackShedPage.getLayout = stockAccessLayout;

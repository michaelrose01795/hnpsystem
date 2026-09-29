// file location: src/pages/access/back-shed/manage.js
//
// /access/back-shed/manage — the Back Shed stock table for Parts, managers and
// admin. Every store's manage page is this same file with a different store
// key (see src/config/stockAccessStores.js).
"use client";

import React from "react";
import { getStockAccessStore } from "@/config/stockAccessStores";
import { StockAccessManagePage, stockAccessLayout } from "@/features/stockAccess/StockAccessPages";

const STORE = getStockAccessStore("back-shed");

export default function BackShedManagePage() {
  return <StockAccessManagePage store={STORE} />;
}

BackShedManagePage.getLayout = stockAccessLayout;

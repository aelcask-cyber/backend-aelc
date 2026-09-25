import { useEffect, useState } from "react";
import api from "@/lib/api";

const DEFAULTS = {
  logo_data_url: "",
  alamat: "Jl. Teratai No 19, Rawa Laut, Enggal, Tanjung Karang Timur, Bandar Lampung",
  bank_name: "BCA",
  bank_account_number: "4300961717",
  bank_account_holder: "CV ARITA YASA NUSANTARA",
};

let cache = null;
const listeners = new Set();

async function fetchOnce() {
  if (cache !== null) return cache;
  try {
    const { data } = await api.get("/settings");
    cache = { ...DEFAULTS, ...data };
  } catch {
    cache = DEFAULTS;
  }
  listeners.forEach((fn) => fn(cache));
  return cache;
}

export function useCompany() {
  const [c, setC] = useState(cache || DEFAULTS);
  useEffect(() => {
    const l = (v) => setC(v);
    listeners.add(l);
    fetchOnce();
    return () => listeners.delete(l);
  }, []);
  return c;
}

export async function refreshCompany() {
  cache = null;
  return fetchOnce();
}

export async function setCompanyPatch(patch) {
  cache = { ...(cache || DEFAULTS), ...patch };
  listeners.forEach((fn) => fn(cache));
}

// Bank display metadata
export const BANK_OPTIONS = [
  { code: "BCA", name: "BCA", color: "#0060AF", bg: "#EAF3FB" },
  { code: "BRI", name: "BRI", color: "#00529C", bg: "#EAF1F9" },
  { code: "Mandiri", name: "Mandiri", color: "#003D79", bg: "#E8EEF6" },
  { code: "BNI", name: "BNI", color: "#F26F21", bg: "#FEF1E8" },
  { code: "BSI", name: "BSI", color: "#00693C", bg: "#E6F1EC" },
  { code: "CIMB", name: "CIMB Niaga", color: "#8A1538", bg: "#F5E7EC" },
  { code: "Permata", name: "Permata", color: "#0F5A4E", bg: "#E7F0EE" },
];

import { useEffect, useState } from "react";
import api from "@/lib/api";

let cache = null;
const listeners = new Set();

export function useLogo() {
  const [logo, setLogo] = useState(cache);
  useEffect(() => {
    const l = (v) => setLogo(v);
    listeners.add(l);
    if (cache === null) {
      api.get("/settings").then((r) => {
        cache = r.data.logo_data_url || "";
        listeners.forEach((fn) => fn(cache));
      }).catch(() => {});
    }
    return () => listeners.delete(l);
  }, []);
  return logo;
}

export async function setLogo(url) {
  cache = url;
  listeners.forEach((fn) => fn(url));
}

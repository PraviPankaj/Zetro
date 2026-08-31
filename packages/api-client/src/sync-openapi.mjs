const fs = await import("node:fs");
const url = process.env.ZETRO_API_URL || "http://127.0.0.1:8000/openapi.json";
const res = await fetch(url);
if (!res.ok) {
  console.error("Failed to fetch OpenAPI", res.status);
  process.exit(1);
}
const json = await res.json();
fs.writeFileSync(new URL("../openapi.json", import.meta.url), JSON.stringify(json, null, 2));
console.log("Wrote openapi.json with", Object.keys(json.paths || {}).length, "paths");

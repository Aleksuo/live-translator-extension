import fs from "node:fs";
const path = "./dist/chrome/background/service_worker.js";
/**
 * This is hopefully a temporal patch. Currently something causes a document usage to be generated in
 * the production build service worker file. However no obvious cause could be found easily and since it is
 * only one usage, this patch can fix it until a further cause is found.
 */
const patchBackgroundScript = () => {
  console.log(`Applying a patch for ${path}`);
  if (!fs.existsSync(path)) {
    console.error("Background script not found at:", path);
    process.exit(1);
  }

  let script = fs.readFileSync(path, "utf8");

  // Replace the problematic line
  script = script.replace(/document\.baseURI\s*\|\|\s*/g, "");

  fs.writeFileSync(path, script, "utf8");

  console.log(`✅ ${path} patched successfully.`);
};
patchBackgroundScript();

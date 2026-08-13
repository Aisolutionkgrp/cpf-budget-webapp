import fs from "fs";
import path from "path";

export function hasCompanyLogo() {
  return fs.existsSync(path.join(process.cwd(), "public", "logo.png"));
}

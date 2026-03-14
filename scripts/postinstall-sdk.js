const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
const pkgBak = path.join(root, "package.json.bak")
const lockBak = path.join(root, "package-lock.json.bak")

if (!fs.existsSync(pkgBak)) return

fs.renameSync(pkgBak, path.join(root, "package.json"))
if (fs.existsSync(lockBak)) fs.renameSync(lockBak, path.join(root, "package-lock.json"))

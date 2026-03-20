const fs = require("fs")
const path = require("path")

if (process.env.USE_LOCAL_SDK !== "1") return

const root = path.resolve(__dirname, "..")
const pkgPath = path.join(root, "package.json")
const lockPath = path.join(root, "package-lock.json")
const localSdkPath = "file:/Users/jamie/codeagentsdk"

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
if (pkg.dependencies["background-agents"] === localSdkPath) return

fs.copyFileSync(pkgPath, pkgPath + ".bak")
if (fs.existsSync(lockPath)) fs.copyFileSync(lockPath, lockPath + ".bak")

pkg.dependencies["background-agents"] = localSdkPath
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

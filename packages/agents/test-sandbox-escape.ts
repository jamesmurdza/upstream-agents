// Simulate the shell escaping
function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''").replace(/\$/g, "\\$")
}

// Simulate the command building
const command = "bash -lc 'opencode run --format json --variant medium -m \\'anthropic/claude-sonnet-4-6\\' \\'What is 2 + 2?\\' 2>&1'";

// Simulate what buildCommand returns
const buildCommandResult = {
  cmd: "bash",
  args: ["-lc", command],
  env: { OPENCODE_PERMISSION: '{"*":"allow"}' },
};

// Simulate what happens in executeBackground
const envPrefix = Object.entries(buildCommandResult.env)
  .map(([k, v]) => `${k}='${escapeShell(v)}'`)
  .join(" ");

const fullCmd = `${envPrefix} ${buildCommandResult.cmd} ${buildCommandResult.args.join(" ")}`;
console.log("Full command:");
console.log(fullCmd);
console.log();
console.log("Escaped:");
console.log(escapeShell(fullCmd));
console.log();
console.log("Wrapper:");
const wrapper = `nohup sh -c '${escapeShell(fullCmd)}' >> /tmp/out.jsonl 2>&1; echo 1 > /tmp/out.jsonl.done`;
console.log(wrapper);

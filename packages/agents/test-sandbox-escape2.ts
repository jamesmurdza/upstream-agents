// Simulate the exact escaping as used in the code

function escapeShell(str: string): string {
  // From the actual code:
  return str.replace(/'/g, "'\\''").replace(/\$/g, "\\$")
}

function buildEnvPrefix(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => `${k}='${escapeShell(v)}'`)
    .join(" ")
}

function quoteArg(arg: string): string {
  if (arg.includes(" ") || arg.includes('"') || arg.includes("'")) {
    return `'${arg.replace(/'/g, "'\\''")}'`
  }
  return arg
}

function buildFullCommand(spec: { cmd: string; args: string[] }): string {
  const quotedArgs = spec.args.map((arg) => quoteArg(arg))
  return [spec.cmd, ...quotedArgs].join(" ")
}

// Simulate what opencode agent's buildCommand returns
const commandSpec = {
  cmd: "bash",
  args: ["-lc", "opencode run --format json --variant medium -m 'anthropic/claude-sonnet-4-6' 'What is 2 + 2?' 2>&1"],
  env: { OPENCODE_PERMISSION: '{"*":"allow"}' }
};

const envPrefix = buildEnvPrefix(commandSpec.env);
console.log("Env prefix:", envPrefix);

const fullCommand = buildFullCommand(commandSpec);
console.log("Full command:", fullCommand);

const cmd = `${envPrefix} ${fullCommand}`;
console.log("With env:", cmd);

const safeCmd = escapeShell(cmd);
console.log("Safe cmd:", safeCmd);

const outputFile = "/tmp/test.jsonl";
const safeOutput = escapeShell(outputFile);
const safeDone = escapeShell(outputFile + ".done");

const wrapper = `nohup sh -c '${safeCmd} >> ${safeOutput} 2>&1; echo 1 > ${safeDone}' > /dev/null 2>&1 & echo $!`;
console.log("Wrapper:", wrapper);

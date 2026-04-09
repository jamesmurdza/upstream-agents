"use client"

import { ArrowLeft, Copy, Check } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

function CodeBlock({ children, language = "bash" }: { children: string; language?: string }) {
  return (
    <div className="relative group">
      <pre className="bg-muted/50 rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code>{children}</code>
      </pre>
      <CopyButton text={children} />
    </div>
  )
}

function Endpoint({
  method,
  path,
  description,
  requestBody,
  response,
}: {
  method: "GET" | "POST" | "DELETE"
  path: string
  description: string
  requestBody?: string
  response: string
}) {
  const methodColors = {
    GET: "bg-green-500/20 text-green-600 dark:text-green-400",
    POST: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    DELETE: "bg-red-500/20 text-red-600 dark:text-red-400",
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 bg-muted/30">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono">{path}</code>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-muted-foreground">{description}</p>

        {requestBody && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Request Body</h4>
            <CodeBlock language="json">{requestBody}</CodeBlock>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-2">Response</h4>
          <CodeBlock language="json">{response}</CodeBlock>
        </div>
      </div>
    </div>
  )
}

export default function SDKPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Link>
          <h1 className="text-3xl font-bold">REST API Reference</h1>
          <p className="text-muted-foreground mt-2">
            Use this API to programmatically create sandboxes, run agents, and push changes.
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
          <CodeBlock>{`# 1. Create a sandbox with your repo
curl -X POST http://localhost:3000/api/sandbox/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "repo": "owner/repo",
    "baseBranch": "main",
    "newBranch": "ai/feature",
    "githubToken": "ghp_xxxx",
    "anthropicApiKey": "sk-ant-xxxx"
  }'

# 2. Execute an agent
curl -X POST http://localhost:3000/api/agent/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "sandboxId": "SANDBOX_ID",
    "repoName": "repo",
    "prompt": "Add a README.md file",
    "agent": "opencode"
  }'

# 3. Poll for status
curl "http://localhost:3000/api/agent/status?sandboxId=SANDBOX_ID&repoName=repo"

# 4. Push changes when done
curl -X POST http://localhost:3000/api/git/push \\
  -H "Content-Type: application/json" \\
  -d '{
    "sandboxId": "SANDBOX_ID",
    "repoName": "repo",
    "branch": "ai/feature",
    "githubToken": "ghp_xxxx"
  }'

# 5. Clean up
curl -X POST http://localhost:3000/api/sandbox/delete \\
  -H "Content-Type: application/json" \\
  -d '{"sandboxId": "SANDBOX_ID"}'`}</CodeBlock>
        </section>

        {/* Endpoints */}
        <section className="space-y-8">
          <h2 className="text-xl font-semibold">Endpoints</h2>

          {/* Create Sandbox */}
          <Endpoint
            method="POST"
            path="/api/sandbox/create"
            description="Create a new sandbox, clone a GitHub repository, and checkout a new branch."
            requestBody={`{
  "repo": "owner/repo",       // GitHub repo (owner/name) or "__new__" for empty project
  "baseBranch": "main",       // Branch to clone from
  "newBranch": "ai/feature",  // New branch name to create
  "githubToken": "ghp_xxxx",  // GitHub token (required for private repos)
  "anthropicApiKey": "sk-ant-xxxx",  // Optional: Anthropic API key
  "openaiApiKey": "sk-xxxx"          // Optional: OpenAI API key
}`}
            response={`{
  "sandboxId": "sandbox_abc123",
  "repoName": "repo",
  "branch": "ai/feature",
  "previewUrlPattern": "https://{port}-xxx.daytonaproxy.net"
}`}
          />

          {/* Execute Agent */}
          <Endpoint
            method="POST"
            path="/api/agent/execute"
            description="Start an agent to execute a task in the sandbox."
            requestBody={`{
  "sandboxId": "sandbox_abc123",  // Sandbox ID from create
  "repoName": "repo",             // Repository name
  "prompt": "Add a README.md",    // Task description
  "previewUrlPattern": "...",     // Optional: from create response
  "agent": "opencode",            // Optional: opencode, claude-code, codex, gemini, goose, pi
  "model": "anthropic/claude-sonnet-4-20250514",  // Optional: model override
  "anthropicApiKey": "sk-ant-xxxx",  // Optional: override sandbox env
  "openaiApiKey": "sk-xxxx"          // Optional: override sandbox env
}`}
            response={`{
  "backgroundSessionId": "ses_xyz789",
  "status": "running"
}`}
          />

          {/* Poll Status */}
          <Endpoint
            method="GET"
            path="/api/agent/status"
            description="Poll for agent execution status and output. Query params: sandboxId, repoName, previewUrlPattern (optional)."
            response={`{
  "status": "running" | "completed" | "error",
  "content": "I'll create a README file...",
  "toolCalls": [
    { "tool": "Write", "summary": "README.md", "output": "..." }
  ],
  "contentBlocks": [
    { "type": "text", "text": "..." },
    { "type": "tool_calls", "toolCalls": [...] }
  ],
  "error": null,
  "sessionId": "ses_xyz789"
}`}
          />

          {/* Push */}
          <Endpoint
            method="POST"
            path="/api/git/push"
            description="Push committed changes to the remote GitHub repository."
            requestBody={`{
  "sandboxId": "sandbox_abc123",
  "repoName": "repo",
  "branch": "ai/feature",
  "githubToken": "ghp_xxxx"  // Required
}`}
            response={`{
  "success": true
}`}
          />

          {/* Delete Sandbox */}
          <Endpoint
            method="POST"
            path="/api/sandbox/delete"
            description="Delete a sandbox and clean up resources."
            requestBody={`{
  "sandboxId": "sandbox_abc123"
}`}
            response={`{
  "success": true
}`}
          />
        </section>

        {/* Agents */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Supported Agents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">Agent</th>
                  <th className="text-left py-3 px-4">API Key Required</th>
                  <th className="text-left py-3 px-4">Example Models</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-3 px-4 font-mono">opencode</td>
                  <td className="py-3 px-4">Optional (has free models)</td>
                  <td className="py-3 px-4 font-mono text-xs">anthropic/claude-sonnet-4-20250514, openai/gpt-4.1</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono">claude-code</td>
                  <td className="py-3 px-4">ANTHROPIC_API_KEY</td>
                  <td className="py-3 px-4 font-mono text-xs">claude-sonnet-4-20250514, claude-opus-4-20250514</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono">codex</td>
                  <td className="py-3 px-4">OPENAI_API_KEY</td>
                  <td className="py-3 px-4 font-mono text-xs">o3, gpt-4.1</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono">gemini</td>
                  <td className="py-3 px-4">GEMINI_API_KEY</td>
                  <td className="py-3 px-4 font-mono text-xs">gemini-2.5-pro</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono">goose</td>
                  <td className="py-3 px-4">ANTHROPIC_API_KEY or OPENAI_API_KEY</td>
                  <td className="py-3 px-4 font-mono text-xs">claude-sonnet-4-20250514, gpt-4.1</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono">pi</td>
                  <td className="py-3 px-4">ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY</td>
                  <td className="py-3 px-4 font-mono text-xs">sonnet, openai/gpt-4.1, google/gemini-2.5-pro</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Environment Variables */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Server Environment Variables</h2>
          <p className="text-muted-foreground mb-4">
            The server requires the following environment variable:
          </p>
          <CodeBlock>{`DAYTONA_API_KEY=your_daytona_api_key`}</CodeBlock>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border text-center text-muted-foreground text-sm">
          <p>Background Agents - Simple Chat API</p>
        </footer>
      </div>
    </div>
  )
}

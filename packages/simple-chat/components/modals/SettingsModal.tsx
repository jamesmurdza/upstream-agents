"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useTheme } from "next-themes"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Eye, EyeOff, Key, Sun, Moon, Monitor, Bot, ChevronDown } from "lucide-react"
import type { Settings, Theme, Agent, ModelOption } from "@/lib/types"
import { agentModels, agentLabels, hasCredentialsForModel } from "@/lib/types"
import { getCredentialFlags } from "@/lib/storage"

/** Which API key field to highlight */
export type HighlightKey = "anthropic" | "openai" | "opencode" | "gemini" | null

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  settings: Settings
  onSave: (settings: Settings) => void
  /** Which API key field to highlight with a red outline */
  highlightKey?: HighlightKey
}

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Auto", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
]

const agents: Agent[] = ["claude-code", "opencode", "codex", "gemini", "goose", "pi"]

// API key field component
function ApiKeyField({
  label,
  description,
  value,
  onChange,
  placeholder,
  helpUrl,
  helpText,
  highlight,
  inputRef,
}: {
  label: string
  description: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  helpUrl?: string
  helpText?: string
  highlight?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div>
      <label className={`flex items-center gap-2 text-sm font-medium mb-1 ${highlight ? "text-red-500" : ""}`}>
        <Key className="h-3.5 w-3.5" />
        {label}
        {highlight && <span className="text-xs font-normal">(required)</span>}
      </label>
      <p className="text-xs text-muted-foreground mb-2">
        {description}
        {helpUrl && helpText && (
          <>
            {" "}
            <a
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {helpText}
            </a>
          </>
        )}
      </p>
      <div className="relative">
        <input
          ref={inputRef}
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-1.5 pr-10 text-sm bg-input border rounded-md focus:outline-none focus:ring-2 font-mono ${
            highlight
              ? "border-red-500 focus:ring-red-500/50"
              : "border-border focus:ring-ring"
          }`}
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

export function SettingsModal({ open, onClose, settings, onSave, highlightKey }: SettingsModalProps) {
  const { setTheme } = useTheme()

  // Refs for API key inputs
  const anthropicInputRef = useRef<HTMLInputElement>(null)
  const openaiInputRef = useRef<HTMLInputElement>(null)
  const opencodeInputRef = useRef<HTMLInputElement>(null)
  const geminiInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [anthropicApiKey, setAnthropicApiKey] = useState(settings.anthropicApiKey)
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey)
  const [opencodeApiKey, setOpencodeApiKey] = useState(settings.opencodeApiKey)
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey)
  const [defaultAgent, setDefaultAgent] = useState<Agent>(settings.defaultAgent as Agent)
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel)
  const [selectedTheme, setSelectedTheme] = useState<Theme>(settings.theme)

  // Get current credentials based on form values
  const currentCredentials = useMemo(() => {
    return getCredentialFlags({
      ...settings,
      anthropicApiKey,
      openaiApiKey,
      opencodeApiKey,
      geminiApiKey,
    })
  }, [anthropicApiKey, openaiApiKey, opencodeApiKey, geminiApiKey, settings])

  // Get available models for the selected agent
  const availableModels = useMemo(() => {
    return agentModels[defaultAgent] ?? []
  }, [defaultAgent])

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setAnthropicApiKey(settings.anthropicApiKey)
      setOpenaiApiKey(settings.openaiApiKey)
      setOpencodeApiKey(settings.opencodeApiKey)
      setGeminiApiKey(settings.geminiApiKey)
      setDefaultAgent(settings.defaultAgent as Agent)
      setDefaultModel(settings.defaultModel)
      setSelectedTheme(settings.theme)
    }
  }, [open, settings])

  // Focus the highlighted API key field when modal opens
  useEffect(() => {
    if (open && highlightKey) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        const refMap = {
          anthropic: anthropicInputRef,
          openai: openaiInputRef,
          opencode: opencodeInputRef,
          gemini: geminiInputRef,
        }
        const ref = refMap[highlightKey]
        if (ref?.current) {
          ref.current.scrollIntoView({ behavior: "smooth", block: "center" })
          ref.current.focus()
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open, highlightKey])

  // Update model when agent changes
  useEffect(() => {
    const models = agentModels[defaultAgent] ?? []
    // If current model isn't valid for the new agent, select the first available
    const isValidModel = models.some(m => m.value === defaultModel)
    if (!isValidModel && models.length > 0) {
      setDefaultModel(models[0].value)
    }
  }, [defaultAgent, defaultModel])

  // Apply theme immediately when changed
  const handleThemeChange = (theme: Theme) => {
    setSelectedTheme(theme)
    setTheme(theme)
  }

  const handleSave = () => {
    onSave({
      anthropicApiKey,
      openaiApiKey,
      opencodeApiKey,
      geminiApiKey,
      defaultAgent,
      defaultModel,
      theme: selectedTheme,
    })
    onClose()
  }

  const hasChanges =
    anthropicApiKey !== settings.anthropicApiKey ||
    openaiApiKey !== settings.openaiApiKey ||
    opencodeApiKey !== settings.opencodeApiKey ||
    geminiApiKey !== settings.geminiApiKey ||
    defaultAgent !== settings.defaultAgent ||
    defaultModel !== settings.defaultModel ||
    selectedTheme !== settings.theme

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-y-auto bg-popover border border-border rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-popover">
            <Dialog.Title className="text-sm font-semibold">Settings</Dialog.Title>
            <Dialog.Close className="p-1 rounded hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6">
            {/* Default Agent & Model */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4" />
                Default Agent
              </h3>

              {/* Agent Selection */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Agent</label>
                <div className="relative">
                  <select
                    value={defaultAgent}
                    onChange={(e) => setDefaultAgent(e.target.value as Agent)}
                    className="w-full px-3 py-1.5 text-sm bg-input border border-border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {agents.map((agent) => (
                      <option key={agent} value={agent}>
                        {agentLabels[agent]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Model</label>
                <div className="relative">
                  <select
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-input border border-border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {availableModels.map((model: ModelOption) => {
                      const hasCredentials = hasCredentialsForModel(model, currentCredentials, defaultAgent)
                      return (
                        <option key={model.value} value={model.value}>
                          {model.label}
                          {!hasCredentials && model.requiresKey !== "none" ? " (needs API key)" : ""}
                        </option>
                      )
                    })}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* API Keys */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Key className="h-4 w-4" />
                API Keys
              </h3>
              <p className="text-xs text-muted-foreground">
                Add API keys to unlock more models. All keys are stored locally in your browser.
              </p>

              <ApiKeyField
                label="Anthropic"
                description="For Claude Code and Claude models."
                value={anthropicApiKey}
                onChange={setAnthropicApiKey}
                placeholder="sk-ant-..."
                helpUrl="https://console.anthropic.com/"
                helpText="Get key"
                highlight={highlightKey === "anthropic"}
                inputRef={anthropicInputRef}
              />

              <ApiKeyField
                label="OpenAI"
                description="For Codex, GPT models, and Goose."
                value={openaiApiKey}
                onChange={setOpenaiApiKey}
                placeholder="sk-..."
                helpUrl="https://platform.openai.com/api-keys"
                helpText="Get key"
                highlight={highlightKey === "openai"}
                inputRef={openaiInputRef}
              />

              <ApiKeyField
                label="OpenCode"
                description="For paid OpenCode models."
                value={opencodeApiKey}
                onChange={setOpencodeApiKey}
                placeholder="..."
                highlight={highlightKey === "opencode"}
                inputRef={opencodeInputRef}
                helpUrl="https://opencode.ai/auth"
                helpText="Get key"
              />

              <ApiKeyField
                label="Google AI (Gemini)"
                description="For Gemini models."
                value={geminiApiKey}
                onChange={setGeminiApiKey}
                placeholder="..."
                helpUrl="https://aistudio.google.com/apikey"
                helpText="Get key"
                highlight={highlightKey === "gemini"}
                inputRef={geminiInputRef}
              />
            </div>

            {/* Theme Selector */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Sun className="h-4 w-4" />
                Theme
              </h3>
              <div className="flex gap-2">
                {themeOptions.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => handleThemeChange(value)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors ${
                      selectedTheme === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex justify-end gap-2 px-4 py-3 border-t border-border bg-popover">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

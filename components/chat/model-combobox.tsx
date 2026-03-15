"use client"

import * as React from "react"
import { Check, ChevronDown, Sparkles, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import type { ModelOption } from "@/lib/types"

interface ModelComboboxProps {
  models: ModelOption[]
  currentModel: string
  currentModelLabel: string
  onModelChange?: (model: string) => void
  onOpenSettings?: () => void
}

export function ModelCombobox({
  models,
  currentModel,
  currentModelLabel,
  onModelChange,
  onOpenSettings,
}: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // Group models by requirement
  const freeModels = models.filter((m) => m.requiresKey === "none")
  const anthropicModels = models.filter((m) => m.requiresKey === "anthropic")
  const openaiModels = models.filter((m) => m.requiresKey === "openai")

  const handleSelect = (modelValue: string) => {
    onModelChange?.(modelValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="group flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground data-[state=open]:text-foreground cursor-pointer">
        <Sparkles className="h-2.5 w-2.5 shrink-0" />
        <span>{currentModelLabel}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="w-[220px] p-0 rounded-lg border border-border/60 shadow-md"
      >
        <Command>
          <CommandInput
            placeholder="Search models..."
            className="h-8 text-[11px]"
          />
          <CommandList className="max-h-[250px]">
            <CommandEmpty className="py-3 text-[11px] text-muted-foreground">
              No models found.
            </CommandEmpty>

            {models.length === 0 ? (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onOpenSettings?.()
                    setOpen(false)
                  }}
                  className="py-1.5 text-[11px] cursor-pointer text-muted-foreground"
                >
                  <Settings className="h-3 w-3 mr-2" />
                  Configure API keys in Settings
                </CommandItem>
              </CommandGroup>
            ) : (
              <>
                {freeModels.length > 0 && (
                  <CommandGroup heading="Free">
                    {freeModels.map((model) => (
                      <CommandItem
                        key={model.value}
                        value={model.label}
                        onSelect={() => handleSelect(model.value)}
                        className="flex items-center justify-between py-1.5 text-[11px] cursor-pointer"
                      >
                        <span>{model.label}</span>
                        {model.value === currentModel && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {anthropicModels.length > 0 && (
                  <>
                    {freeModels.length > 0 && <CommandSeparator />}
                    <CommandGroup heading="Anthropic">
                      {anthropicModels.map((model) => (
                        <CommandItem
                          key={model.value}
                          value={model.label}
                          onSelect={() => handleSelect(model.value)}
                          className="flex items-center justify-between py-1.5 text-[11px] cursor-pointer"
                        >
                          <span>{model.label}</span>
                          {model.value === currentModel && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}

                {openaiModels.length > 0 && (
                  <>
                    {(freeModels.length > 0 || anthropicModels.length > 0) && (
                      <CommandSeparator />
                    )}
                    <CommandGroup heading="OpenAI">
                      {openaiModels.map((model) => (
                        <CommandItem
                          key={model.value}
                          value={model.label}
                          onSelect={() => handleSelect(model.value)}
                          className="flex items-center justify-between py-1.5 text-[11px] cursor-pointer"
                        >
                          <span>{model.label}</span>
                          {model.value === currentModel && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

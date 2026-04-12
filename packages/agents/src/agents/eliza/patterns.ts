/**
 * ELIZA pattern matching - Classic therapist bot patterns
 *
 * All responses are deterministic based on input hash, not random.
 */

export interface FileAction {
  type: "write" | "read" | "delete"
  fileNameTemplate: string
  contentTemplate?: string
}

export interface ElizaPattern {
  pattern: RegExp
  responses: string[]
  fileAction?: FileAction
}

/**
 * Classic ELIZA patterns with therapeutic file operations
 */
export const ELIZA_PATTERNS: ElizaPattern[] = [
  // Greeting patterns
  {
    pattern: /^(hello|hi|hey|greetings|good morning|good afternoon|good evening)[\s!.,?]*$/i,
    responses: [
      "Hello. How are you feeling today?",
      "Hi there. What brings you to therapy?",
      "Greetings. Tell me what's on your mind.",
      "Hello. Please tell me what's troubling you.",
    ],
  },

  // "I am" patterns
  {
    pattern: /i am (.*)/i,
    responses: [
      "Why do you say you are {0}?",
      "How long have you been {0}?",
      "Do you believe it is normal to be {0}?",
      "Do you enjoy being {0}?",
    ],
  },

  // "I feel" patterns - triggers file writing
  {
    pattern: /i feel (.*)/i,
    responses: [
      "Tell me more about feeling {0}.",
      "Do you often feel {0}?",
      "What makes you feel {0}?",
      "When did you first notice feeling {0}?",
    ],
    fileAction: {
      type: "write",
      fileNameTemplate: "eliza_feeling_journal.txt",
      contentTemplate:
        "Session Note\n============\nPatient reported feeling: {0}\nDate: {date}\n\nThis feeling deserves further exploration in future sessions.\n\n",
    },
  },

  // Family patterns
  {
    pattern: /my (mother|father|mom|dad|family|parents|sister|brother) (.*)/i,
    responses: [
      "Tell me more about your {0}.",
      "How does that make you feel about your {0}?",
      "What else comes to mind when you think of your {0}?",
      "How is your relationship with your {0}?",
    ],
  },

  // Want/need patterns
  {
    pattern: /i (want|need) (.*)/i,
    responses: [
      "Why do you {0} {1}?",
      "What would it mean if you got {1}?",
      "Suppose you got {1} - what then?",
      "What is stopping you from getting {1}?",
    ],
  },

  // Can't patterns
  {
    pattern: /i can'?t (.*)/i,
    responses: [
      "What makes you think you can't {0}?",
      "Have you tried to {0}?",
      "Perhaps you could {0} if you tried.",
      "What would happen if you could {0}?",
    ],
  },

  // Because patterns
  {
    pattern: /because (.*)/i,
    responses: [
      "Is that the real reason?",
      "What other reasons might there be?",
      "Does that reason seem to explain anything else?",
      "Are you sure that's why?",
    ],
  },

  // Sorry patterns
  {
    pattern: /sorry/i,
    responses: [
      "There's no need to apologize.",
      "Apologies aren't necessary here.",
      "What feelings does apologizing bring up?",
      "Why do you feel the need to apologize?",
    ],
  },

  // Yes patterns
  {
    pattern: /^yes[\s!.,?]*$/i,
    responses: [
      "You seem quite sure.",
      "Tell me more about that.",
      "I see. Please continue.",
      "And how does that make you feel?",
    ],
  },

  // No patterns
  {
    pattern: /^no[\s!.,?]*$/i,
    responses: [
      "Why not?",
      "Are you sure about that?",
      "You seem quite certain.",
      "Can you tell me more about why not?",
    ],
  },

  // Dream patterns
  {
    pattern: /dream(s|ed|ing)? (about |of )?(.*)/i,
    responses: [
      "What do you think that dream means?",
      "Dreams can be very revealing. Tell me more.",
      "Do you often dream about {2}?",
      "How did that dream make you feel?",
    ],
  },

  // Think patterns
  {
    pattern: /i think (.*)/i,
    responses: [
      "Why do you think {0}?",
      "Do you really think so?",
      "But you're not sure {0}?",
      "What makes you think {0}?",
    ],
  },

  // Remember patterns
  {
    pattern: /i remember (.*)/i,
    responses: [
      "Why do you remember {0} now?",
      "What else do you remember?",
      "How does remembering {0} make you feel?",
      "Is that a significant memory for you?",
    ],
  },

  // File creation trigger
  {
    pattern: /(?:create|make|write) (?:a )?(?:file|note) (?:called |named )?["']?([^"']+)["']?/i,
    responses: ["I'll create that file for you as a therapeutic exercise."],
    fileAction: {
      type: "write",
      fileNameTemplate: "{0}",
      contentTemplate:
        "Therapeutic Note\n================\nCreated during ELIZA therapy session.\nDate: {date}\n\nUse this space to write your thoughts.\n",
    },
  },

  // File deletion trigger
  {
    pattern: /(?:delete|remove) (?:the )?(?:file )?["']?([^"']+)["']?/i,
    responses: [
      "Sometimes letting go is therapeutic. I'll help you delete that.",
    ],
    fileAction: {
      type: "delete",
      fileNameTemplate: "{0}",
    },
  },

  // File reading trigger
  {
    pattern: /(?:read|show|open) (?:the )?(?:file )?["']?([^"']+)["']?/i,
    responses: ["Let me read that file for you."],
    fileAction: {
      type: "read",
      fileNameTemplate: "{0}",
    },
  },

  // Question patterns
  {
    pattern: /\?$/,
    responses: [
      "Why do you ask?",
      "What do you think?",
      "Does that question relate to your feelings?",
      "What answer would make you feel better?",
    ],
  },

  // Default fallback - must be last
  {
    pattern: /.*/,
    responses: [
      "Please tell me more.",
      "Can you elaborate on that?",
      "That's interesting. Please continue.",
      "I see. And how does that make you feel?",
      "Hmm. Let's explore that further.",
      "Go on.",
      "What does that suggest to you?",
      "I understand. Please continue.",
    ],
  },
]

/**
 * Deterministic hash function for reproducible response selection.
 * Uses a simple djb2-like hash.
 */
export function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Substitute template placeholders with matched groups and date.
 */
export function substituteTemplate(
  template: string | undefined,
  match: RegExpMatchArray
): string {
  if (!template) return ""

  let result = template

  // Replace capture group placeholders {0}, {1}, etc.
  for (let i = 1; i < match.length; i++) {
    result = result.replace(new RegExp(`\\{${i - 1}\\}`, "g"), match[i] || "")
  }

  // Replace {date} placeholder
  result = result.replace(/\{date\}/g, new Date().toISOString())

  return result
}

export interface MatchResult {
  response: string
  fileAction?: {
    type: "write" | "read" | "delete"
    fileName: string
    content?: string
  }
}

/**
 * Match input against ELIZA patterns and return deterministic response.
 */
export function matchPattern(input: string): MatchResult {
  const normalized = input.trim()

  for (const pattern of ELIZA_PATTERNS) {
    const match = normalized.match(pattern.pattern)
    if (match) {
      // Select response deterministically based on input hash
      const responseIndex = hashString(normalized) % pattern.responses.length
      let response = pattern.responses[responseIndex]

      // Replace capture groups in response
      for (let i = 1; i < match.length; i++) {
        response = response.replace(new RegExp(`\\{${i - 1}\\}`, "g"), match[i] || "")
      }

      // Prepare file action if any
      let fileAction: MatchResult["fileAction"]
      if (pattern.fileAction) {
        const fileName = substituteTemplate(
          pattern.fileAction.fileNameTemplate,
          match
        ).trim()
        const content = substituteTemplate(
          pattern.fileAction.contentTemplate,
          match
        )

        fileAction = {
          type: pattern.fileAction.type,
          fileName,
          content: content || undefined,
        }
      }

      return { response, fileAction }
    }
  }

  // Should never reach here due to fallback pattern, but just in case
  return { response: "Please tell me more." }
}

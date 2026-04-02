/**
 * Custom Playwright reporter that logs step timing to console and saves safe results to JSON.
 * Does NOT include environment variables or sensitive data.
 */
import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
  FullResult,
} from "@playwright/test/reporter"
import * as fs from "fs"
import * as path from "path"

interface SafeTestResult {
  title: string
  file: string
  status: "passed" | "failed" | "timedOut" | "skipped"
  duration: number
  steps: Array<{
    title: string
    duration: number
    status: "passed" | "failed"
  }>
  error?: string
}

interface SafeReport {
  timestamp: string
  duration: number
  status: string
  passed: number
  failed: number
  skipped: number
  tests: SafeTestResult[]
}

class StepTimingReporter implements Reporter {
  private results: SafeTestResult[] = []
  private currentSteps: SafeTestResult["steps"] = []

  onTestBegin(test: TestCase) {
    this.currentSteps = []
    console.log(`\n▶ ${test.title}`)
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    // Only log test.step() calls, not internal Playwright steps
    if (step.category === "test.step") {
      const duration = step.duration
      const status = step.error ? "✗" : "✓"
      console.log(`  ${status} [${duration}ms] ${step.title}`)
      this.currentSteps.push({
        title: step.title,
        duration: step.duration,
        status: step.error ? "failed" : "passed",
      })
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const status = result.status === "passed" ? "✓" : "✗"
    const duration = result.duration
    console.log(`${status} ${test.title} (${(duration / 1000).toFixed(1)}s)`)

    this.results.push({
      title: test.title,
      file: test.location.file.replace(/.*\/e2e\//, "e2e/"),
      status: result.status,
      duration: result.duration,
      steps: [...this.currentSteps],
      error: result.error?.message?.slice(0, 200), // Truncate error messages
    })
  }

  onEnd(result: FullResult) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Total: ${result.status} in ${(result.duration / 1000).toFixed(1)}s`)

    const passed = this.results.filter((r) => r.status === "passed").length
    const failed = this.results.filter((r) => r.status === "failed").length
    const skipped = this.results.filter((r) => r.status === "skipped").length

    const report: SafeReport = {
      timestamp: new Date().toISOString(),
      duration: result.duration,
      status: result.status,
      passed,
      failed,
      skipped,
      tests: this.results,
    }

    // Save to results directory
    const resultsDir = path.join(__dirname, "../results")
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true })
    }
    fs.writeFileSync(
      path.join(resultsDir, "results.json"),
      JSON.stringify(report, null, 2)
    )
  }
}

export default StepTimingReporter

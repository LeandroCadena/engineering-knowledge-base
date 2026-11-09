---
title: SonarQube / Code Coverage
description: Static analysis, coverage evidence, new-code baselines, quality profiles and gates, report import, exclusions, and diagnostic limits.
icon: sonarqube-coverage.svg
updatedAt: 2026-11-09
---

# SonarQube / Code Coverage

SonarQube analyzes source code and combines findings with imported evidence such as coverage reports. Its rules can identify suspicious control flow, maintainability problems and security-related patterns without executing the application. Coverage answers a different question: which instrumented code locations a test run executed. Neither result proves that a business rule is correct.

A backend quality pipeline needs three independent forms of evidence: behavior assertions, coverage of relevant paths and static-analysis findings. A green gate means the configured conditions passed for the analyzed revision and scope. It does not mean every dependency, deployment setting or production interaction is safe.

## Analysis, Profiles & Gates

A scanner collects project files, applies the configured analysis and submits results to a SonarQube instance. The server processes that analysis and calculates findings and measures. Uploading a report successfully is not the same as receiving a successful quality-gate result; server-side processing can finish later.

A quality profile chooses the rules applied to a language. A quality gate evaluates conditions against the resulting measures, such as coverage, duplication or issue severity. Changing a profile changes what is detected; changing a gate changes what blocks acceptance. They are separate policy decisions.

| Evidence       | What it can establish                                               | What remains outside it                              |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Test assertion | Observed behavior matches a stated expectation for exercised inputs | Unasserted behavior and untested environments        |
| Coverage       | Instrumented locations were executed under the reported scope       | Assertion strength and requirement completeness      |
| Static finding | An analyzer detected a pattern under its model and rules            | Whether every exploit or runtime failure is possible |
| Quality gate   | Configured conditions passed for that analysis                      | Universal correctness or release readiness           |

Product editions, server versions and configured analysis modes affect supported branch, PR and security features. Check the documentation for the installed product rather than copying a configuration from a different edition. A pull-request decoration is useful only when the analysis corresponds to the current revision and the intended target baseline.

## Lines, Branches & Assertions

Line coverage counts executable lines reached by tests. Function coverage counts entered functions. Branch coverage records alternatives in control flow, such as outcomes of a conditional. Statement coverage counts instrumented statements. Different instrumentation engines can produce different locations and branch counts, so compare measurements with the same toolchain and scope.

Consider a shipping function: expedited shipping costs 1500 cents; standard shipping costs 500 cents below a 5000-cent order and becomes free at or above that threshold. A test can execute every line while asserting only that the result is a number. Such a test would not detect returning the wrong price.

The runnable example tests the threshold from both sides and the precedence of expedited shipping. It also rejects fractional and negative totals. Those assertions describe the rule; the coverage report confirms execution of the instrumented paths. The rule itself still needs agreement: if the business intends free expedited shipping above the threshold, perfectly executed tests can enforce the wrong policy.

![Tests produce both behavioral evidence and an LCOV report; SonarQube imports coverage separately from source analysis.](/docs/sonarqube-coverage/v1/evidence.svg)

Boundary tests matter more than several equivalent happy paths. For a monetary threshold, test immediately below and exactly at the boundary. For authorization, test a valid actor accessing another tenant's object. For retry logic, test the state after the first attempt committed but its response was lost. Coverage can reveal a missing path, but it cannot select the important cases for you.

A mutation test deliberately changes program behavior, for example replacing `>=` with `>`, and checks whether tests fail. A surviving mutation can indicate a weak assertion or an equivalent change; it requires interpretation. Mutation testing complements coverage and normally costs more runtime. The example uses ordinary assertions and LCOV; it does not run a mutation-testing tool.

:::check{question="A suite reports full line coverage, but every assertion only checks that a value exists. What does full coverage prove?"}
It proves that the counted executable lines ran under that instrumentation and scope. It does not prove correct values, authorization decisions, boundary behavior or side effects. Strengthen assertions around actual requirements instead of treating the percentage as behavioral evidence.
:::

## Producing & Importing LCOV

For JavaScript and TypeScript, SonarQube can import LCOV produced by a test/coverage tool. SonarQube does not run your tests to generate that report. Run the tests first, preserve the report, then execute the scanner from a project base directory where its source paths resolve.

```properties
sonar.projectKey=kb-shipping-example
sonar.sources=src
sonar.tests=test
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.sourceEncoding=UTF-8
```

These properties configure source and report locations; they do not include a server address or token. Keep credentials outside committed files. `sonar.tests` identifies test files for analysis; it is not a coverage-report path. Test-execution reports, when supported and configured, describe test results and durations separately from coverage.

LCOV records include `SF` for a source file, `DA` for line hits and summary counts such as lines found/hit. Branch records describe instrumented alternatives. If an `SF` path refers to a build container location absent in the scanner workspace, the scanner can fail to associate the report with source files. Inspect import warnings and the measured file list rather than assuming a report was consumed because it exists.

TypeScript and bundler transformations add another mapping boundary. Preserve usable source maps and configure the coverage tool to report the original source where appropriate. Do not mix generated JavaScript and original TypeScript as if they were separate application implementations. When reports come from several packages, use unique package-relative paths or a supported aggregation strategy so identical filenames do not overwrite or misattribute coverage.

The example uses c8 with Node's built-in test runner and emits LCOV. Its verification script requires a report for the intended shipping source and positive, fully hit line, function and branch counts. It rejects an empty report or unexpected source scope. This verifies report production and contents; it does not execute a SonarQube server analysis.

## Scope, Exclusions & New Code

The denominator determines the meaning of a percentage. If only imported modules are instrumented, an untouched source file can disappear from coverage. Configure all intended source files to participate. Excluding generated files or vendored code is often appropriate; excluding difficult business logic to pass a gate hides the problem.

Source exclusions remove files from analysis scope. Coverage exclusions remove files from coverage measures while potentially retaining their static analysis. Duplication exclusions address another measure. Name the reason for an exclusion and inspect its effect; these settings are not interchangeable shortcuts.

Overall coverage includes the existing codebase. New-code coverage measures the configured change period or comparison baseline. A new-code policy can prevent additional uncovered behavior while allowing gradual improvement of legacy code. Its result is meaningful only if the baseline is correct. A misconfigured reference branch or missing source-control history can change which lines are considered new.

Changed-line coverage has limits: a small edit can alter behavior throughout a function without adding many executable lines. Use affected-behavior tests in addition to a changed-line threshold. A minimum gate is a floor, not a reason to stop testing once the percentage passes.

:::check{question="Coverage increases after excluding a large untested service. Did the service become safer?"}
No. The measured denominator changed. Exclusions can be justified for generated or out-of-scope files, but removing application behavior from the measure does not add assertions or execute its failure paths. Review the excluded scope and the reason separately from the headline percentage.
:::

## Findings & Security Review

Static analysis can report reliability, maintainability and security concerns using the terminology and severity model supported by the installed version. A security hotspot identifies code needing a contextual security review; it is not automatically a confirmed exploitable vulnerability. Review the data flow, trust boundary and runtime protections before deciding its disposition.

For a suspected injection, identify where input originates, whether it becomes syntax, which API receives it and what parameterization or validation occurs. For a hardcoded-secret finding, determine whether the value grants authority or is a harmless fixture; a real exposed credential needs rotation, not merely deletion of the string in the latest commit.

Classify false positives with a concrete explanation. A broad suppression can hide later real defects in the same area. A suppression should be narrow, reviewable and attached to a reason that remains valid as the code evolves. Updating analyzers can reveal new findings or change classifications; preserve a process for reviewing those changes instead of disabling rules indiscriminately.

Static analysis does not replace dependency vulnerability checks, secret scanning, dynamic testing or cloud configuration review. A source analyzer may not know the production IAM policy, an external provider's retry behavior or the actual tenant isolation enforced by a database role.

## CI Integration & Gate Enforcement

A practical sequence is dependency installation, compilation where required, tests with coverage, report verification, analysis, and gate evaluation. Fail before analysis if tests fail or the required report is absent. If tests and analysis run in separate jobs, explicitly transfer the report and ensure both jobs use the same selected revision.

The scanner may support waiting for the quality-gate result, or CI can use the product's supported status integration. Configure a bounded wait. Do not declare success immediately after submission and later discover the gate failed after merge. A required repository check must be attached to the current commit; an old green badge is not evidence for a new change.

Do not expose an analysis token to arbitrary fork code. Build scripts and dependency installation can execute code supplied by a contributor. Use the product's supported untrusted-contribution workflow and narrowly scoped tokens. Restrict which projects a token can analyze and keep token values out of properties files, artifacts and logs.

A broken gate can indicate a real issue, a missing report, a changed baseline, a new analyzer rule or a server-processing failure. Diagnose which boundary failed before changing thresholds. Preserve logs showing revision, source scope, imported report paths and final analysis state without exposing credentials.

:::check{question="The scanner exits successfully after uploading an analysis. Can CI immediately conclude that the quality gate passed?"}
No. Server-side processing and gate evaluation may still be pending. Use a supported gate-wait or status mechanism, inspect its final result for the current revision, and distinguish analysis submission from acceptance.
:::

[Runnable LCOV example and SonarQube configuration](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/sonarqube-coverage)

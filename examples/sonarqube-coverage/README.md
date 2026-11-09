# Coverage evidence and SonarQube import configuration

Requires Node.js 24 and npm. This example generates and verifies a real LCOV report. It includes a SonarQube project configuration but does not provision a SonarQube server or execute an authenticated analysis in CI.

```bash
cd examples/sonarqube-coverage
npm ci
npm run coverage
npm run verify:report
```

Three behavioral tests cover invalid totals, expedited-shipping precedence and the exact free-shipping boundary. c8 includes all intended source files and requires 100% line, branch, function and statement coverage for this deliberately small fixture. This threshold is an exercise policy, not a recommendation to enforce 100% on every production codebase.

The verifier rejects an empty report, unexpected file scope or missing/uncovered line/function/branch totals. It does not evaluate assertion quality or call a SonarQube API. The [CI workflow](../../.github/workflows/quality-go-sql-examples.yml) runs these commands without analysis credentials.

For an existing compatible SonarQube instance, create the project and obtain a narrowly scoped analysis token using the installed product's supported workflow. Set `SONAR_HOST_URL` and `SONAR_TOKEN` in the invoking environment, then run a compatible installed SonarScanner CLI from this directory after coverage generation:

```bash
sonar-scanner -Dsonar.qualitygate.wait=true -Dsonar.qualitygate.timeout=300
```

The properties file identifies the sources, tests and LCOV path. Keep the token outside committed files and logs. Server version, scanner compatibility, project permissions and product edition determine which analysis/PR features are available. This optional command is documented setup, not a claim of a successful server scan.

A matching coverage report proves instrumented execution under its scope. It does not prove correct requirements, strong assertions or runtime security. No mutation tool, dependency scanner or security scanner is included.

Primary references:

- [JavaScript/TypeScript coverage import](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)
- [Quality gates](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates)
- [c8 coverage tooling](https://github.com/bcoe/c8)

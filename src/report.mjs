import { digest } from './fs.mjs';
export function finding(ruleId, location, message, { severity = 'error', workspace = 'root', protectedRule = false, detail } = {}) {
  return { ruleId, path: location, workspace, severity, message, protected: protectedRule, fingerprint: digest({ ruleId, location, workspace, detail }), ...(detail ? { detail } : {}) };
}
export function report(findings = [], extra = {}) {
  return { status: findings.some(f => f.severity === 'error') ? 'failed' : 'passed', exitCode: findings.some(f => f.severity === 'error') ? 1 : 0, findings, ...extra };
}

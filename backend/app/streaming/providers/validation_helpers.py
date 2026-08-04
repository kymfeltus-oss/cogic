from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


Severity = Literal["info", "warning", "critical"]
ValidationStatus = Literal["ready", "needs_attention", "error"]


@dataclass
class ProviderValidationCheck:
    key: str
    label: str
    ok: bool
    message: str
    severity: Severity = "info"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ProviderValidationResult:
    ok: bool
    status: ValidationStatus
    checks: list[ProviderValidationCheck] = field(default_factory=list)
    safe_user_message: str = ""
    technical_error: str | None = None
    refreshed_tokens: dict[str, Any] | None = None

    def to_dict(self, include_technical: bool = False) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "ok": self.ok,
            "status": self.status,
            "checks": [c.to_dict() for c in self.checks],
            "safe_user_message": self.safe_user_message,
        }
        if include_technical and self.technical_error:
            payload["technical_error"] = self.technical_error
        if self.refreshed_tokens:
            payload["refreshed_tokens"] = self.refreshed_tokens
        return payload


def check(
    key: str,
    label: str,
    ok: bool,
    message: str,
    *,
    severity: Severity = "info",
) -> ProviderValidationCheck:
    return ProviderValidationCheck(key=key, label=label, ok=ok, message=message, severity=severity)


def merge_validation_results(
    results: list[ProviderValidationResult],
    *,
    default_message: str = "Destination validation complete.",
) -> ProviderValidationResult:
    checks: list[ProviderValidationCheck] = []
    technical_errors: list[str] = []
    refreshed: dict[str, Any] | None = None

    for result in results:
        checks.extend(result.checks)
        if result.technical_error:
            technical_errors.append(result.technical_error)
        if result.refreshed_tokens:
            refreshed = result.refreshed_tokens

    has_critical = any(not c.ok and c.severity == "critical" for c in checks)
    has_failure = any(not c.ok for c in checks)

    if has_critical:
        status: ValidationStatus = "error"
    elif has_failure:
        status = "needs_attention"
    else:
        status = "ready"

    ok = not has_failure
    safe_messages = [r.safe_user_message for r in results if r.safe_user_message and not r.ok]
    safe_user_message = safe_messages[0] if safe_messages else (default_message if ok else "This destination needs attention before going live.")

    return ProviderValidationResult(
        ok=ok,
        status=status,
        checks=checks,
        safe_user_message=safe_user_message,
        technical_error="; ".join(technical_errors) if technical_errors else None,
        refreshed_tokens=refreshed,
    )


def validation_from_test_steps(
    success: bool,
    message: str,
    steps: list[dict[str, Any]],
) -> ProviderValidationResult:
    checks = [
        check(
            key=str(step.get("key") or step.get("label", "check")).lower().replace(" ", "_"),
            label=str(step.get("label") or "Check"),
            ok=bool(step.get("ok")),
            message=str(step.get("message") or step.get("label") or ""),
            severity="critical" if not step.get("ok") else "info",
        )
        for step in steps
    ]
    status: ValidationStatus = "ready" if success else "needs_attention"
    return ProviderValidationResult(ok=success, status=status, checks=checks, safe_user_message=message)

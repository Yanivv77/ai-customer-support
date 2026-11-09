import time
from dataclasses import dataclass, field

from app.ai.agent import write_reply
from app.ai.classifier import classify
from app.ai.rules import CUSTOMER_STEPS, resolve_issue
from app.ai.safety import safety_message
from app.ai.schemas import AgentReply, Classification, Decision

NOT_IN_KNOWLEDGE_BASE = "The knowledge base does not answer this"


@dataclass
class Trace:
    """What happened inside decide(), for the dashboard's "Try an email" page."""

    classification: Classification | None = None
    answer: AgentReply | None = None
    # The knowledge base sections the agent read.
    sources: list[str] = field(default_factory=list)
    # Which check made the final call, e.g. "battery-safety" or "agent-reply".
    rule: str = ""
    classify_seconds: float = 0.0
    agent_seconds: float | None = None


def decide(thread: str, has_attachments: bool = False) -> Decision:
    """Run the AI steps for one email thread. The models propose, this function decides."""
    return decide_traced(thread, has_attachments)[0]


def decide_traced(thread: str, has_attachments: bool = False) -> tuple[Decision, Trace]:
    trace = Trace()
    started = time.perf_counter()
    classification = classify(thread)
    trace.classification = classification
    trace.classify_seconds = time.perf_counter() - started

    def done(rule: str, decision: Decision) -> tuple[Decision, Trace]:
        trace.rule = rule
        return decision, trace

    def escalate(rule: str, reason: str, proposed_action: str | None = None, gap: str | None = None):
        return done(
            rule,
            Decision(
                action="escalate",
                section=classification.section,
                reply=classification.acknowledgement,
                reason=reason,
                proposed_action=proposed_action,
                knowledge_gap=gap,
            ),
        )

    if classification.battery_safety:
        # The safety message is fixed text, never written by the model.
        return done(
            "battery-safety",
            Decision(
                action="escalate",
                section=classification.section,
                reply=safety_message(classification.language),
                reason=classification.reason,
                proposed_action="battery-safety",
            ),
        )
    if has_attachments:
        return escalate("attachments", "The email has attachments")
    if classification.needs_human:
        gap = classification.reason if classification.uncovered_topic else None
        return escalate("needs-human", classification.reason, gap=gap)

    started = time.perf_counter()
    answer, trace.sources = write_reply(thread, classification.section)
    trace.answer = answer
    trace.agent_seconds = time.perf_counter() - started

    if answer.action == "escalate":
        # The agent may escalate because an escalation rule says "not covered": still a gap.
        gap = answer.missing_information if not answer.enough_information else None
        return escalate("agent-escalated", answer.reasoning, gap=gap)
    if not answer.enough_information:
        return escalate(
            "not-in-knowledge-base",
            NOT_IN_KNOWLEDGE_BASE,
            gap=answer.missing_information or "The knowledge base does not answer this question",
        )
    if answer.issue:
        step = resolve_issue(answer.issue)
        if step not in CUSTOMER_STEPS:
            return escalate("issue-rule", f"Next step: {step}", proposed_action=step)
    if answer.promises_an_action:
        return escalate("promises-action", "The reply promises an action")

    return done(
        "agent-reply",
        Decision(
            action="reply",
            section=classification.section,
            reply=answer.reply,
            reason=answer.reasoning,
        ),
    )

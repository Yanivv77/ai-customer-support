from app.ai.schemas import Issue

# Steps where the reply goes to the customer, because they have to check or send something first.
CUSTOMER_STEPS = {"troubleshoot", "ask-details"}


def resolve_issue(issue: Issue) -> str:
    """Decide the next step for a reported problem. The model reports, Python decides."""
    step = next_step(issue)
    if step not in CUSTOMER_STEPS | {"escalate"} and not issue.order_number:
        return "ask-details"
    return step


def next_step(issue: Issue) -> str:
    if issue.problem == "missing-accessory":
        return "ship-part"
    if issue.problem == "display-error":
        # The customer tries the checks first; if the code stays, a person takes over.
        return "escalate" if issue.steps_checked else "troubleshoot"
    if issue.problem == "battery-not-holding-charge":
        # A replacement battery is always arranged by a person.
        return "escalate" if issue.steps_checked else "troubleshoot"
    # Brake problems, frame cracks, and anything unexpected go to a person.
    return "escalate"

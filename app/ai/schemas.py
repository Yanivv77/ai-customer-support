from typing import Literal

from pydantic import BaseModel, Field

Section = Literal["e-bikes", "batteries", "returns-and-warranty", "shipping", "other"]


class Classification(BaseModel):
    section: Section
    language: str = Field(description="Language of the latest customer message, e.g. English")
    needs_human: bool = Field(description="True when an always-escalate rule applies")
    battery_safety: bool = Field(
        description="True when a battery is swollen, hot, leaking, smoking, or smells of burning"
    )
    reason: str = Field(description="One sentence explaining the classification")
    acknowledgement: str = Field(
        description="Short note to the customer, in their language, that a colleague replies"
    )


class Issue(BaseModel):
    product: Literal["e-bike", "battery"]
    problem: Literal[
        "missing-accessory",
        "display-error",
        "brake-problem",
        "frame-crack",
        "battery-not-holding-charge",
    ]
    order_number: str | None = None
    model: str | None = Field(default=None, description="Model code, e.g. EB-C1 or BAT-36-10")
    error_code: str | None = Field(default=None, description="Display error code, e.g. E21")
    steps_checked: bool = Field(
        default=False, description="True when the customer already did the suggested checks"
    )


class AgentReply(BaseModel):
    action: Literal["reply", "escalate"]
    reply: str = Field(description="The email to the customer, plain text")
    reasoning: str = Field(description="Which knowledge base entries you used, and why")
    enough_information: bool = Field(description="True when the knowledge base answers the question")
    promises_an_action: bool = Field(
        description="True when the reply promises a refund, shipment, replacement, date, or call"
    )
    issue: Issue | None = Field(
        default=None, description="Fill in when the customer reports a problem with a product"
    )


class Decision(BaseModel):
    action: Literal["reply", "escalate"]
    section: str
    reply: str
    reason: str
    proposed_action: str | None = None

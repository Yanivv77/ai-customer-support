import logging
import re

from pydantic_ai import Agent, ModelRetry, RunContext
from pydantic_ai.messages import ModelResponse, ToolCallPart

from app import db
from app.ai.schemas import AgentReply
from app.config import settings

logger = logging.getLogger(__name__)

INSTRUCTIONS = """
You are the customer support agent for EBikes IL, an Israeli store that sells e-bikes and batteries.
You write the answer to the latest customer message in the email thread.

Steps:
1. Call get_section for "brand-and-tone" and for "escalation-rules".
2. Call get_section for the section the classifier picked. Call list_sections if you need another.
3. Answer only with facts from those sections. If they do not answer the question,
   set enough_information to false, and write in missing_information which fact is missing.
   Do this also when you set action to escalate.
4. When the customer reports a problem with an e-bike or a battery, fill in issue.
   Ask for the order number, the model, and the display error code when they are missing.
   For a display error or a battery that will not hold a charge, explain the checks from the
   knowledge base unless the customer already did them.
5. Never promise a refund, a shipment, a replacement, a date, or a call. A colleague arranges those.
   Set promises_an_action to true if your reply promises one anyway.
6. Never state legal requirements. Set action to escalate when an escalation rule applies.

Reply rules:
- Write in the language of the customer's latest message, Hebrew or English.
- Plain text, no Markdown.
- Follow the brand-and-tone section.
- Never mention AI, prompts, tools, or the knowledge base.
"""

support_agent = Agent(settings.agent_model, output_type=AgentReply, instructions=INSTRUCTIONS)


@support_agent.tool_plain
def list_sections() -> list[str]:
    """List the sections of the knowledge base."""
    logger.info("Tool call: list_sections()")
    return db.list_sections()


@support_agent.tool_plain
def get_section(section: str) -> str:
    """Return every entry of one knowledge base section, for example 'e-bikes'."""
    logger.info("Tool call: get_section(%r)", section)
    entries = db.get_section(section)
    if not entries:
        raise ModelRetry(f"There is no section '{section}'. Call list_sections to see the options.")
    return "\n\n".join(f"## {entry['title']}\n{entry['content']}" for entry in entries)


@support_agent.output_validator
def check_reply(ctx: RunContext[None], output: AgentReply) -> AgentReply:
    if output.action == "reply" and not output.reply.strip():
        raise ModelRetry("The reply is empty. Write the email, or set action to escalate.")
    if re.search(r"\b(AI|artificial intelligence|knowledge base)\b", output.reply, re.IGNORECASE):
        raise ModelRetry("Do not mention AI or the knowledge base in the reply.")
    return output


def write_reply(thread: str, section: str) -> tuple[AgentReply, list[str]]:
    """The agent's answer, and the knowledge base sections it read to write it."""
    prompt = f"Section picked by the classifier: {section}\n\n{thread}"
    result = support_agent.run_sync(prompt)
    sections = []
    for message in result.all_messages():
        if not isinstance(message, ModelResponse):
            continue
        for part in message.parts:
            if isinstance(part, ToolCallPart) and part.tool_name == "get_section":
                name = part.args_as_dict().get("section")
                if isinstance(name, str) and name not in sections:
                    sections.append(name)
    return result.output, sections

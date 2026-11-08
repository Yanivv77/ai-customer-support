import re
from dataclasses import dataclass

from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext

from app.ai.decide import decide
from app.ai.schemas import Decision
from evals.golden_emails import GOLDEN_EMAILS

HEBREW_LETTERS = re.compile(r"[֐-׿]")


@dataclass
class SectionMatches(Evaluator):
    def evaluate(self, ctx: EvaluatorContext) -> bool:
        return ctx.output.section == ctx.expected_output["section"]


@dataclass
class ActionMatches(Evaluator):
    def evaluate(self, ctx: EvaluatorContext) -> bool:
        return ctx.output.action == ctx.expected_output["action"]


@dataclass
class ReplyLanguageMatches(Evaluator):
    """Hebrew emails must get Hebrew replies, and English emails must not."""

    def evaluate(self, ctx: EvaluatorContext) -> bool:
        has_hebrew = bool(HEBREW_LETTERS.search(ctx.output.reply))
        return has_hebrew == (ctx.expected_output["language"] == "he")


def run_pipeline(email: str) -> Decision:
    return decide(email)


dataset = Dataset(
    name="golden-emails",
    cases=[
        Case(
            name=case["name"],
            inputs=case["email"],
            expected_output={
                "section": case["section"],
                "action": case["action"],
                "language": case["language"],
            },
        )
        for case in GOLDEN_EMAILS
    ],
    evaluators=[SectionMatches(), ActionMatches(), ReplyLanguageMatches()],
)


if __name__ == "__main__":
    report = dataset.evaluate_sync(run_pipeline, max_concurrency=4)
    report.print(include_input=False, include_output=True, include_durations=False)

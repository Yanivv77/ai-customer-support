"""Fixed battery safety messages. The model never writes these."""

ENGLISH = (
    "Hi,\n\n"
    "Please stop using the battery and do not charge it. If it is safe to do so, put it "
    "outside on a surface that does not burn, away from buildings. If there is smoke or "
    "fire, call 102 right away.\n\n"
    "A colleague will contact you.\n\n"
    "EBikes IL Support"
)

HEBREW = (
    "שלום,\n\n"
    "הפסיקו להשתמש בסוללה ואל תטענו אותה. אם זה בטוח, הניחו אותה בחוץ על משטח שאינו "
    "נדלק, הרחק ממבנים. אם יש עשן או אש, התקשרו מיד למספר 102.\n\n"
    "נציג שלנו ייצור איתכם קשר.\n\n"
    "צוות EBikes IL"
)


def safety_message(language: str) -> str:
    """Hebrew when the customer wrote in Hebrew, English otherwise."""
    if language.strip().lower() in {"hebrew", "עברית", "he", "iw"}:
        return HEBREW
    return ENGLISH

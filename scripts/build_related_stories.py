#!/usr/bin/env python3
"""Build static, content-based related-story links for every portfolio clip.

The output is read by Jekyll, so recommendation links are present in the HTML
instead of depending on a browser-side widget. The ranking favors topical and
language similarity, then gives a measured boost to NPR, CNN and Stanford work.
"""

from __future__ import annotations

import ast
import html
import math
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLIPS_DIR = ROOT / "pages" / "clips"
OUTPUT = ROOT / "_data" / "related_stories.yml"

# A small number of editorial pairings capture relationships that keyword
# similarity cannot (for example, medicine as portrayed on TV and in practice).
# All other clips are ranked automatically.
EDITORIAL_OVERRIDES = {
    "94": ["113", "96", "87"],
    "98": ["113", "96", "87"],
}

STOP_WORDS = {
    "a", "about", "after", "again", "against", "all", "also", "am", "an", "and",
    "any", "are", "as", "at", "be", "because", "been", "before", "being", "between",
    "both", "but", "by", "can", "could", "did", "do", "does", "doing", "down", "during",
    "each", "few", "for", "from", "further", "had", "has", "have", "having", "he", "her",
    "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into",
    "is", "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no",
    "nor", "not", "now", "of", "off", "on", "once", "only", "or", "other", "our",
    "ours", "ourselves", "out", "over", "own", "said", "same", "she", "should", "so",
    "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under",
    "until", "up", "very", "was", "we", "were", "what", "when", "where", "which", "while",
    "who", "whom", "why", "will", "with", "would", "you", "your", "yours", "yourself",
    "story", "stories", "report", "reports", "reported", "reporting", "news", "new", "says",
    "say", "one", "two", "three", "may", "many", "much", "like", "including", "according",
}

WORD_RE = re.compile(r"[a-z0-9]+(?:['’][a-z]+)?")
TAG_RE = re.compile(r"<[^>]+>")
URL_RE = re.compile(r"https?://\S+")
MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\([^\)]+\)")


def scalar(value: str):
    value = value.strip()
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    if value.lower() in {"null", "nil"}:
        return None
    if value and value[0] in {'"', "'"} and value[-1:] == value[0]:
        try:
            return ast.literal_eval(value)
        except (SyntaxError, ValueError):
            return value[1:-1]
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if value.startswith("[") and value.endswith("]"):
        return [scalar(item) for item in value[1:-1].split(",") if item.strip()]
    return value


def parse_front_matter(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text

    try:
        end = next(i for i, line in enumerate(lines[1:], 1) if line.strip() == "---")
    except StopIteration:
        return {}, text

    data: dict = {}
    front = lines[1:end]
    index = 0
    while index < len(front):
        line = front[index]
        if not line or line.lstrip().startswith("#") or ":" not in line:
            index += 1
            continue

        key, raw = line.split(":", 1)
        key = key.strip()
        raw = raw.strip()

        if raw in {"|", ">"}:
            block: list[str] = []
            index += 1
            while index < len(front) and (front[index].startswith(" ") or not front[index]):
                block.append(front[index].strip())
                index += 1
            data[key] = " ".join(part for part in block if part)
            continue

        if raw == "":
            items: list = []
            lookahead = index + 1
            while lookahead < len(front) and front[lookahead].lstrip().startswith("-"):
                items.append(scalar(front[lookahead].lstrip()[1:].strip()))
                lookahead += 1
            if items:
                data[key] = items
                index = lookahead
                continue

        data[key] = scalar(raw)
        index += 1

    return data, "\n".join(lines[end + 1 :])


def clean_text(value) -> str:
    value = "" if value is None else str(value)
    value = MARKDOWN_LINK_RE.sub(r"\1", value)
    value = URL_RE.sub(" ", value)
    value = TAG_RE.sub(" ", value)
    return html.unescape(value).lower()


def normalize_token(token: str) -> str:
    token = token.replace("’", "'").strip("'")
    if token.endswith("'s"):
        token = token[:-2]
    if len(token) > 5 and token.endswith("s") and not token.endswith("ss"):
        token = token[:-1]
    return token


def tokens(value) -> list[str]:
    found = (normalize_token(token) for token in WORD_RE.findall(clean_text(value)))
    return [token for token in found if len(token) >= 3 and token not in STOP_WORDS and not token.isdigit()]


def normalized_publisher(value) -> str:
    return re.sub(r"\s+", " ", clean_text(value)).strip()


def outlet_tier(publisher: str) -> int:
    if any(name in publisher for name in ("npr", "cnn", "stanford")):
        return 2
    if any(name in publisher for name in ("abc news", "medpage")):
        return 1
    return 0


def normalized_categories(data: dict) -> set[str]:
    raw = data.get("categories", data.get("category", []))
    if not isinstance(raw, list):
        raw = [raw]
    categories = {re.sub(r"\s+", " ", clean_text(item)).strip() for item in raw if item}
    if any(data.get(kind) is True for kind in ("audio", "video", "podcast", "photo_story")):
        categories.add("multimedia")
    return categories


def numeric_id(value) -> int:
    return int(str(value).strip())


def display_id(value) -> str:
    number = numeric_id(value)
    return f"{number:02d}" if number < 10 else str(number)


def relationship_ids(data: dict) -> set[int]:
    relationships = set()
    for key in ("story_clip_number", "video_clip_number", "podcast_clip_number"):
        value = data.get(key)
        if value not in (None, ""):
            relationships.add(numeric_id(value))
    return relationships


def load_clips() -> list[dict]:
    clips = []
    for path in sorted(CLIPS_DIR.glob("*.md")):
        data, body = parse_front_matter(path)
        if data.get("clip") is not True or data.get("clip_id") in (None, ""):
            continue
        clip = {
            "id": numeric_id(data["clip_id"]),
            "display_id": display_id(data["clip_id"]),
            "title": clean_text(data.get("title")),
            "publisher": normalized_publisher(data.get("publisher")),
            "tier": outlet_tier(normalized_publisher(data.get("publisher"))),
            "categories": normalized_categories(data),
            "relations": relationship_ids(data),
            "is_companion": data.get("story_element") is True,
            "body": clean_text(body)[:16000],
            "teaser": clean_text(data.get("teaser")),
            "reporting": clean_text(data.get("reporting")),
        }
        clip["title_tokens"] = set(tokens(clip["title"]))
        weighted = Counter(tokens(clip["body"]))
        weighted.update({token: count * 3 for token, count in Counter(tokens(clip["teaser"])).items()})
        weighted.update({token: count * 3 for token, count in Counter(tokens(clip["reporting"])).items()})
        weighted.update({token: count * 5 for token, count in Counter(tokens(clip["title"])).items()})
        clip["counts"] = weighted
        clips.append(clip)
    return clips


def cosine(left: Counter, right: Counter, idf: dict[str, float]) -> float:
    shared = left.keys() & right.keys()
    numerator = sum(left[token] * right[token] * idf[token] ** 2 for token in shared)
    left_norm = math.sqrt(sum((count * idf[token]) ** 2 for token, count in left.items()))
    right_norm = math.sqrt(sum((count * idf[token]) ** 2 for token, count in right.items()))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)


def pair_score(current: dict, candidate: dict, idf: dict[str, float]) -> float:
    score = cosine(current["counts"], candidate["counts"], idf) * 175

    shared_categories = current["categories"] & candidate["categories"]
    substantive_categories = shared_categories - {"multimedia"}
    score += len(substantive_categories) * 52
    if "multimedia" in shared_categories:
        score += 7

    shared_title = current["title_tokens"] & candidate["title_tokens"]
    score += min(42, sum(idf.get(token, 1) ** 2 for token in shared_title) * 5)

    # Editorial preference: surface the strongest recent body of work when it is
    # genuinely related, without allowing outlet prestige to overwhelm topic fit.
    if candidate["tier"] == 2:
        score += 18
    elif candidate["tier"] == 1:
        score += 2

    if current["tier"] == 2:
        score += {2: 20, 1: -7, 0: -22}[candidate["tier"]]
    elif candidate["tier"] == 2:
        score += 14

    if current["publisher"] == candidate["publisher"]:
        score += 5

    if candidate["is_companion"]:
        score -= 18

    score += min(candidate["id"], 120) / 40
    return score


def build_rankings(clips: list[dict]) -> dict[str, list[str]]:
    document_frequency = Counter()
    for clip in clips:
        document_frequency.update(clip["counts"].keys())
    total = len(clips)
    idf = {
        token: math.log((total + 1) / (frequency + 1)) + 1
        for token, frequency in document_frequency.items()
    }

    reverse_relations = {
        clip["id"]: {other["id"] for other in clips if clip["id"] in other["relations"]}
        for clip in clips
    }
    rankings: dict[str, list[str]] = {}
    for current in clips:
        companions = current["relations"] | reverse_relations[current["id"]]
        candidates = [
            candidate
            for candidate in clips
            if candidate["id"] != current["id"] and candidate["id"] not in companions
        ]
        candidates.sort(
            key=lambda candidate: (pair_score(current, candidate, idf), candidate["id"]),
            reverse=True,
        )
        automatic = [candidate["display_id"] for candidate in candidates]
        overrides = EDITORIAL_OVERRIDES.get(current["display_id"], [])
        combined = overrides + [clip_id for clip_id in automatic if clip_id not in overrides]
        rankings[current["display_id"]] = combined[:3]

    # Companion videos and podcasts often contain little body text. Their
    # written parent is a much stronger semantic signal than their format, so
    # give both versions of the same reporting the same recommendations.
    clips_by_id = {clip["id"]: clip for clip in clips}
    for clip in clips:
        if not clip["is_companion"] or not clip["relations"]:
            continue
        parent = clips_by_id.get(next(iter(clip["relations"])))
        if parent:
            rankings[clip["display_id"]] = rankings[parent["display_id"]].copy()
    return rankings


def write_yaml(rankings: dict[str, list[str]]) -> None:
    lines = [
        "# Generated by scripts/build_related_stories.py.",
        "# Rebuilt during deployment so newly added clips receive recommendations.",
    ]
    for clip_id in sorted(rankings, key=int):
        lines.append(f'"{clip_id}":')
        lines.extend(f'  - "{related_id}"' for related_id in rankings[clip_id])
    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    clips = load_clips()
    if len(clips) < 4:
        raise SystemExit("At least four clips are required to build recommendations.")
    rankings = build_rankings(clips)
    if any(len(related) != 3 for related in rankings.values()):
        raise SystemExit("Every clip must receive exactly three recommendations.")
    write_yaml(rankings)
    print(f"Built recommendations for {len(rankings)} clips.")


if __name__ == "__main__":
    main()

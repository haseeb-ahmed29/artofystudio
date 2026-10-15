#!/usr/bin/env python3
"""Dependency-free static checks. Run from any directory: python scripts/check.py.

Checks file completeness, metadata, relative links/anchors, CSS/module asset
references, original artwork integrity, preserved commission content and fonts.
Browser behavior and visual appearance require the separate browser QA pass.
"""

from collections import Counter
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
PAGES = (
    "index.html", "artwork.html", "about.html", "commissions.html",
    "process.html", "faq.html", "contact.html",
    "artwork/fantasy-battle.html", "artwork/character-illustration.html",
    "artwork/fantasy-warrior.html", "artwork/anime-knight.html",
)
ART = {
    "fantasy-battle": (
        "Fantasy Battle", "Multiple characters • Action scene",
        "a9fd091cfcd571b301037c8dc61489f52b14e6948ff981f6ac4506c9c9941228",
    ),
    "character-illustration": (
        "Character Illustration", "Full-body • Custom character",
        "49ac92dc556af4f19af1d780e80ff2cb775738f2124bdef1ec12ef4e73e291e5",
    ),
    "fantasy-warrior": (
        "Fantasy Warrior", "Character design • Fantasy",
        "e5cc5158681dc954d792b010e323dbc6501820900b026a38a9a82ab5542651ce",
    ),
    "anime-knight": (
        "Anime Knight", "Character illustration • Armor",
        "fa036baba0daa616e78d25dd074db406105ebb53dc4bdd90d7b9c2d114a5d483",
    ),
}
PACKAGES = {
    "Sketch": ("$35", "Clean line sketch", "1 character", "Simple shading", "Personal use"),
    "Full Color": ("$75", "Fully rendered character", "1 character", "Simple background", "Personal use"),
    "Premium Scene": ("$150+", "Detailed illustration", "1–2 characters", "Custom background", "Commercial options"),
}


def compact(value):
    return " ".join(value.split())


class Document(HTMLParser):
    def __init__(self, filename):
        super().__init__(convert_charrefs=True)
        self.filename = filename
        self.nodes = []
        self.ids = []
        self.links = []
        self.images = []
        self.h1 = []
        self.titles = []
        self.descriptions = []
        self.text = []
        self.stack = []
        self.current = {"h1": [], "title": []}
        self.feed(filename.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.nodes.append((tag, attrs))
        self.stack.append(tag)
        if tag in self.current:
            self.current[tag].append([])
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if tag == "meta" and attrs.get("name", "").lower() == "description":
            self.descriptions.append(attrs.get("content", ""))
        if tag == "img":
            self.images.append(attrs)
        for attr in ("href", "src", "poster", "action"):
            if attr in attrs:
                self.links.append((attrs[attr], tag, attr))
        if "srcset" in attrs and not attrs["srcset"].startswith("data:"):
            for candidate in attrs["srcset"].split(","):
                self.links.append((candidate.strip().split()[0], tag, "srcset"))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in self.current and self.current[tag]:
            value = compact("".join(self.current[tag].pop()))
            (self.h1 if tag == "h1" else self.titles).append(value)
        if tag in self.stack:
            self.stack = self.stack[:len(self.stack) - 1 - self.stack[::-1].index(tag)]

    def handle_data(self, data):
        if "script" not in self.stack and "style" not in self.stack:
            self.text.append(data)
        for groups in self.current.values():
            for group in groups:
                group.append(data)


errors = []
checked_refs = 0


def require(condition, message):
    if not condition:
        errors.append(message)


documents = {}
for page in PAGES:
    filename = ROOT / page
    require(filename.is_file(), f"Missing required page: {page}")
    if filename.is_file():
        documents[filename.resolve()] = Document(filename)


def check_reference(source, reference, description):
    global checked_refs
    checked_refs += 1
    require(bool(reference.strip()), f"{source.relative_to(ROOT)}: empty {description}")
    parsed = urlsplit(reference)
    if parsed.scheme == "javascript":
        require(False, f"{source.relative_to(ROOT)}: javascript URL in {description}")
        return
    if parsed.scheme or parsed.netloc:
        return
    if parsed.path.startswith("/"):
        require(False, f"{source.relative_to(ROOT)}: root-absolute path breaks repository hosting: {reference}")
        return
    target = (source.parent / unquote(parsed.path)).resolve() if parsed.path else source.resolve()
    require(target.is_relative_to(ROOT), f"{source.relative_to(ROOT)}: path escapes repository: {reference}")
    if not target.is_relative_to(ROOT):
        return
    if target.is_dir():
        target = target / "index.html"
    require(target.is_file(), f"{source.relative_to(ROOT)}: missing local {description}: {reference}")
    if parsed.fragment and target.suffix == ".html" and target.is_file():
        document = documents.get(target)
        if document is None:
            document = Document(target)
            documents[target] = document
        require(unquote(parsed.fragment) in document.ids,
                f"{source.relative_to(ROOT)}: missing anchor in {reference}")


for filename, document in list(documents.items()):
    page = filename.relative_to(ROOT).as_posix()
    require(len(document.h1) == 1 and bool(document.h1[0]), f"{page}: needs exactly one nonempty h1")
    require(len(document.titles) == 1 and bool(document.titles[0]), f"{page}: needs exactly one nonempty title")
    require(len(document.descriptions) == 1 and bool(document.descriptions[0]), f"{page}: needs one meta description")
    require(any(tag == "main" for tag, _ in document.nodes), f"{page}: missing main landmark")
    require(any(tag == "nav" for tag, _ in document.nodes), f"{page}: missing navigation")
    require(any(attrs.get("aria-current") == "page" for _, attrs in document.nodes), f"{page}: missing active navigation state")
    require(bool(document.images), f"{page}: missing original artwork")
    for element_id, count in Counter(document.ids).items():
        require(count == 1, f"{page}: duplicate id {element_id}")
    for image in document.images:
        require("alt" in image, f"{page}: image lacks alt attribute")
        for dimension in ("width", "height"):
            require(str(image.get(dimension, "")).isdigit() and int(image.get(dimension, "0")) > 0,
                    f"{page}: image needs positive {dimension} to reserve layout space")
    for reference, tag, attr in document.links:
        check_reference(filename, reference, f"{tag}[{attr}]")

for field in ("h1", "titles", "descriptions"):
    values = [compact(value).casefold() for document in documents.values() for value in getattr(document, field)]
    for value, count in Counter(values).items():
        require(count == 1, f"Duplicate {field}: {value}")

for directory in ("styles", "scripts", "assets"):
    folder = ROOT / directory
    if not folder.exists():
        continue
    for filename in folder.rglob("*"):
        if filename.suffix not in (".css", ".js", ".mjs") or "vendor" in filename.parts:
            continue
        text = filename.read_text(encoding="utf-8")
        references = re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", text)
        if filename.suffix in (".js", ".mjs"):
            references += re.findall(r"(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\bnew\s+URL\s*\(\s*)['\"]([^'\"]+)['\"]", text)
        else:
            references += re.findall(r"@import\s+['\"]([^'\"]+)['\"]", text)
        for reference in references:
            check_reference(filename, reference, "stylesheet/module asset")

for slug, (title, caption, digest) in ART.items():
    filename = ROOT / "assets" / "images" / (slug + ".jpg")
    require(filename.is_file(), f"Missing original artwork: {filename.relative_to(ROOT)}")
    if filename.is_file():
        require(sha256(filename.read_bytes()).hexdigest() == digest, f"Original artwork changed: {filename.relative_to(ROOT)}")
    for page in ("artwork.html", f"artwork/{slug}.html"):
        document = documents.get((ROOT / page).resolve())
        if document:
            text = compact(" ".join(document.text))
            require(title in text, f"{page}: missing original artwork title {title}")
            require(caption in text, f"{page}: missing original artwork caption {caption}")

commission = documents.get((ROOT / "commissions.html").resolve())
if commission:
    text = compact(" ".join(commission.text))
    for package, inclusions in PACKAGES.items():
        require(package in text, f"Commissions missing package {package}")
        for inclusion in inclusions:
            require(inclusion in text, f"Commissions missing {package} inclusion: {inclusion}")
    for package in ("sketch", "full-color", "premium-scene"):
        require(any(reference == f"contact.html?type={package}" for reference, _, _ in commission.links),
                f"Missing package selection link: {package}")

contact = documents.get((ROOT / "contact.html").resolve())
if contact:
    text = compact(" ".join(contact.text))
    require("artofystudio@gmail.com" in text, "Contact email not preserved")
    require("+44 7862602679" in text, "Contact phone not preserved")
    require("Open Email Draft" in text, "Contact draft action must be honest about opening an email draft")
    for name in ("name", "email", "type", "details"):
        require(any(attrs.get("name") == name for _, attrs in contact.nodes), f"Contact missing field {name}")

for family in ("outfit", "inter", "caveat"):
    font = ROOT / "assets" / "fonts" / f"{family}-latin-variable.woff2"
    license_file = ROOT / "assets" / "fonts" / "licenses" / f"{family}-OFL.txt"
    require(font.is_file(), f"Missing self-hosted font: {family}")
    if font.is_file():
        require(font.read_bytes()[:4] == b"wOF2", f"Invalid WOFF2 signature: {family}")
    require(license_file.is_file(), f"Missing font license: {family}")
    if license_file.is_file():
        require("SIL OPEN FONT LICENSE" in license_file.read_text(encoding="utf-8"), f"Incomplete font license: {family}")

if errors:
    print(f"FAIL: {len(errors)} issue(s)")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"PASS: {len(PAGES)} complete pages, unique metadata/headings, {checked_refs} local references checked,")
print("      all original artwork hashes, captions, commission packages, contact details and font licenses preserved.")

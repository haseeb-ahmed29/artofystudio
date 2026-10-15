#!/usr/bin/env python3
"""Dependency-free source/asset checks for the sketchbook motion upgrade.

Run alongside scripts/check.py. Browser QA still verifies actual rendering,
scroll behavior, focus, WebGL fallback, reduced motion and cursor interaction.
"""

from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "artwork.html", "about.html", "commissions.html",
         "process.html", "faq.html", "contact.html"]
SLUGS = ["fantasy-battle", "character-illustration", "fantasy-warrior", "anime-knight"]
TITLES = ["Fantasy Battle", "Character Illustration", "Fantasy Warrior", "Anime Knight"]
HASHES = [
    "a9fd091cfcd571b301037c8dc61489f52b14e6948ff981f6ac4506c9c9941228",
    "49ac92dc556af4f19af1d780e80ff2cb775738f2124bdef1ec12ef4e73e291e5",
    "e5cc5158681dc954d792b010e323dbc6501820900b026a38a9a82ab5542651ce",
    "fa036baba0daa616e78d25dd074db406105ebb53dc4bdd90d7b9c2d114a5d483",
]
PAGES += [f"artwork/{slug}.html" for slug in SLUGS]
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs), parent
        self.children, self.data = [], []

    def text(self):
        return " ".join(" ".join(self.data + [child.text() for child in self.children]).split())

    def ancestor(self, tag):
        current = self.parent
        while current:
            if current.tag == tag:
                return current
            current = current.parent
        return None

    def descendants(self, tag):
        result = []
        for child in self.children:
            if child.tag == tag:
                result.append(child)
            result += child.descendants(tag)
        return result


class Document(HTMLParser):
    def __init__(self, filename):
        super().__init__(convert_charrefs=True)
        self.filename, self.nodes = filename, []
        self.root = Node("document", [])
        self.stack = [self.root]
        self.feed(filename.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        self.nodes.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                self.stack = self.stack[:index]
                break

    def handle_data(self, data):
        self.stack[-1].data.append(data)

    def by_tag(self, tag):
        return [node for node in self.nodes if node.tag == tag]


errors = []


def require(condition, message):
    if not condition:
        errors.append(message)


def local_path(page, value):
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or parsed.path.startswith("/"):
        return None
    path = (page.parent / unquote(parsed.path)).resolve()
    return path if path.is_relative_to(ROOT) else None


def webp_size(filename):
    """Read RIFF WebP metadata without Pillow or another package."""
    data = filename.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("not a WebP file")
    offset = 12
    while offset + 8 <= len(data):
        kind, size = data[offset:offset + 4], int.from_bytes(data[offset + 4:offset + 8], "little")
        chunk = data[offset + 8:offset + 8 + size]
        if kind == b"VP8X":
            return 1 + int.from_bytes(chunk[4:7], "little"), 1 + int.from_bytes(chunk[7:10], "little")
        if kind == b"VP8 " and chunk[3:6] == b"\x9d\x01\x2a":
            return int.from_bytes(chunk[6:8], "little") & 0x3FFF, int.from_bytes(chunk[8:10], "little") & 0x3FFF
        if kind == b"VP8L" and chunk[:1] == b"\x2f":
            bits = int.from_bytes(chunk[1:5], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        offset += 8 + size + (size % 2)
    raise ValueError("missing WebP image dimensions")


documents = {}
for name in PAGES:
    path = ROOT / name
    require(path.is_file(), f"Missing page: {name}")
    if path.is_file():
        documents[name] = Document(path)

required_scripts = ["assets/vendor/gsap.min.js", "assets/vendor/ScrollTrigger.min.js",
                    "assets/js/main.js", "assets/js/scroll-motion.js", "assets/js/pencil-cursor.js"]
for name, document in documents.items():
    scripts = document.by_tag("script")
    for script in required_scripts:
        matches = [node for node in scripts if local_path(document.filename, node.attrs.get("src", "")) == ROOT / script]
        require(len(matches) == 1, f"{name}: must load {script} once using the correct relative path")
        for node in matches:
            require("defer" in node.attrs or node.attrs.get("type") == "module", f"{name}: {script} must not block parsing")
    for css in ["assets/css/site.css", "assets/css/motion.css"]:
        require(any(local_path(document.filename, node.attrs.get("href", "")) == ROOT / css
                    for node in document.by_tag("link")), f"{name}: missing local stylesheet {css}")
    script_paths = [local_path(document.filename, node.attrs.get("src", "")) for node in scripts]
    if all(ROOT / script in script_paths for script in required_scripts):
        require(script_paths.index(ROOT / required_scripts[0]) < script_paths.index(ROOT / required_scripts[1]) <
                script_paths.index(ROOT / required_scripts[2]) < script_paths.index(ROOT / required_scripts[3]),
                f"{name}: GSAP, ScrollTrigger, main and scroll-motion must appear in dependency order")
    mains = document.by_tag("main")
    require(len(mains) == 1 and "data-drawing-area" in mains[0].attrs,
            f"{name}: main must declare the bounded drawing area")
    for node in document.nodes:
        classes = set(node.attrs.get("class", "").split())
        require(not classes.intersection({"will-reveal", "motion-ready"}), f"{name}: content must not ship prehidden for JS animation")
        if node.tag == "html":
            require("js" not in classes, f"{name}: js class must be applied only after initialization")
        if node.tag in {"main", "h1", "section"}:
            require("hidden" not in node.attrs and node.attrs.get("aria-hidden") != "true", f"{name}: essential content hidden by default")
            require(not re.search(r"(?:opacity\s*:\s*0(?:[;\s]|$)|visibility\s*:\s*hidden|display\s*:\s*none)", node.attrs.get("style", "")),
                    f"{name}: essential content must remain visible before JS")
    require(any(node.text().strip() for node in document.by_tag("h1")), f"{name}: static h1 missing")

home = documents.get("index.html")
if home:
    placements = [node for node in home.by_tag("img") if node.attrs.get("src", "").strip()]
    require(len(placements) == 10, f"Homepage requires exactly 10 actual image placements; found {len(placements)}")
    for slug, title in zip(SLUGS, TITLES):
        original = ROOT / f"assets/images/{slug}.jpg"
        anchors = [node for node in home.by_tag("a") if "data-lightbox" in node.attrs and
                   local_path(home.filename, node.attrs.get("href", "")) == original]
        require(len(anchors) == 1, f"Homepage needs one full-size lightbox anchor for {title}")
        require(any(local_path(home.filename, node.attrs.get("href", "")) == ROOT / f"artwork/{slug}.html"
                    for node in home.by_tag("a")), f"Homepage missing separate detail link for {title}")
        for anchor in anchors:
            require(anchor.attrs.get("data-title") == title, f"Homepage lightbox title mismatch: {title}")
            require(bool(anchor.attrs.get("data-description")), f"Homepage lightbox missing original description: {title}")
            require(not anchor.descendants("a") and not anchor.descendants("button"), f"Nested artwork controls: {title}")
            require(bool(anchor.descendants("img")), f"Homepage showcase missing artwork image: {title}")
    crops = {
        "anime-knight-armor-detail.webp": "Anime Knight",
        "fantasy-warrior-face-detail.webp": "Fantasy Warrior",
        "character-illustration-outfit-detail.webp": "Character Illustration",
    }
    for filename, title in crops.items():
        images = [node for node in placements if Path(urlsplit(node.attrs["src"]).path).name == filename]
        require(len(images) == 1, f"Homepage needs one labelled detail: {filename}")
        for node in images:
            figure = node.ancestor("figure")
            captions = figure.descendants("figcaption") if figure else []
            require(any("detail" in caption.text().casefold() and title in caption.text() for caption in captions),
                    f"Homepage crop must visibly identify Detail from {title}")
    for filename in ["studio-tools.svg", "paper-study.svg"]:
        require(sum(Path(urlsplit(node.attrs["src"]).path).name == filename for node in placements) == 1,
                f"Homepage must include one supporting interface illustration: {filename}")

source_count = 0
for name, document in documents.items():
    for source in document.by_tag("source"):
        if source.attrs.get("type") != "image/webp":
            continue
        source_count += 1
        require(bool(source.attrs.get("sizes")), f"{name}: responsive source needs sizes")
        found_widths = set()
        for candidate in source.attrs.get("srcset", "").split(","):
            match = re.fullmatch(r"\s*(\S+)\s+(\d+)w\s*", candidate)
            require(match is not None, f"{name}: invalid width descriptor in {candidate}")
            if not match:
                continue
            filename, width = local_path(document.filename, match[1]), int(match[2])
            found_widths.add(width)
            require(filename is not None and filename.is_file(), f"{name}: missing responsive asset {match[1]}")
            if filename and filename.is_file():
                try:
                    actual = webp_size(filename)
                    require(actual[0] == width, f"{name}: {match[1]} descriptor {width}w does not match actual width {actual[0]}")
                except ValueError as error:
                    require(False, f"{name}: {match[1]}: {error}")
        require({480, 800}.issubset(found_widths), f"{name}: full artwork source requires 480w and 800w variants")
require(source_count >= 11, "Responsive full-artwork sources missing from the page collection")

for slug, digest in zip(SLUGS, HASHES):
    filename = ROOT / f"assets/images/{slug}.jpg"
    require(filename.is_file() and sha256(filename.read_bytes()).hexdigest() == digest, f"Original artwork integrity failed: {slug}")

vendor = ROOT / "assets/vendor"
readme = (vendor / "README.md").read_text(encoding="utf-8") if (vendor / "README.md").is_file() else ""
for filename, label in [("gsap.min.js", "GSAP"), ("ScrollTrigger.min.js", "ScrollTrigger")]:
    path = vendor / filename
    require(path.is_file(), f"Missing local vendor file: {filename}")
    if path.is_file():
        header = path.read_text(encoding="utf-8")[:1000]
        require(f"{label} 3.13.0" in header, f"{filename}: expected pinned version 3.13.0")
        require("https://gsap.com/standard-license" in header, f"{filename}: upstream license header must remain intact")
    require(filename in readme and "3.13.0" in readme and "gsap.com" in readme,
            f"Vendor README needs version, official source and license provenance for {filename}")
three = vendor / "three.module.js"
require(three.is_file(), "Missing local Three.js module")
if three.is_file():
    require(re.search(r"REVISION\s*=\s*['\"]169['\"]", three.read_text(encoding="utf-8")) is not None,
            "Three.js revision must remain pinned to r169")
require((vendor / "THREE-LICENSE.txt").is_file() and "0.169.0" in readme, "Three.js version/license provenance missing")
require((ROOT / "assets/ASSETS.md").is_file(), "Missing artwork derivative and supporting illustration provenance")

for css_path in [ROOT / "assets/css/site.css", ROOT / "assets/css/motion.css"]:
    css = re.sub(r"/\*.*?\*/", "", css_path.read_text(encoding="utf-8"), flags=re.S)
    for selector, declarations in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        if not re.search(r"(?:\.reveal\b|data-depth-sheet|\.hero-copy\b|\.home-hero\b|\.package-sheet\b|\.detail-note\b)", selector):
            continue
        if any(guard in selector for guard in [".js", ".motion-ready", ".will-reveal", ":hover", ":focus"]):
            continue
        require(not re.search(r"(?:opacity\s*:\s*0(?:[;\s!]|$)|visibility\s*:\s*hidden|display\s*:\s*none)", declarations),
                f"{css_path.name}: essential content hidden by default in {selector.strip()}")

if errors:
    print(f"FAIL: {len(errors)} upgrade issue(s)")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)
print(f"PASS: {len(PAGES)} pages load local motion/cursor modules with correct relative paths;")
print(f"      10 homepage image placements, 4 complete artwork/lightbox/detail links, 3 labelled details,")
print(f"      {source_count} responsive sources, unchanged originals, pinned vendors and visible no-JS content checked.")

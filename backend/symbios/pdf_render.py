"""PDF rendering of the markdown dossier via WeasyPrint."""
from typing import Optional


_CSS = """
@page { size: A4; margin: 18mm 16mm; }
body { font-family: 'Helvetica', 'Arial', sans-serif; color: #111; font-size: 10.5pt; line-height: 1.45; }
h1 { font-size: 18pt; border-bottom: 2px solid #222; padding-bottom: 6px; margin-bottom: 12px; }
h2 { font-size: 13pt; margin-top: 18px; color: #1a1a1a; border-left: 4px solid #444; padding-left: 8px; }
h3 { font-size: 11pt; margin-top: 14px; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 9pt; }
th, td { border: 1px solid #aaa; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #eee; }
code { font-family: 'Courier New', monospace; font-size: 9pt; background: #f3f3f3; padding: 1px 3px; border-radius: 2px; }
blockquote { border-left: 3px solid #888; padding-left: 8px; color: #333; margin: 4px 0 8px; }
hr { border: 0; border-top: 1px solid #999; margin: 16px 0; }
ul { padding-left: 18px; }
"""


def render_pdf_from_markdown(md_text: str) -> Optional[bytes]:
    """Convert markdown text to PDF bytes. Returns None if libs missing."""
    try:
        import markdown2
        from weasyprint import HTML, CSS
    except ImportError:
        return None
    try:
        html_body = markdown2.markdown(
            md_text,
            extras=["tables", "fenced-code-blocks", "break-on-newline"],
        )
        full_html = f"<!doctype html><html><head><meta charset='utf-8'></head><body>{html_body}</body></html>"
        return HTML(string=full_html).write_pdf(stylesheets=[CSS(string=_CSS)])
    except Exception:
        return None

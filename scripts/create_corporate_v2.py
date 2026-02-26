#!/usr/bin/env python3
"""
Corporate Website mockup — v2.
Uses correct component property names:
  rectangle: fill, stroke, cornerRadius
  text:      content, fontSize, fontWeight, color, align
  button:    label, variant (primary|secondary|outline|ghost), size (sm|md|lg)
  image:     (no custom bg — wireframe X pattern always rendered)
  input:     placeholder, label (field label above input), type
"""
import json
import time
import urllib.request

SESSION_ID = "ffba88af-54d6-46c3-ad55-8abdfa7df1e0"
BASE_URL = "http://localhost:3200/mcp"
PROJECT_ID = "proj_kLIQ1BZw2L"

_id_counter = 600

def next_id():
    global _id_counter
    _id_counter += 1
    return _id_counter

def mcp_call(method, params):
    payload = {"jsonrpc": "2.0", "id": next_id(), "method": method, "params": params}
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        BASE_URL, data=body,
        headers={"Content-Type": "application/json",
                 "Accept": "application/json, text/event-stream",
                 "mcp-session-id": SESSION_ID},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        raw = resp.read().decode()
    for line in raw.splitlines():
        if line.startswith("data: "):
            return json.loads(line[6:]).get("result", {})
    return json.loads(raw.strip()).get("result", {})

def tool(name, args):
    result = mcp_call("tools/call", {"name": name, "arguments": args})
    content = result.get("content", [])
    if result.get("isError"):
        raise Exception(f"{name} error: {content[0]['text'] if content else '?'}")
    if content and content[0].get("type") == "text":
        try:
            return json.loads(content[0]["text"])
        except:
            return content[0]["text"]
    return result

def ms():
    return int(time.time() * 1000)

def add_screen(name):
    return tool("mockup_add_screen", {
        "project_id": PROJECT_ID, "name": name,
        "width": 1440, "height": 900, "background": "#FFFFFF", "style": "flat"
    })

def bulk(screen_id, elements):
    return tool("mockup_bulk_add_elements", {
        "project_id": PROJECT_ID, "screen_id": screen_id, "elements": elements
    })

def export_png(screen_id):
    return tool("mockup_export", {
        "project_id": PROJECT_ID, "screen_id": screen_id, "format": "png", "scale": 1
    })

# ──────────────────────────────────────────────────────────────
# ELEMENT HELPERS (correct props)
# ──────────────────────────────────────────────────────────────

def rect(x, y, w, h, fill="#F5F5F5", stroke="#DDDDDD", radius=0, z=0):
    return {"type": "rectangle", "x": x, "y": y, "width": w, "height": h, "z_index": z,
            "properties": {"fill": fill, "stroke": stroke, "cornerRadius": radius}}

def txt(x, y, w, h, content, color="#333333", size=16, weight="normal", align="left", z=0):
    return {"type": "text", "x": x, "y": y, "width": w, "height": h, "z_index": z,
            "properties": {"content": content, "color": color, "fontSize": size,
                           "fontWeight": weight, "align": align}}

def btn(x, y, w, h, label, variant="primary", size="md", z=0):
    return {"type": "button", "x": x, "y": y, "width": w, "height": h, "z_index": z,
            "properties": {"label": label, "variant": variant, "size": size}}

def inp(x, y, w, h, placeholder, field_label=None, z=0):
    props = {"placeholder": placeholder}
    if field_label:
        props["label"] = field_label
    return {"type": "input", "x": x, "y": y, "width": w, "height": h, "z_index": z,
            "properties": props}

def img(x, y, w, h, z=0):
    return {"type": "image", "x": x, "y": y, "width": w, "height": h, "z_index": z,
            "properties": {}}

# ──────────────────────────────────────────────────────────────
# SHARED SECTIONS
# ──────────────────────────────────────────────────────────────

NAVY  = "#1A1A2E"
INDIGO = "#4F46E5"
LIGHT_INDIGO = "#EEF2FF"
SLATE = "#64748B"
WHITE = "#FFFFFF"
LIGHT = "#F8FAFC"
BORDER = "#E2E8F0"

def navbar(active="Home"):
    items = [("Home", 502), ("About", 592), ("Services", 674), ("Portfolio", 764), ("Contact", 856)]
    els = [
        rect(0, 0, 1440, 60, fill=NAVY, stroke=NAVY, z=10),
        txt(48, 16, 180, 28, "Acme Corp", color=WHITE, size=20, weight="bold", z=11),
    ]
    for name, x in items:
        color = WHITE if name == active else "#A5B4FC"
        els.append(txt(x, 18, 80, 24, name, color=color, size=14, z=11))
    els.append(btn(1296, 14, 120, 32, "Get Started", variant="outline", size="sm", z=11))
    return els

def footer():
    return [
        rect(0, 840, 1440, 60, fill="#0F0F1A", stroke="#0F0F1A"),
        txt(48, 855, 160, 22, "Acme Corp", color=WHITE, size=16, weight="bold"),
        txt(480, 862, 480, 18, "© 2026 Acme Corp. All rights reserved.", color="#475569", size=13, align="center"),
        txt(1240, 862, 160, 18, "Privacy · Terms · Contact", color="#475569", size=12),
    ]

def hero(title, subtitle, y=60, h=240, bg=INDIGO):
    return [
        rect(0, y, 1440, h, fill=bg, stroke=bg),
        txt(200, y+56, 1040, 64, title, color=WHITE, size=44, weight="bold", align="center"),
        txt(320, y+132, 800, 52, subtitle, color="#C7D2FE", size=17, align="center"),
    ]

# ──────────────────────────────────────────────────────────────
# PAGE 1: HOME
# ──────────────────────────────────────────────────────────────

def home_elements():
    els = navbar("Home")
    # Hero with CTAs
    els += [
        rect(0, 60, 1440, 340, fill=INDIGO, stroke=INDIGO),
        txt(200, 124, 1040, 72, "Build Better Products Faster",
            color=WHITE, size=52, weight="bold", align="center"),
        txt(320, 208, 800, 56, "We help businesses transform their digital presence with cutting-edge solutions.",
            color="#C7D2FE", size=18, align="center"),
        btn(556, 290, 168, 48, "Start Free Trial", variant="ghost", size="lg"),
        btn(736, 290, 152, 48, "Learn More", variant="outline", size="lg"),
    ]
    # 3 feature cards
    card_data = [
        (48,  424, "Lightning Fast",
         "Deploy your apps in minutes, not hours. Infrastructure scales automatically."),
        (512, 424, "Enterprise Security",
         "Bank-grade encryption and SOC2 compliance keeps your data safe 24/7."),
        (976, 424, "Advanced Analytics",
         "Real-time dashboards give you actionable insights to grow the business."),
    ]
    for x, y, title, desc in card_data:
        els += [
            rect(x, y, 416, 200, fill=LIGHT, stroke=BORDER, radius=10),
            txt(x+24, y+20, 368, 28, title, color=NAVY, size=18, weight="bold"),
            txt(x+24, y+56, 368, 80, desc, color=SLATE, size=14),
            txt(x+24, y+152, 140, 24, "Learn more →", color=INDIGO, size=14),
        ]
    # Stats bar
    els.append(rect(0, 652, 1440, 152, fill=LIGHT_INDIGO, stroke=LIGHT_INDIGO))
    stats = [("500+", "Clients", 176), ("99.9%", "Uptime SLA", 512),
             ("10x", "Faster Deploy", 848), ("24/7", "Expert Support", 1152)]
    for val, lbl, x in stats:
        els += [
            txt(x, 676, 176, 52, val, color=INDIGO, size=36, weight="bold", align="center"),
            txt(x, 732, 176, 24, lbl, color=SLATE, size=14, align="center"),
        ]
    els += footer()
    return els

# ──────────────────────────────────────────────────────────────
# PAGE 2: ABOUT
# ──────────────────────────────────────────────────────────────

def about_elements():
    els = navbar("About")
    els += hero("Our Story",
                "Founded in 2015, Acme Corp has been helping businesses succeed in the digital age.",
                y=60, h=220, bg="#312E81")
    # Story section
    els += [
        rect(0, 280, 1440, 264, fill=WHITE, stroke=WHITE),
        img(48, 296, 520, 224),
        txt(608, 296, 784, 36, "Who We Are", color=NAVY, size=26, weight="bold"),
        txt(608, 344, 784, 72,
            "Acme Corp was founded with a simple mission: make enterprise-grade technology "
            "accessible to businesses of all sizes. Today we serve 500+ clients in 40 countries.",
            color=SLATE, size=15),
        txt(608, 428, 784, 64,
            "Our team of 120+ engineers and designers work to build products that matter. "
            "We believe in open collaboration, continuous learning, and customer obsession.",
            color=SLATE, size=15),
    ]
    # Team section header
    els.append(txt(0, 560, 1440, 40, "Meet the Team", color=NAVY, size=26, weight="bold", align="center"))
    team = [
        ("Sarah Chen",      "CEO & Co-Founder", 144),
        ("Marcus Williams", "CTO & Co-Founder", 448),
        ("Priya Patel",     "Head of Design",   752),
        ("James Rodriguez", "VP Engineering",   1056),
    ]
    for name, role, x in team:
        els += [
            rect(x, 616, 192, 8, fill="#C7D2FE", stroke="#C7D2FE", radius=4),  # color accent
            img(x, 624, 192, 148),
            txt(x, 780, 192, 24, name, color=NAVY, size=15, weight="bold", align="center"),
            txt(x, 808, 192, 20, role, color=SLATE, size=13, align="center"),
        ]
    els += footer()
    return els

# ──────────────────────────────────────────────────────────────
# PAGE 3: SERVICES
# ──────────────────────────────────────────────────────────────

def services_elements():
    els = navbar("Services")
    els += hero("Our Services",
                "End-to-end solutions tailored to accelerate your digital transformation.",
                y=60, h=220, bg="#065F46")
    svc_data = [
        (48,  "Cloud Infrastructure",  "From $299/mo",
         "Scalable, resilient cloud architecture on AWS, GCP, or Azure. 99.9% uptime SLA.",
         ["Multi-cloud support", "Auto-scaling", "24/7 monitoring", "DDoS protection"]),
        (496, "Product Development",   "From $4,999/mo",
         "Full-cycle development from idea to launch. Agile teams deliver on time and budget.",
         ["Agile sprints", "UI/UX design", "QA & testing", "Post-launch support"]),
        (944, "Data & Analytics",      "From $1,499/mo",
         "Transform raw data into actionable insights. Real-time dashboards and ML at scale.",
         ["Real-time dashboards", "ML & AI models", "Data pipelines", "Custom reports"]),
    ]
    for x, title, price, desc, features in svc_data:
        els += [
            rect(x, 296, 400, 368, fill=WHITE, stroke=BORDER, radius=10),
            txt(x+24, 316, 352, 32, title, color=NAVY, size=20, weight="bold"),
            txt(x+24, 352, 200, 28, price, color="#059669", size=17, weight="bold"),
            txt(x+24, 388, 352, 72, desc, color=SLATE, size=14),
        ]
        for i, feat in enumerate(features):
            els.append(txt(x+24, 472+i*28, 352, 24, f"✓  {feat}", color="#059669", size=14))
        els.append(btn(x+24, 620, 352, 40, "Get Started", variant="secondary", size="md"))
    # CTA section
    els += [
        rect(0, 688, 1440, 136, fill="#ECFDF5", stroke="#ECFDF5"),
        txt(200, 708, 1040, 40, "Not sure which plan fits you?",
            color="#065F46", size=26, weight="bold", align="center"),
        txt(320, 756, 800, 28,
            "Talk to our experts — free 30-minute consultation, no strings attached.",
            color="#047857", size=16, align="center"),
        btn(600, 790, 240, 40, "Book a Free Call", variant="secondary", size="md"),
    ]
    els += footer()
    return els

# ──────────────────────────────────────────────────────────────
# PAGE 4: PORTFOLIO
# ──────────────────────────────────────────────────────────────

def portfolio_elements():
    els = navbar("Portfolio")
    els += hero("Our Work",
                "A selection of projects we are proud of — from startups to Fortune 500 companies.",
                y=60, h=220, bg="#7C3AED")
    projects = [
        ("FinTech Dashboard",    "Data Analytics",  48,  296),
        ("HealthCare Portal",    "Product Dev",    512,  296),
        ("E-Commerce Platform",  "Cloud + Dev",    976,  296),
        ("Logistics Tracker",    "Mobile App",      48,  560),
        ("EdTech LMS",           "Product Dev",    512,  560),
        ("AI Analytics Suite",   "Data + AI",      976,  560),
    ]
    for title, cat, x, y in projects:
        els += [
            rect(x, y, 416, 240, fill=LIGHT, stroke=BORDER, radius=10),
            img(x+16, y+16, 384, 152),
            txt(x+16, y+176, 260, 24, title, color=NAVY, size=15, weight="bold"),
            txt(x+296, y+180, 104, 18, cat, color="#7C3AED", size=12, align="right"),
            txt(x+16, y+208, 160, 20, "View Case Study →", color=INDIGO, size=13),
        ]
    els += footer()
    return els

# ──────────────────────────────────────────────────────────────
# PAGE 5: CONTACT
# ──────────────────────────────────────────────────────────────

def contact_elements():
    els = navbar("Contact")
    els += hero("Get In Touch",
                "Have a project in mind? We would love to hear from you.",
                y=60, h=196, bg="#BE185D")
    # Form card
    els += [
        rect(80, 272, 672, 536, fill=WHITE, stroke=BORDER, radius=12),
        txt(112, 296, 608, 32, "Send Us a Message", color=NAVY, size=21, weight="bold"),
        inp(112, 344, 608, 48, "John Doe", field_label="Full Name"),
        inp(112, 432, 608, 48, "john@example.com", field_label="Email Address"),
        inp(112, 520, 608, 48, "How can we help?", field_label="Subject"),
        txt(112, 600, 200, 20, "Message", color="#374151", size=14, weight="bold"),
        rect(112, 624, 608, 128, fill="#F9FAFB", stroke="#D1D5DB", radius=6),
        txt(124, 636, 584, 104, "Tell us about your project, goals, and timeline...",
            color="#9CA3AF", size=14),
        btn(112, 764, 608, 44, "Send Message", variant="primary", size="lg"),
    ]
    # Map placeholder
    els += [
        img(800, 272, 560, 332),
        rect(800, 616, 560, 192, fill=WHITE, stroke=BORDER, radius=12),
        txt(824, 636, 512, 24, "Contact Information", color=NAVY, size=17, weight="bold"),
        txt(824, 668, 512, 20, "hello@acmecorp.com", color=SLATE, size=14),
        txt(824, 696, 512, 20, "+1 (415) 555-0192", color=SLATE, size=14),
        txt(824, 724, 512, 20, "123 Innovation Drive, San Francisco, CA 94105", color=SLATE, size=14),
        txt(824, 752, 512, 20, "Mon-Fri, 9 AM to 6 PM PST", color=SLATE, size=14),
        txt(824, 780, 512, 20, "Response time: within 1 business day", color=SLATE, size=14),
    ]
    els += footer()
    return els

# ──────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────

PAGES = [
    (1, "Home",      home_elements),
    (2, "About",     about_elements),
    (3, "Services",  services_elements),
    (4, "Portfolio", portfolio_elements),
    (5, "Contact",   contact_elements),
]

results = []

print("=" * 70)
print("CORPORATE WEBSITE v2 — Correct component props")
print(f"Project: {PROJECT_ID}")
print("=" * 70)

for idx, name, fn in PAGES:
    print(f"\n[{idx}/5] {name}")

    t0 = ms()
    screen = add_screen(name)
    screen_id = screen["id"]
    elements = fn()
    num_el = len(elements)
    bulk(screen_id, elements)
    t1 = ms()
    creation = t1 - t0
    print(f"  Created: {screen_id} | {num_el} elements | {creation} ms")

    print(f"  Exporting PNG...")
    te0 = ms()
    try:
        export_png(screen_id)
        te1 = ms()
        exp_ms = te1 - te0
        print(f"  Export: {exp_ms} ms")
    except Exception as e:
        te1 = ms()
        exp_ms = -(te1 - te0)
        print(f"  Export FAILED: {e}")

    results.append({"idx": idx, "name": name, "screen_id": screen_id,
                    "creation_ms": creation, "num_elements": num_el, "export_ms": exp_ms})

# Summary
print("\n" + "=" * 74)
print("WYNIKI — Corporate Website Mockup")
print("=" * 74)
print(f"{'#':<3} {'Strona':<14} {'Tworzenie (ms)':<17} {'Elementow':<11} {'Export PNG (ms)'}")
print("-" * 74)

tot_c = tot_e = tot_n = 0
for r in results:
    exp = str(r["export_ms"]) if r["export_ms"] >= 0 else "FAIL"
    print(f"{r['idx']:<3} {r['name']:<14} {r['creation_ms']:<17} {r['num_elements']:<11} {exp}")
    tot_c += r["creation_ms"]
    if r["export_ms"] >= 0:
        tot_e += r["export_ms"]
    tot_n += r["num_elements"]

print("-" * 74)
print(f"{'TOT':<3} {'':<14} {tot_c:<17} {tot_n:<11} {tot_e}")
print(f"{'AVG':<3} {'':<14} {tot_c//5:<17} {tot_n//5:<11} {tot_e//5}")
print(f"\nGrand total: {tot_c + tot_e} ms  ({(tot_c + tot_e)/1000:.2f} s)")
print(f"\nScreen IDs:")
for r in results:
    print(f"  {r['name']}: {r['screen_id']}")
print(f"\nPreview: http://localhost:3100")
print("=" * 74)

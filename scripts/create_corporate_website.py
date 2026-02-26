#!/usr/bin/env python3
"""
Corporate Website mockup creation script.
Measures time for each screen creation and PNG export.
"""
import json
import time
import urllib.request
import urllib.error

SESSION_ID = "ffba88af-54d6-46c3-ad55-8abdfa7df1e0"
BASE_URL = "http://localhost:3200/mcp"
PROJECT_ID = "proj_oUwIukpLme"

_id_counter = 100

def next_id():
    global _id_counter
    _id_counter += 1
    return _id_counter

def mcp_call(method, params):
    """Call MCP tool and return parsed result."""
    payload = {
        "jsonrpc": "2.0",
        "id": next_id(),
        "method": method,
        "params": params
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        BASE_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "mcp-session-id": SESSION_ID
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        raw = resp.read().decode()

    # Parse SSE or plain JSON
    result_text = ""
    for line in raw.splitlines():
        if line.startswith("data: "):
            result_text = line[6:]
            break
    if not result_text:
        result_text = raw.strip()

    data = json.loads(result_text)
    if "error" in data:
        raise Exception(f"MCP error: {data['error']}")
    return data.get("result", {})

def tool_call(tool_name, arguments):
    result = mcp_call("tools/call", {"name": tool_name, "arguments": arguments})
    content = result.get("content", [])
    if result.get("isError"):
        raise Exception(f"Tool error in {tool_name}: {content[0]['text'] if content else 'unknown'}")
    if content and content[0].get("type") == "text":
        try:
            return json.loads(content[0]["text"])
        except:
            return content[0]["text"]
    return result

def ms():
    return int(time.time() * 1000)

def create_screen(name, width=1440, height=900, background="#FFFFFF", style="flat"):
    return tool_call("mockup_add_screen", {
        "project_id": PROJECT_ID,
        "name": name,
        "width": width,
        "height": height,
        "background": background,
        "style": style
    })

def bulk_add(screen_id, elements):
    return tool_call("mockup_bulk_add_elements", {
        "project_id": PROJECT_ID,
        "screen_id": screen_id,
        "elements": elements
    })

def export_png(screen_id):
    return tool_call("mockup_export", {
        "project_id": PROJECT_ID,
        "screen_id": screen_id,
        "format": "png",
        "scale": 1
    })

# ============================================================
# SCREEN DEFINITIONS
# ============================================================

# Common navbar elements (reused across pages)
def navbar_elements(active_item="Home"):
    items = ["Home", "About", "Services", "Portfolio", "Contact"]
    x_positions = [500, 590, 670, 760, 850]
    elems = [
        {"type": "rectangle", "x": 0, "y": 0, "width": 1440, "height": 60,
         "properties": {"label": "", "backgroundColor": "#1A1A2E"}, "z_index": 10},
        {"type": "text", "x": 48, "y": 16, "width": 150, "height": 28,
         "properties": {"label": "Acme Corp", "color": "#FFFFFF", "fontSize": 22, "fontWeight": "bold"}, "z_index": 11},
    ]
    for i, (item, xp) in enumerate(zip(items, x_positions)):
        color = "#FFFFFF" if item == active_item else "#A5B4FC"
        elems.append({
            "type": "text", "x": xp, "y": 18, "width": 72, "height": 24,
            "properties": {"label": item, "color": color, "fontSize": 15}, "z_index": 11
        })
    elems.append({
        "type": "button", "x": 1296, "y": 14, "width": 120, "height": 32,
        "properties": {"label": "Get Started", "color": "#FFFFFF", "backgroundColor": "#4F46E5", "fontSize": 14},
        "z_index": 11
    })
    return elems

def footer_elements():
    return [
        {"type": "rectangle", "x": 0, "y": 840, "width": 1440, "height": 60,
         "properties": {"label": "", "backgroundColor": "#0F0F1A"}},
        {"type": "text", "x": 48, "y": 855, "width": 160, "height": 22,
         "properties": {"label": "Acme Corp", "color": "#FFFFFF", "fontSize": 16, "fontWeight": "bold"}},
        {"type": "text", "x": 480, "y": 860, "width": 480, "height": 18,
         "properties": {"label": "© 2026 Acme Corp. All rights reserved.", "color": "#64748B", "fontSize": 13, "textAlign": "center"}},
        {"type": "text", "x": 1240, "y": 860, "width": 152, "height": 18,
         "properties": {"label": "Privacy · Terms · Contact", "color": "#64748B", "fontSize": 13}},
    ]

def section_hero(title, subtitle, y=60, height=280, bg="#4F46E5"):
    return [
        {"type": "rectangle", "x": 0, "y": y, "width": 1440, "height": height,
         "properties": {"label": "", "backgroundColor": bg}},
        {"type": "text", "x": 240, "y": y + 70, "width": 960, "height": 64,
         "properties": {"label": title, "color": "#FFFFFF", "fontSize": 48, "fontWeight": "bold", "textAlign": "center"}},
        {"type": "text", "x": 360, "y": y + 148, "width": 720, "height": 48,
         "properties": {"label": subtitle, "color": "#C7D2FE", "fontSize": 18, "textAlign": "center"}},
    ]

# ============================================================
# PAGE 1: HOME
# ============================================================
def home_elements():
    elems = navbar_elements("Home")
    # Hero section
    elems += [
        {"type": "rectangle", "x": 0, "y": 60, "width": 1440, "height": 340,
         "properties": {"label": "", "backgroundColor": "#4F46E5"}},
        {"type": "text", "x": 240, "y": 130, "width": 960, "height": 72,
         "properties": {"label": "Build Better Products Faster", "color": "#FFFFFF", "fontSize": 52, "fontWeight": "bold", "textAlign": "center"}},
        {"type": "text", "x": 360, "y": 218, "width": 720, "height": 56,
         "properties": {"label": "We help businesses transform their digital presence with cutting-edge solutions and expert consulting.", "color": "#C7D2FE", "fontSize": 18, "textAlign": "center"}},
        {"type": "button", "x": 568, "y": 296, "width": 160, "height": 48,
         "properties": {"label": "Start Free Trial", "color": "#4F46E5", "backgroundColor": "#FFFFFF", "fontSize": 16}},
        {"type": "button", "x": 744, "y": 296, "width": 144, "height": 48,
         "properties": {"label": "Learn More", "color": "#FFFFFF", "backgroundColor": "#6366F1", "fontSize": 16}},
    ]
    # Feature cards
    cards = [
        {"icon": "Rocket", "title": "Lightning Fast", "desc": "Deploy in minutes with auto-scaling infrastructure that grows with your needs.", "x": 48},
        {"icon": "Shield", "title": "Enterprise Security", "desc": "Bank-grade encryption and SOC2 compliance keeps your data safe 24/7.", "x": 512},
        {"icon": "BarChart2", "title": "Advanced Analytics", "desc": "Real-time dashboards give you insights to make data-driven decisions.", "x": 976},
    ]
    for card in cards:
        elems += [
            {"type": "rectangle", "x": card["x"], "y": 424, "width": 416, "height": 208,
             "properties": {"label": "", "backgroundColor": "#F8FAFC", "borderRadius": 12}},
            {"type": "text", "x": card["x"] + 24, "y": 444, "width": 368, "height": 32,
             "properties": {"label": card["title"], "color": "#1A1A2E", "fontSize": 20, "fontWeight": "bold"}},
            {"type": "text", "x": card["x"] + 24, "y": 484, "width": 368, "height": 72,
             "properties": {"label": card["desc"], "color": "#64748B", "fontSize": 15}},
            {"type": "text", "x": card["x"] + 24, "y": 572, "width": 120, "height": 28,
             "properties": {"label": "Learn more →", "color": "#4F46E5", "fontSize": 14}},
        ]
    # Stats row
    stats = [
        {"val": "500+", "lbl": "Clients Worldwide", "x": 192},
        {"val": "99.9%", "lbl": "Uptime SLA", "x": 528},
        {"val": "10x", "lbl": "Faster Deployment", "x": 864},
        {"val": "24/7", "lbl": "Expert Support", "x": 1152},
    ]
    elems.append({"type": "rectangle", "x": 0, "y": 660, "width": 1440, "height": 152,
                  "properties": {"label": "", "backgroundColor": "#EEF2FF"}})
    for s in stats:
        elems += [
            {"type": "text", "x": s["x"], "y": 688, "width": 160, "height": 48,
             "properties": {"label": s["val"], "color": "#4F46E5", "fontSize": 36, "fontWeight": "bold", "textAlign": "center"}},
            {"type": "text", "x": s["x"], "y": 740, "width": 160, "height": 24,
             "properties": {"label": s["lbl"], "color": "#64748B", "fontSize": 14, "textAlign": "center"}},
        ]
    elems += footer_elements()
    return elems

# ============================================================
# PAGE 2: ABOUT
# ============================================================
def about_elements():
    elems = navbar_elements("About")
    elems += section_hero(
        "Our Story",
        "Founded in 2015, Acme Corp has been helping businesses succeed in the digital age.",
        y=60, height=220, bg="#312E81"
    )
    # Our Story section
    elems += [
        {"type": "rectangle", "x": 0, "y": 280, "width": 1440, "height": 260,
         "properties": {"label": "", "backgroundColor": "#FFFFFF"}},
        {"type": "image", "x": 48, "y": 300, "width": 520, "height": 220,
         "properties": {"label": "Company HQ Photo", "backgroundColor": "#E2E8F0"}},
        {"type": "text", "x": 608, "y": 300, "width": 784, "height": 36,
         "properties": {"label": "Who We Are", "color": "#1A1A2E", "fontSize": 28, "fontWeight": "bold"}},
        {"type": "text", "x": 608, "y": 348, "width": 784, "height": 80,
         "properties": {"label": "Acme Corp was founded with a simple mission: make enterprise-grade technology accessible to businesses of all sizes. Today we serve 500+ clients across 40 countries.", "color": "#475569", "fontSize": 16}},
        {"type": "text", "x": 608, "y": 444, "width": 784, "height": 64,
         "properties": {"label": "Our team of 120+ engineers and designers work tirelessly to build products that matter. We believe in open collaboration, continuous learning, and customer obsession.", "color": "#475569", "fontSize": 16}},
    ]
    # Team grid
    elems.append({"type": "text", "x": 0, "y": 556, "width": 1440, "height": 40,
                   "properties": {"label": "Meet the Team", "color": "#1A1A2E", "fontSize": 28, "fontWeight": "bold", "textAlign": "center"}})
    team = [
        {"name": "Sarah Chen", "role": "CEO & Co-Founder", "x": 144},
        {"name": "Marcus Williams", "role": "CTO & Co-Founder", "x": 464},
        {"name": "Priya Patel", "role": "Head of Design", "x": 784},
        {"name": "James Rodriguez", "role": "VP Engineering", "x": 1104},
    ]
    for p in team:
        elems += [
            {"type": "image", "x": p["x"], "y": 608, "width": 192, "height": 160,
             "properties": {"label": p["name"], "backgroundColor": "#C7D2FE", "borderRadius": 8}},
            {"type": "text", "x": p["x"], "y": 776, "width": 192, "height": 24,
             "properties": {"label": p["name"], "color": "#1A1A2E", "fontSize": 16, "fontWeight": "bold", "textAlign": "center"}},
            {"type": "text", "x": p["x"], "y": 804, "width": 192, "height": 20,
             "properties": {"label": p["role"], "color": "#64748B", "fontSize": 13, "textAlign": "center"}},
        ]
    elems += footer_elements()
    return elems

# ============================================================
# PAGE 3: SERVICES
# ============================================================
def services_elements():
    elems = navbar_elements("Services")
    elems += section_hero(
        "Our Services",
        "End-to-end solutions tailored to accelerate your digital transformation journey.",
        y=60, height=220, bg="#065F46"
    )
    services = [
        {"title": "Cloud Infrastructure", "price": "From $299/mo",
         "desc": "Scalable, resilient cloud architecture on AWS, GCP, or Azure. Auto-scaling, load balancing, and 99.9% uptime SLA included.",
         "features": ["Multi-cloud support", "Auto-scaling", "24/7 monitoring", "DDoS protection"],
         "x": 48},
        {"title": "Product Development", "price": "From $4,999/mo",
         "desc": "Full-cycle product development from idea to launch. Our agile teams deliver high-quality software on time and on budget.",
         "features": ["Agile sprints", "UI/UX design", "QA & testing", "Post-launch support"],
         "x": 496},
        {"title": "Data & Analytics", "price": "From $1,499/mo",
         "desc": "Transform your raw data into actionable insights. Real-time dashboards, ML models, and predictive analytics at scale.",
         "features": ["Real-time dashboards", "ML & AI models", "Data pipelines", "Custom reports"],
         "x": 944},
    ]
    for svc in services:
        elems += [
            {"type": "rectangle", "x": svc["x"], "y": 296, "width": 400, "height": 360,
             "properties": {"label": "", "backgroundColor": "#FFFFFF", "borderRadius": 12,
                            "borderColor": "#E2E8F0", "borderWidth": 1}},
            {"type": "text", "x": svc["x"] + 24, "y": 316, "width": 352, "height": 32,
             "properties": {"label": svc["title"], "color": "#1A1A2E", "fontSize": 22, "fontWeight": "bold"}},
            {"type": "text", "x": svc["x"] + 24, "y": 352, "width": 200, "height": 28,
             "properties": {"label": svc["price"], "color": "#059669", "fontSize": 18, "fontWeight": "bold"}},
            {"type": "text", "x": svc["x"] + 24, "y": 392, "width": 352, "height": 80,
             "properties": {"label": svc["desc"], "color": "#475569", "fontSize": 14}},
        ]
        for j, feat in enumerate(svc["features"]):
            elems.append({
                "type": "text", "x": svc["x"] + 24, "y": 488 + j * 28, "width": 352, "height": 24,
                "properties": {"label": f"✓  {feat}", "color": "#059669", "fontSize": 14}
            })
        elems.append({
            "type": "button", "x": svc["x"] + 24, "y": 616, "width": 352, "height": 40,
            "properties": {"label": "Get Started", "color": "#FFFFFF", "backgroundColor": "#059669", "fontSize": 15}
        })
    # CTA section
    elems += [
        {"type": "rectangle", "x": 0, "y": 680, "width": 1440, "height": 144,
         "properties": {"label": "", "backgroundColor": "#ECFDF5"}},
        {"type": "text", "x": 240, "y": 700, "width": 960, "height": 40,
         "properties": {"label": "Not sure which plan fits you?", "color": "#065F46", "fontSize": 28, "fontWeight": "bold", "textAlign": "center"}},
        {"type": "text", "x": 360, "y": 748, "width": 720, "height": 28,
         "properties": {"label": "Talk to our experts — free 30-minute consultation, no strings attached.", "color": "#047857", "fontSize": 16, "textAlign": "center"}},
        {"type": "button", "x": 600, "y": 784, "width": 240, "height": 40,
         "properties": {"label": "Book a Free Call", "color": "#FFFFFF", "backgroundColor": "#059669", "fontSize": 16}},
    ]
    elems += footer_elements()
    return elems

# ============================================================
# PAGE 4: PORTFOLIO
# ============================================================
def portfolio_elements():
    elems = navbar_elements("Portfolio")
    elems += section_hero(
        "Our Work",
        "A selection of projects we're proud of — from startups to Fortune 500 companies.",
        y=60, height=220, bg="#7C3AED"
    )
    projects = [
        {"title": "FinTech Dashboard", "cat": "Data Analytics", "color": "#DBEAFE", "x": 48, "y": 296},
        {"title": "HealthCare Portal", "cat": "Product Dev", "color": "#DCF5E7", "x": 512, "y": 296},
        {"title": "E-Commerce Platform", "cat": "Cloud + Dev", "color": "#FEF3C7", "x": 976, "y": 296},
        {"title": "Logistics Tracker", "cat": "Mobile App", "color": "#FCE7F3", "x": 48, "y": 564},
        {"title": "EdTech Learning LMS", "cat": "Product Dev", "color": "#EDE9FE", "x": 512, "y": 564},
        {"title": "AI Analytics Suite", "cat": "Data + AI", "color": "#CFFAFE", "x": 976, "y": 564},
    ]
    for p in projects:
        elems += [
            {"type": "rectangle", "x": p["x"], "y": p["y"], "width": 416, "height": 228,
             "properties": {"label": "", "backgroundColor": "#F8FAFC", "borderRadius": 10}},
            {"type": "image", "x": p["x"] + 16, "y": p["y"] + 16, "width": 384, "height": 152,
             "properties": {"label": p["title"], "backgroundColor": p["color"]}},
            {"type": "text", "x": p["x"] + 16, "y": p["y"] + 176, "width": 256, "height": 24,
             "properties": {"label": p["title"], "color": "#1A1A2E", "fontSize": 16, "fontWeight": "bold"}},
            {"type": "text", "x": p["x"] + 280, "y": p["y"] + 179, "width": 120, "height": 18,
             "properties": {"label": p["cat"], "color": "#7C3AED", "fontSize": 12, "textAlign": "right"}},
        ]
    elems += footer_elements()
    return elems

# ============================================================
# PAGE 5: CONTACT
# ============================================================
def contact_elements():
    elems = navbar_elements("Contact")
    elems += section_hero(
        "Get In Touch",
        "Have a project in mind? We'd love to hear from you. Send us a message!",
        y=60, height=196, bg="#BE185D"
    )
    # Contact form
    elems += [
        {"type": "rectangle", "x": 80, "y": 272, "width": 672, "height": 528,
         "properties": {"label": "", "backgroundColor": "#FFFFFF", "borderRadius": 12,
                        "borderColor": "#E2E8F0", "borderWidth": 1}},
        {"type": "text", "x": 112, "y": 296, "width": 608, "height": 32,
         "properties": {"label": "Send Us a Message", "color": "#1A1A2E", "fontSize": 22, "fontWeight": "bold"}},
        # Name field
        {"type": "text", "x": 112, "y": 344, "width": 200, "height": 20,
         "properties": {"label": "Full Name *", "color": "#374151", "fontSize": 14, "fontWeight": "bold"}},
        {"type": "input", "x": 112, "y": 368, "width": 608, "height": 48,
         "properties": {"label": "John Doe", "color": "#9CA3AF", "fontSize": 15,
                        "backgroundColor": "#F9FAFB", "borderColor": "#D1D5DB"}},
        # Email field
        {"type": "text", "x": 112, "y": 432, "width": 200, "height": 20,
         "properties": {"label": "Email Address *", "color": "#374151", "fontSize": 14, "fontWeight": "bold"}},
        {"type": "input", "x": 112, "y": 456, "width": 608, "height": 48,
         "properties": {"label": "john@example.com", "color": "#9CA3AF", "fontSize": 15,
                        "backgroundColor": "#F9FAFB", "borderColor": "#D1D5DB"}},
        # Subject field
        {"type": "text", "x": 112, "y": 520, "width": 200, "height": 20,
         "properties": {"label": "Subject", "color": "#374151", "fontSize": 14, "fontWeight": "bold"}},
        {"type": "input", "x": 112, "y": 544, "width": 608, "height": 48,
         "properties": {"label": "How can we help?", "color": "#9CA3AF", "fontSize": 15,
                        "backgroundColor": "#F9FAFB", "borderColor": "#D1D5DB"}},
        # Message textarea
        {"type": "text", "x": 112, "y": 608, "width": 200, "height": 20,
         "properties": {"label": "Message *", "color": "#374151", "fontSize": 14, "fontWeight": "bold"}},
        {"type": "rectangle", "x": 112, "y": 632, "width": 608, "height": 120,
         "properties": {"label": "Tell us about your project...", "backgroundColor": "#F9FAFB",
                        "borderRadius": 6, "borderColor": "#D1D5DB", "borderWidth": 1, "color": "#9CA3AF"}},
        {"type": "button", "x": 112, "y": 768, "width": 608, "height": 48,
         "properties": {"label": "Send Message", "color": "#FFFFFF", "backgroundColor": "#BE185D", "fontSize": 16}},
    ]
    # Map placeholder
    elems += [
        {"type": "rectangle", "x": 800, "y": 272, "width": 560, "height": 340,
         "properties": {"label": "", "backgroundColor": "#E2E8F0", "borderRadius": 12}},
        {"type": "image", "x": 800, "y": 272, "width": 560, "height": 340,
         "properties": {"label": "📍 Map — 123 Innovation Drive, San Francisco CA", "backgroundColor": "#CBD5E1"}},
        # Contact info
        {"type": "rectangle", "x": 800, "y": 624, "width": 560, "height": 176,
         "properties": {"label": "", "backgroundColor": "#FFFFFF", "borderRadius": 12,
                        "borderColor": "#E2E8F0", "borderWidth": 1}},
        {"type": "text", "x": 824, "y": 640, "width": 512, "height": 24,
         "properties": {"label": "Contact Information", "color": "#1A1A2E", "fontSize": 18, "fontWeight": "bold"}},
        {"type": "text", "x": 824, "y": 672, "width": 512, "height": 20,
         "properties": {"label": "📧  hello@acmecorp.com", "color": "#475569", "fontSize": 14}},
        {"type": "text", "x": 824, "y": 700, "width": 512, "height": 20,
         "properties": {"label": "📞  +1 (415) 555-0192", "color": "#475569", "fontSize": 14}},
        {"type": "text", "x": 824, "y": 728, "width": 512, "height": 20,
         "properties": {"label": "📍  123 Innovation Drive, San Francisco, CA 94105", "color": "#475569", "fontSize": 14}},
        {"type": "text", "x": 824, "y": 756, "width": 512, "height": 20,
         "properties": {"label": "🕐  Mon–Fri, 9 AM – 6 PM PST", "color": "#475569", "fontSize": 14}},
    ]
    elems += footer_elements()
    return elems


# ============================================================
# MAIN EXECUTION
# ============================================================
pages = [
    ("Home",      home_elements),
    ("About",     about_elements),
    ("Services",  services_elements),
    ("Portfolio", portfolio_elements),
    ("Contact",   contact_elements),
]

results = []

print("=" * 60)
print("CORPORATE WEBSITE — MockupMCP")
print(f"Project: {PROJECT_ID}")
print("=" * 60)

screen_ids = {}

for idx, (name, elements_fn) in enumerate(pages, 1):
    print(f"\n[{idx}/5] Creating screen: {name}")

    # Measure screen creation time
    t_start = ms()

    # Step 1: Create screen
    screen = create_screen(name)
    screen_id = screen["id"]
    screen_ids[name] = screen_id
    print(f"  Screen created: {screen_id}")

    # Step 2: Build elements
    elements = elements_fn()
    num_elements = len(elements)

    # Step 3: Bulk add elements
    bulk_add(screen_id, elements)

    t_end = ms()
    creation_time = t_end - t_start

    print(f"  Elements: {num_elements}")
    print(f"  Creation time: {creation_time} ms")

    # Step 4: Export PNG (measured separately)
    print(f"  Exporting PNG...")
    t_exp_start = ms()
    export_result = export_png(screen_id)
    t_exp_end = ms()
    export_time = t_exp_end - t_exp_start

    print(f"  Export time: {export_time} ms")

    results.append({
        "idx": idx,
        "name": name,
        "screen_id": screen_id,
        "creation_ms": creation_time,
        "num_elements": num_elements,
        "export_ms": export_time,
    })

# ============================================================
# SUMMARY TABLE
# ============================================================
print("\n" + "=" * 70)
print("RESULTS")
print("=" * 70)
print(f"{'#':<3} {'Page':<14} {'Creation (ms)':<16} {'Elements':<10} {'Export PNG (ms)':<16}")
print("-" * 70)

total_creation = 0
total_export = 0
total_elements = 0

for r in results:
    print(f"{r['idx']:<3} {r['name']:<14} {r['creation_ms']:<16} {r['num_elements']:<10} {r['export_ms']:<16}")
    total_creation += r["creation_ms"]
    total_export += r["export_ms"]
    total_elements += r["num_elements"]

print("-" * 70)
total_time = total_creation + total_export
avg_creation = total_creation // 5
avg_export = total_export // 5

print(f"{'TOTAL':<3} {'':<14} {total_creation:<16} {total_elements:<10} {total_export:<16}")
print(f"{'AVG':<3} {'':<14} {avg_creation:<16} {total_elements//5:<10} {avg_export:<16}")
print(f"\nGrand total time: {total_time} ms  ({total_time/1000:.1f} s)")
print(f"Screen IDs: {json.dumps(screen_ids, indent=2)}")
print("=" * 70)

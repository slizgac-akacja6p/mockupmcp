#!/usr/bin/env python3
"""
Continue corporate website — export existing screens, create remaining ones.
"""
import json
import time
import urllib.request

SESSION_ID = "ffba88af-54d6-46c3-ad55-8abdfa7df1e0"
BASE_URL = "http://localhost:3200/mcp"
PROJECT_ID = "proj_oUwIukpLme"

_id_counter = 500

def next_id():
    global _id_counter
    _id_counter += 1
    return _id_counter

def mcp_call(method, params):
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

# Common elements
def navbar_elements(active_item="Home"):
    items = ["Home", "About", "Services", "Portfolio", "Contact"]
    x_positions = [500, 590, 670, 760, 850]
    elems = [
        {"type": "rectangle", "x": 0, "y": 0, "width": 1440, "height": 60,
         "properties": {"label": "", "backgroundColor": "#1A1A2E"}, "z_index": 10},
        {"type": "text", "x": 48, "y": 16, "width": 150, "height": 28,
         "properties": {"label": "Acme Corp", "color": "#FFFFFF", "fontSize": 22, "fontWeight": "bold"}, "z_index": 11},
    ]
    for item, xp in zip(items, x_positions):
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

def section_hero(title, subtitle, y=60, height=220, bg="#4F46E5"):
    return [
        {"type": "rectangle", "x": 0, "y": y, "width": 1440, "height": height,
         "properties": {"label": "", "backgroundColor": bg}},
        {"type": "text", "x": 240, "y": y + 60, "width": 960, "height": 64,
         "properties": {"label": title, "color": "#FFFFFF", "fontSize": 48, "fontWeight": "bold", "textAlign": "center"}},
        {"type": "text", "x": 360, "y": y + 138, "width": 720, "height": 48,
         "properties": {"label": subtitle, "color": "#C7D2FE", "fontSize": 18, "textAlign": "center"}},
    ]

# PAGE 4: PORTFOLIO
def portfolio_elements():
    elems = navbar_elements("Portfolio")
    elems += section_hero(
        "Our Work",
        "A selection of projects we are proud of — from startups to Fortune 500 companies.",
        y=60, height=220, bg="#7C3AED"
    )
    projects = [
        {"title": "FinTech Dashboard", "cat": "Data Analytics", "color": "#DBEAFE", "x": 48, "y": 296},
        {"title": "HealthCare Portal", "cat": "Product Dev", "color": "#DCFCE7", "x": 512, "y": 296},
        {"title": "E-Commerce Platform", "cat": "Cloud + Dev", "color": "#FEF3C7", "x": 976, "y": 296},
        {"title": "Logistics Tracker", "cat": "Mobile App", "color": "#FCE7F3", "x": 48, "y": 560},
        {"title": "EdTech LMS", "cat": "Product Dev", "color": "#EDE9FE", "x": 512, "y": 560},
        {"title": "AI Analytics Suite", "cat": "Data + AI", "color": "#CFFAFE", "x": 976, "y": 560},
    ]
    for p in projects:
        elems += [
            {"type": "rectangle", "x": p["x"], "y": p["y"], "width": 416, "height": 240,
             "properties": {"label": "", "backgroundColor": "#F8FAFC", "borderRadius": 10}},
            {"type": "image", "x": p["x"] + 16, "y": p["y"] + 16, "width": 384, "height": 160,
             "properties": {"label": p["title"], "backgroundColor": p["color"]}},
            {"type": "text", "x": p["x"] + 16, "y": p["y"] + 184, "width": 256, "height": 24,
             "properties": {"label": p["title"], "color": "#1A1A2E", "fontSize": 16, "fontWeight": "bold"}},
            {"type": "text", "x": p["x"] + 292, "y": p["y"] + 188, "width": 108, "height": 18,
             "properties": {"label": p["cat"], "color": "#7C3AED", "fontSize": 12, "textAlign": "right"}},
            {"type": "text", "x": p["x"] + 16, "y": p["y"] + 210, "width": 120, "height": 20,
             "properties": {"label": "View Case Study →", "color": "#4F46E5", "fontSize": 13}},
        ]
    elems += footer_elements()
    return elems

# PAGE 5: CONTACT
def contact_elements():
    elems = navbar_elements("Contact")
    elems += section_hero(
        "Get In Touch",
        "Have a project in mind? We would love to hear from you. Send us a message!",
        y=60, height=196, bg="#BE185D"
    )
    elems += [
        # Contact form card
        {"type": "rectangle", "x": 80, "y": 272, "width": 672, "height": 532,
         "properties": {"label": "", "backgroundColor": "#FFFFFF", "borderRadius": 12,
                        "borderColor": "#E2E8F0", "borderWidth": 1}},
        {"type": "text", "x": 112, "y": 296, "width": 608, "height": 32,
         "properties": {"label": "Send Us a Message", "color": "#1A1A2E", "fontSize": 22, "fontWeight": "bold"}},
        # Full Name
        {"type": "text", "x": 112, "y": 344, "width": 200, "height": 20,
         "properties": {"label": "Full Name *", "color": "#374151", "fontSize": 14, "fontWeight": "bold"}},
        {"type": "input", "x": 112, "y": 368, "width": 608, "height": 48,
         "properties": {"label": "John Doe", "color": "#9CA3AF", "fontSize": 15, "backgroundColor": "#F9FAFB"}},
        # Email
        {"type": "text", "x": 112, "y": 432, "width": 200, "height": 20,
         "properties": {"label": "Email Address *", "color": "#374151", "fontSize": 14, "fontWeight": "bold"}},
        {"type": "input", "x": 112, "y": 456, "width": 608, "height": 48,
         "properties": {"label": "john@example.com", "color": "#9CA3AF", "fontSize": 15, "backgroundColor": "#F9FAFB"}},
        # Subject
        {"type": "text", "x": 112, "y": 520, "width": 200, "height": 20,
         "properties": {"label": "Subject", "color": "#374151", "fontSize": 14, "fontWeight": "bold"}},
        {"type": "input", "x": 112, "y": 544, "width": 608, "height": 48,
         "properties": {"label": "How can we help?", "color": "#9CA3AF", "fontSize": 15, "backgroundColor": "#F9FAFB"}},
        # Message
        {"type": "text", "x": 112, "y": 608, "width": 200, "height": 20,
         "properties": {"label": "Message *", "color": "#374151", "fontSize": 14, "fontWeight": "bold"}},
        {"type": "rectangle", "x": 112, "y": 632, "width": 608, "height": 120,
         "properties": {"label": "Tell us about your project...", "backgroundColor": "#F9FAFB",
                        "borderRadius": 6, "borderColor": "#D1D5DB", "borderWidth": 1, "color": "#9CA3AF", "fontSize": 15}},
        {"type": "button", "x": 112, "y": 768, "width": 608, "height": 48,
         "properties": {"label": "Send Message", "color": "#FFFFFF", "backgroundColor": "#BE185D", "fontSize": 16}},
        # Map placeholder
        {"type": "image", "x": 800, "y": 272, "width": 560, "height": 340,
         "properties": {"label": "Map — 123 Innovation Drive, San Francisco CA", "backgroundColor": "#CBD5E1"}},
        # Contact info box
        {"type": "rectangle", "x": 800, "y": 624, "width": 560, "height": 180,
         "properties": {"label": "", "backgroundColor": "#FFFFFF", "borderRadius": 12,
                        "borderColor": "#E2E8F0", "borderWidth": 1}},
        {"type": "text", "x": 824, "y": 640, "width": 512, "height": 24,
         "properties": {"label": "Contact Information", "color": "#1A1A2E", "fontSize": 18, "fontWeight": "bold"}},
        {"type": "text", "x": 824, "y": 672, "width": 512, "height": 20,
         "properties": {"label": "hello@acmecorp.com", "color": "#475569", "fontSize": 14}},
        {"type": "text", "x": 824, "y": 700, "width": 512, "height": 20,
         "properties": {"label": "+1 (415) 555-0192", "color": "#475569", "fontSize": 14}},
        {"type": "text", "x": 824, "y": 728, "width": 512, "height": 20,
         "properties": {"label": "123 Innovation Drive, San Francisco, CA 94105", "color": "#475569", "fontSize": 14}},
        {"type": "text", "x": 824, "y": 756, "width": 512, "height": 20,
         "properties": {"label": "Mon-Fri, 9 AM to 6 PM PST", "color": "#475569", "fontSize": 14}},
    ]
    elems += footer_elements()
    return elems

# Existing screens (already created)
existing = [
    {"idx": 1, "name": "Home", "screen_id": "scr_Q9k4Hy2vNg", "num_elements": 38, "creation_ms": 42},
    {"idx": 2, "name": "About", "screen_id": "scr_saiLoIDZsc", "num_elements": 33, "creation_ms": 90},
    {"idx": 3, "name": "Services", "screen_id": "scr_T3S8HWguo7", "num_elements": 46, "creation_ms": 20},
]

# Screens to create
new_pages = [
    (4, "Portfolio", portfolio_elements),
    (5, "Contact", contact_elements),
]

results = []

print("=" * 70)
print("CORPORATE WEBSITE — Continuing from Services...")
print(f"Project: {PROJECT_ID}")
print("=" * 70)

# Process existing screens (export only)
for ex in existing:
    print(f"\n[{ex['idx']}/5] Exporting existing screen: {ex['name']} ({ex['screen_id']})")
    t_exp_start = ms()
    try:
        export_png(ex["screen_id"])
        t_exp_end = ms()
        export_time = t_exp_end - t_exp_start
        print(f"  Export time: {export_time} ms")
    except Exception as e:
        t_exp_end = ms()
        export_time = t_exp_end - t_exp_start
        print(f"  Export FAILED after {export_time} ms: {e}")
        export_time = -1
    results.append({
        "idx": ex["idx"],
        "name": ex["name"],
        "screen_id": ex["screen_id"],
        "creation_ms": ex["creation_ms"],
        "num_elements": ex["num_elements"],
        "export_ms": export_time,
    })

# Create and export new screens
for idx, name, elements_fn in new_pages:
    print(f"\n[{idx}/5] Creating screen: {name}")

    t_start = ms()
    screen = create_screen(name)
    screen_id = screen["id"]
    elements = elements_fn()
    num_elements = len(elements)
    bulk_add(screen_id, elements)
    t_end = ms()
    creation_time = t_end - t_start

    print(f"  Screen ID: {screen_id} | Elements: {num_elements} | Creation: {creation_time} ms")

    print(f"  Exporting PNG...")
    t_exp_start = ms()
    try:
        export_png(screen_id)
        t_exp_end = ms()
        export_time = t_exp_end - t_exp_start
        print(f"  Export time: {export_time} ms")
    except Exception as e:
        t_exp_end = ms()
        export_time = t_exp_end - t_exp_start
        print(f"  Export FAILED after {export_time} ms: {e}")
        export_time = -1

    results.append({
        "idx": idx,
        "name": name,
        "screen_id": screen_id,
        "creation_ms": creation_time,
        "num_elements": num_elements,
        "export_ms": export_time,
    })

# Sort by idx
results.sort(key=lambda r: r["idx"])

# Summary
print("\n" + "=" * 72)
print("RESULTS — Corporate Website Mockup")
print("=" * 72)
print(f"{'#':<3} {'Page':<14} {'Tworzenie (ms)':<17} {'Elementow':<11} {'Export PNG (ms)'}")
print("-" * 72)

total_creation = 0
total_export = 0
total_elements = 0

for r in results:
    exp_str = str(r["export_ms"]) if r["export_ms"] >= 0 else "TIMEOUT"
    print(f"{r['idx']:<3} {r['name']:<14} {r['creation_ms']:<17} {r['num_elements']:<11} {exp_str}")
    total_creation += r["creation_ms"]
    if r["export_ms"] >= 0:
        total_export += r["export_ms"]
    total_elements += r["num_elements"]

print("-" * 72)
total_time = total_creation + total_export
avg_creation = total_creation // 5
avg_export = total_export // 5

print(f"{'TOT':<3} {'':<14} {total_creation:<17} {total_elements:<11} {total_export}")
print(f"{'AVG':<3} {'':<14} {avg_creation:<17} {total_elements//5:<11} {avg_export}")
print(f"\nGrand total time: {total_time} ms  ({total_time/1000:.2f} s)")
print(f"\nScreen IDs:")
for r in results:
    print(f"  {r['name']}: {r['screen_id']}")
print("=" * 72)
print(f"\nPreview: http://localhost:3100")
print(f"Project ID: {PROJECT_ID}")

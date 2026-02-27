#!/bin/bash

# MockupMCP Benchmark — SaaS Landing Page
# Measures time for each screen creation and export via HTTP API
# Uses mockup_create_screen_layout for fast creation with sections

BASE_URL="http://localhost:3200/mcp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current time in milliseconds (macOS compatible)
# macOS date doesn't support %N (nanoseconds), so use epoch seconds * 1000
# Note: this means we only have 1-second precision on macOS, but that's OK for benchmark
get_time_ms() {
    # Try using gdate (GNU date) if available, otherwise use system date
    if command -v gdate &>/dev/null; then
        gdate +%s%3N
    else
        # macOS date: fall back to seconds (convert to ms by multiplying by 1000)
        printf '%d' "$(date +%s)000"
    fi
}

# Initialize session - extract session ID from mcp-session-id header
init_session() {
    local response=$(curl -s -i -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"benchmark","version":"1.0"}},"id":1}' 2>&1)

    # Extract session ID from mcp-session-id header
    local session_id=$(echo "$response" | grep -i "mcp-session-id:" | cut -d' ' -f2 | tr -d '\r')

    if [ -z "$session_id" ]; then
        echo "ERROR: Could not extract session ID from response" >&2
        return 1
    fi

    echo "$session_id"
}

# Call MCP tool with session ID
call_mcp() {
    local method=$1
    local args=$2
    local operation=$3
    local session_id=$4

    # Call API with session ID header
    local response=$(curl -s -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "mcp-session-id: $session_id" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"$method\",\"arguments\":$args},\"id\":1}" 2>&1)

    # Check for error response
    if echo "$response" | grep -q '"error"'; then
        echo -e "${RED}ERROR${NC} [$operation]" >&2
        return 1
    fi

    # Parse response - handle SSE data: format
    local json_data=$(echo "$response" | sed -n 's/^data: //p' | head -1)

    if [ -z "$json_data" ]; then
        echo -e "${RED}ERROR${NC} [$operation] No SSE data" >&2
        return 1
    fi

    # Verify it looks like JSON
    if ! echo "$json_data" | jq empty 2>/dev/null; then
        echo -e "${RED}ERROR${NC} [$operation] Invalid JSON" >&2
        return 1
    fi

    # Extract result - for export: image data is in .result.content[1].data (binary PNG)
    # for other tools: text is in .result.content[0].text
    local result=$(echo "$json_data" | jq -r '.result.content[1].data // .result.content[0].text // empty' 2>/dev/null)

    if [ -z "$result" ]; then
        echo -e "${RED}ERROR${NC} [$operation] No result" >&2
        return 1
    fi

    # Result is a JSON string - parse it
    if ! echo "$result" | jq empty 2>/dev/null; then
        echo -e "${RED}ERROR${NC} [$operation] Result not JSON" >&2
        return 1
    fi

    echo "$result"
}

echo -e "${YELLOW}MockupMCP Benchmark — SaaS Landing Page${NC}"
echo "================================================"

# Initialize session
echo -e "\n${YELLOW}[0] Initializing session...${NC}"
SESSION_ID=$(init_session)
if [ $? -ne 0 ]; then
    exit 1
fi
echo -e "${GREEN}✓${NC} Session ID: $SESSION_ID"

START_MS=$(get_time_ms)

# ===== Create Project =====
echo -e "\n${YELLOW}[1] Creating project...${NC}"
project_start=$(get_time_ms)

project_result=$(call_mcp "mockup_create_project" '{"name":"bench-haiku-iter1","folder":"benchmark"}' "CREATE_PROJECT" "$SESSION_ID")
if [ $? -ne 0 ]; then
    exit 1
fi

project_id=$(echo "$project_result" | jq -r '.id // empty')

if [ -z "$project_id" ]; then
    echo -e "${RED}FAILED${NC} to extract project ID"
    exit 1
fi

project_end=$(get_time_ms)
project_time=$((project_end - project_start))
echo -e "${GREEN}✓${NC} Project created: $project_id (${project_time}ms)"

# ===== Screen Definitions (with sections) =====
# Using mockup_create_screen_layout with sections for 10x speed

declare landing_page_sections='[
  {"type":"navbar"},
  {"type":"hero_with_cta"},
  {"type":"feature_list"},
  {"type":"footer"}
]'

declare features_sections='[
  {"type":"navbar"},
  {"type":"feature_list"},
  {"type":"card_grid_3"},
  {"type":"footer"}
]'

declare pricing_sections='[
  {"type":"navbar"},
  {"type":"card_grid_2"},
  {"type":"footer"}
]'

declare dashboard_sections='[
  {"type":"navbar"},
  {"type":"card_grid_3"},
  {"type":"settings_panel"}
]'

declare login_sections='[
  {"type":"login_form"}
]'

# Store results
declare -x landing_page_id=""
declare -x landing_page_time=""
declare -x landing_page_elements=""
declare -x features_id=""
declare -x features_time=""
declare -x features_elements=""
declare -x pricing_id=""
declare -x pricing_time=""
declare -x pricing_elements=""
declare -x dashboard_id=""
declare -x dashboard_time=""
declare -x dashboard_elements=""
declare -x login_id=""
declare -x login_time=""
declare -x login_elements=""

echo -e "\n${YELLOW}[2] Creating screens with sections...${NC}"

# Function to create screen with sections
create_screen_with_sections() {
    local screen_name=$1
    local sections_json=$2
    local var_prefix=$3

    local screen_start=$(get_time_ms)

    # Build the arguments JSON (note: project_id not projectId)
    local args="{\"project_id\":\"$project_id\",\"name\":\"$screen_name\",\"sections\":$sections_json,\"style\":\"flat\"}"

    local screen_result=$(call_mcp "mockup_create_screen_layout" "$args" "CREATE_SCREEN:$screen_name" "$SESSION_ID" 2>/dev/null)
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗${NC} Failed to create screen: $screen_name"
        return 1
    fi

    local screen_id=$(echo "$screen_result" | jq -r '.screen_id // empty')

    if [ -z "$screen_id" ]; then
        echo -e "${RED}✗${NC} Failed to extract screen ID: $screen_name"
        return 1
    fi

    echo -e "  ${GREEN}✓${NC} Screen created: $screen_name ($screen_id)"
    eval "${var_prefix}_id=\"$screen_id\""

    # List elements (extract element_count from result)
    local element_count=$(echo "$screen_result" | jq '.element_count // 0')

    local screen_end=$(get_time_ms)
    local screen_time=$((screen_end - screen_start))

    eval "${var_prefix}_time=$screen_time"
    eval "${var_prefix}_elements=$element_count"

    echo -e "    ${GREEN}✓${NC} Elements created: $element_count (total time: ${screen_time}ms)"
}

# Create all screens
create_screen_with_sections "Landing Page" "$landing_page_sections" "landing_page"
create_screen_with_sections "Features" "$features_sections" "features"
create_screen_with_sections "Pricing" "$pricing_sections" "pricing"
create_screen_with_sections "Dashboard" "$dashboard_sections" "dashboard"
create_screen_with_sections "Login" "$login_sections" "login"

# ===== Export Screens =====
echo -e "\n${YELLOW}[3] Exporting screens to PNG...${NC}"

export_screen() {
    local screen_name=$1
    local screen_id=$2

    local export_start=$(get_time_ms)

    local export_args="{\"project_id\":\"$project_id\",\"screen_id\":\"$screen_id\"}"
    # Get PNG data from export response
    local export_response=$(curl -s -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "mcp-session-id: $SESSION_ID" \
        --data-binary "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"mockup_export\",\"arguments\":$export_args},\"id\":1}" 2>&1)

    local json_data=$(echo "$export_response" | sed -n 's/^data: //p')
    local png_data=$(echo "$json_data" | jq -r '.result.content[1].data // empty' 2>/dev/null)
    local png_length=${#png_data}

    if [ ! -z "$png_data" ]; then
        if [ "$png_length" -lt 1000 ]; then
            echo -e "  ${RED}✗${NC} $screen_name: PNG export too small (${png_length} bytes)"
        else
            echo -e "  ${GREEN}✓${NC} $screen_name: PNG exported (${png_length} bytes)"
        fi
    else
        echo -e "  ${RED}✗${NC} $screen_name: Export failed" >&2
    fi

    local export_end=$(get_time_ms)
    local export_time=$((export_end - export_start))
    echo "     Export time: ${export_time}ms"
}

# Export each screen if it was created
if [ ! -z "$landing_page_id" ]; then
    export_screen "Landing Page" "$landing_page_id"
fi
if [ ! -z "$features_id" ]; then
    export_screen "Features" "$features_id"
fi
if [ ! -z "$pricing_id" ]; then
    export_screen "Pricing" "$pricing_id"
fi
if [ ! -z "$dashboard_id" ]; then
    export_screen "Dashboard" "$dashboard_id"
fi
if [ ! -z "$login_id" ]; then
    export_screen "Login" "$login_id"
fi

END_MS=$(get_time_ms)
TOTAL_TIME=$((END_MS - START_MS))

# ===== Report =====
echo ""
echo -e "${YELLOW}================================================${NC}"
echo -e "${YELLOW}WYNIKI: bench-haiku-iter1${NC}"
echo -e "${YELLOW}================================================${NC}"

# Print results
if [ ! -z "$landing_page_time" ]; then
    printf "Screen: %-16s | time_ms: %5d | elements: %d\n" "Landing Page" "$landing_page_time" "$landing_page_elements"
fi
if [ ! -z "$features_time" ]; then
    printf "Screen: %-16s | time_ms: %5d | elements: %d\n" "Features" "$features_time" "$features_elements"
fi
if [ ! -z "$pricing_time" ]; then
    printf "Screen: %-16s | time_ms: %5d | elements: %d\n" "Pricing" "$pricing_time" "$pricing_elements"
fi
if [ ! -z "$dashboard_time" ]; then
    printf "Screen: %-16s | time_ms: %5d | elements: %d\n" "Dashboard" "$dashboard_time" "$dashboard_elements"
fi
if [ ! -z "$login_time" ]; then
    printf "Screen: %-16s | time_ms: %5d | elements: %d\n" "Login" "$login_time" "$login_elements"
fi

echo -e "${YELLOW}================================================${NC}"
echo "TOTAL_MS: $TOTAL_TIME"
echo -e "${YELLOW}================================================${NC}"

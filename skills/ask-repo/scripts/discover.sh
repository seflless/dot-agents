#!/bin/bash
# Discover relevant GitHub repos for a query
# Usage: discover.sh "<query>" [limit]
#
# Tactics:
# 1. GitHub search sorted by stars
# 2. (Future) Awesome list lookup
# 3. (Future) Registry APIs

set -e

QUERY="$1"
LIMIT="${2:-5}"

if [ -z "$QUERY" ]; then
    echo "Usage: discover.sh \"<query>\" [limit]"
    echo ""
    echo "Examples:"
    echo "  discover.sh \"react state management\""
    echo "  discover.sh \"rust async runtime\" 10"
    exit 1
fi

# Search GitHub repos sorted by stars
search_github() {
    local query="$1"
    local limit="$2"

    gh search repos "$query" \
        --sort=stars \
        --limit="$limit" \
        --json fullName,description,stargazersCount,url \
        2>/dev/null
}

# Format results for display
format_results() {
    local json="$1"
    local query="$2"

    if [ -z "$json" ] || [ "$json" = "[]" ]; then
        echo "No repos found for: \"$query\""
        echo ""
        echo "Try:"
        echo "  - Using different keywords"
        echo "  - Being more specific (e.g., \"typescript orm\" instead of \"database\")"
        exit 0
    fi

    local count=$(echo "$json" | jq length)
    echo "Found $count repos for: \"$query\""
    echo ""

    echo "$json" | jq -r '
        to_entries | .[] |
        "\(.key + 1). \(.value.fullName) (\(
            if .value.stargazersCount >= 1000 then
                ((.value.stargazersCount / 1000 * 10 | floor) / 10 | tostring) + "k"
            else
                .value.stargazersCount | tostring
            end
        )★)\n   \(.value.description // "No description")\n"
    '
}

# Main
results=$(search_github "$QUERY" "$LIMIT")
format_results "$results" "$QUERY"

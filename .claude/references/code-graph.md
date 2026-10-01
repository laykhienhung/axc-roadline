# Code graph (shared)

Prefer a code-graph MCP over grep/find/read — faster, far fewer tokens. If none exists, build it first; fall back to Grep/Glob/Read only for what the graph doesn't cover (config, CI, lint, READMEs).

- **code-review-graph** MCP → `build_or_update_graph_tool`, then the tool for the job: `list_communities_tool` / `get_architecture_overview_tool` / `list_flows_tool` (structure), `query_graph_tool` (callers/callees/imports), `get_impact_radius_tool` (blast radius), `find_large_functions_tool` (hotspots).
- **gitnexus** MCP → index, then `query` / `context` / `impact` / `trace` / `list_repos` / `get_architecture_overview`.

Pick one graph, not both. Note which you used (or none) where the skill records it.

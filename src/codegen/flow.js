// Generates a Mermaid.js graph diagram from project navigation links.
// Each screen becomes a node, each element with link_to becomes an edge.
export function generateMermaid(project) {
  const lines = ['graph LR'];

  // Add all screen nodes
  for (const screen of project.screens) {
    lines.push(`  ${screen.id}[${screen.name}]`);
  }

  // Add edges from elements with link_to
  for (const screen of project.screens) {
    for (const el of (screen.elements || [])) {
      if (el.properties?.link_to?.screen_id) {
        const label = el.properties.label || el.properties.title || el.type;
        const target = el.properties.link_to.screen_id;
        lines.push(`  ${screen.id} -->|${el.type}: ${label}| ${target}`);
      }
    }
  }

  return lines.join('\n');
}

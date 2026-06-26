// Stable import point for the root brand/content config, so components can do
// `import { brand, content } from "@/lib/config"` without relative-path churn.
export { brand, type Brand } from "../../brand.config";
export { content, type Content, type Pillar } from "../../content.config";

import { BUNDLED_SKILLS } from "./bundle.generated.js";
import { createSkillRegistry } from "./registry.js";

export * from "./clientSupport.js";
export * from "./registry.js";

export const SKILL_REGISTRY = createSkillRegistry(BUNDLED_SKILLS);
const registry = SKILL_REGISTRY;
export const SKILL_RESOURCES = registry.resources;
export const listSkills = registry.listSkills;
export const getSkill = registry.getSkill;
export const readSkillResource = registry.readSkillResource;

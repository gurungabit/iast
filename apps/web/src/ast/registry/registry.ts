// ============================================================================
// AST Registry - Central registry for all AST configurations
// ============================================================================

import type { ASTConfig, ASTCategory, ASTRegistry } from './types';

/**
 * Create the AST registry singleton
 */
function createRegistry(): ASTRegistry {
  const asts = new Map<string, ASTConfig>();

  const get = (id: string): ASTConfig | undefined => {
    return asts.get(id);
  };

  const getEnabled = (): ASTConfig[] => {
    return Array.from(asts.values()).filter((ast) => ast.enabled);
  };

  const getVisible = (): ASTConfig[] => {
    return Array.from(asts.values()).filter((ast) => ast.enabled && ast.visible);
  };

  const getByCategory = (category: ASTCategory): ASTConfig[] => {
    return Array.from(asts.values()).filter(
      (ast) => ast.enabled && ast.visible && ast.category === category
    );
  };

  const search = (query: string): ASTConfig[] => {
    if (!query.trim()) {
      return getVisible();
    }

    const lowerQuery = query.toLowerCase().trim();
    const terms = lowerQuery.split(/\s+/);

    return getVisible()
      .map((ast) => {
        // Calculate relevance score
        let score = 0;
        const searchText = [
          ast.id,
          ast.name,
          ast.description,
          ...ast.keywords,
          ast.category,
        ]
          .join(' ')
          .toLowerCase();

        for (const term of terms) {
          // Exact match in name gets highest score
          if (ast.name.toLowerCase() === term) {
            score += 100;
          } else if (ast.name.toLowerCase().startsWith(term)) {
            score += 50;
          } else if (ast.name.toLowerCase().includes(term)) {
            score += 25;
          }

          // ID match
          if (ast.id.toLowerCase().includes(term)) {
            score += 20;
          }

          // Keyword exact match
          if (ast.keywords.some((k) => k.toLowerCase() === term)) {
            score += 15;
          }

          // Keyword partial match
          if (ast.keywords.some((k) => k.toLowerCase().includes(term))) {
            score += 10;
          }

          // Description match
          if (ast.description.toLowerCase().includes(term)) {
            score += 5;
          }

          // Any match in search text
          if (searchText.includes(term)) {
            score += 1;
          }
        }

        return { ast, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ ast }) => ast);
  };

  const register = (config: ASTConfig): void => {
    if (asts.has(config.id)) {
      console.warn(`AST "${config.id}" is already registered. Overwriting.`);
    }
    asts.set(config.id, { ...config });
  };

  const setEnabled = (id: string, enabled: boolean): void => {
    const ast = asts.get(id);
    if (ast) {
      asts.set(id, { ...ast, enabled });
    }
  };

  const setVisible = (id: string, visible: boolean): void => {
    const ast = asts.get(id);
    if (ast) {
      asts.set(id, { ...ast, visible });
    }
  };

  return {
    asts,
    get,
    getEnabled,
    getVisible,
    getByCategory,
    search,
    register,
    setEnabled,
    setVisible,
  };
}

/**
 * Global AST registry singleton
 */
export const astRegistry = createRegistry();

/**
 * Helper to register an AST with default values
 */
export function registerAST(
  config: Omit<ASTConfig, 'enabled' | 'visible'> & {
    enabled?: boolean;
    visible?: boolean;
  }
): void {
  astRegistry.register({
    enabled: true,
    visible: true,
    ...config,
  });
}

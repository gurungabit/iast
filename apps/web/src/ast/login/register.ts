// ============================================================================
// Login AST Registration
// ============================================================================

import { registerAST } from '../registry';
import { LoginASTForm } from './LoginASTForm';

/**
 * Register the Login AST with the registry.
 * This is called once when the module is imported.
 */
export function registerLoginAST(): void {
  registerAST({
    id: 'login',
    name: 'TSO Login',
    description: 'Automated TSO login sequence with credential management',
    category: 'authentication',
    keywords: ['login', 'tso', 'authentication', 'sign in', 'logon', 'credentials'],
    version: '1.0.0',
    author: 'Core Team',
    requiresAuth: false,
    component: LoginASTForm,
  });
}

// Auto-register when module is imported
registerLoginAST();

import { ProjectAnalyzer } from '../analyzer/ProjectAnalyzer';
import { DatabaseManager } from '../database/DatabaseManager';
import { PluginManager } from '../plugins/PluginManager';
import { ActionManager } from '../actions/ActionManager';
import { AnalysisResult, SetupOptions, ProjectAnalysis } from '../types';
import chalk from 'chalk';

export class WAUEngine {
  private projectAnalyzer: ProjectAnalyzer;
  private databaseManager: DatabaseManager;
  private pluginManager: PluginManager;
  private actionManager: ActionManager;

  constructor() {
    this.projectAnalyzer = new ProjectAnalyzer();
    this.databaseManager = new DatabaseManager();
    this.pluginManager = new PluginManager();
    this.actionManager = new ActionManager();
  }

  async analyzeProject(projectPath: string): Promise<AnalysisResult> {
    try {
      console.log(chalk.blue('🔍 Analyzing project...'));
      
      const analysis = await this.projectAnalyzer.analyzeProject(projectPath);
      const metadata = await this.projectAnalyzer.getProjectMetadata(projectPath);
      
      console.log(chalk.gray(`📦 Project: ${metadata.name} (${metadata.version})`));
      console.log(chalk.gray(`🔧 Language: ${analysis.language}`));
      console.log(chalk.gray(`⚡ Frameworks: ${analysis.framework.join(', ') || 'None detected'}`));

      // Get recommendations from plugins
      const recommendations = this.pluginManager.getAllRecommendations(analysis);
      const refactorSuggestions = this.pluginManager.getAllRefactorSuggestions(analysis);
      const frameworkSpecificPackages = this.pluginManager.getAllSpecificPackages(analysis);

      // Detect already installed tools
      const installedTools = this.detectInstalledTools(analysis);

      // Generate Claude automation suggestions
      const claudeAutomations = this.generateClaudeAutomations(analysis);

      return {
        setup_recommendations: recommendations.map(r => 
          `Install ${r.tool} for ${r.category}: ${r.reason}`
        ),
        tool_suggestions: recommendations.map(r => r.tool),
        framework_specific_tools: frameworkSpecificPackages,
        refactor_suggestions: refactorSuggestions,
        installed_tools_detected: installedTools,
        claude_automations: claudeAutomations
      };

    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async setupProject(projectPath: string, options: SetupOptions = {}): Promise<boolean> {
    try {
      const analysis = await this.projectAnalyzer.analyzeProject(projectPath);
      const recommendations = this.pluginManager.getAllRecommendations(analysis);

      if (recommendations.length === 0) {
        console.log(chalk.green('✅ Project is already well configured!'));
        return true;
      }

      console.log(chalk.blue(`🎯 Found ${recommendations.length} recommendations`));

      if (options.dryRun) {
        console.log(chalk.yellow('🔍 Dry run mode - showing what would be done:'));
        recommendations.forEach(rec => {
          console.log(chalk.gray(`  • ${rec.tool}: ${rec.reason}`));
        });
        return true;
      }

      const result = await this.actionManager.executeRecommendations(
        projectPath, 
        recommendations, 
        options
      );

      return result.success;

    } catch (error) {
      console.error(chalk.red(`❌ Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      return false;
    }
  }

  async updateDatabase(): Promise<boolean> {
    console.log(chalk.blue('📡 Updating tools database...'));
    
    const success = await this.databaseManager.updateDatabase();
    
    if (success) {
      console.log(chalk.green('✅ Database updated successfully'));
    } else {
      console.log(chalk.red('❌ Failed to update database'));
    }
    
    return success;
  }

  private detectInstalledTools(analysis: ProjectAnalysis): string[] {
    const installedTools: string[] = [];
    const allDeps = [...analysis.dependencies, ...analysis.devDependencies];

    // Common tools to check for
    const toolChecks = {
      'eslint': ['eslint'],
      'prettier': ['prettier'],
      'husky': ['husky'],
      'jest': ['jest'],
      'typescript': ['typescript'],
      'tailwindcss': ['tailwindcss'],
      'webpack': ['webpack'],
      'vite': ['vite'],
      'rollup': ['rollup'],
      'babel': ['@babel/core', 'babel-core']
    };

    Object.entries(toolChecks).forEach(([tool, packages]) => {
      if (packages.some(pkg => allDeps.includes(pkg))) {
        installedTools.push(tool);
      }
    });

    return installedTools;
  }

  private generateClaudeAutomations(analysis: ProjectAnalysis): string[] {
    const automations: string[] = [];

    // Framework-specific automations
    if (analysis.framework.includes('nextjs')) {
      automations.push('Generate Next.js API routes with proper TypeScript types');
      automations.push('Create reusable Next.js components with proper prop types');
      automations.push('Setup Next.js middleware for authentication');
    }

    if (analysis.framework.includes('react')) {
      automations.push('Refactor class components to functional components with hooks');
      automations.push('Generate custom hooks for common functionality');
      automations.push('Create component documentation with Storybook');
    }

    // Language-specific automations
    if (analysis.language === 'TypeScript') {
      automations.push('Generate TypeScript interfaces from API responses');
      automations.push('Add strict typing to existing JavaScript functions');
      automations.push('Create utility types for better type safety');
    }

    // Testing automations
    if (!analysis.devDependencies.includes('jest') && !analysis.devDependencies.includes('vitest')) {
      automations.push('Setup testing framework with example tests');
      automations.push('Generate unit tests for existing components');
    }

    // Documentation automations
    automations.push('Generate README.md with project setup instructions');
    automations.push('Create CONTRIBUTING.md with development guidelines');
    automations.push('Generate API documentation from code comments');

    return automations;
  }
}
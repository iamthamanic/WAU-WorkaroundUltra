#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { WAUEngine } from './core/WAUEngine';
import { WAUSupervisor } from './supervisor/WAUSupervisor';
import * as path from 'path';
import * as fs from 'fs-extra';

// Global supervisor instance
let supervisor: WAUSupervisor | null = null;

const program = new Command();
const wauEngine = new WAUEngine();

program
  .name('wau')
  .description('WorkaroundUltra - Project Setup Autopilot')
  .version('2.0.0');

program
  .command('analyze')
  .description('Analyze current project and get recommendations')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      
      const result = await wauEngine.analyzeProject(projectPath);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.blue('📋 Analysis Results:\n'));
        
        if (result.setup_recommendations.length > 0) {
          console.log(chalk.yellow('🔧 Setup Recommendations:'));
          result.setup_recommendations.forEach(rec => console.log(`  • ${rec}`));
          console.log();
        }

        if (result.framework_specific_tools.length > 0) {
          console.log(chalk.cyan('⚡ Framework-Specific Tools:'));
          result.framework_specific_tools.forEach(tool => console.log(`  • ${tool}`));
          console.log();
        }

        if (result.refactor_suggestions.length > 0) {
          console.log(chalk.magenta('🔄 Refactor Suggestions:'));
          result.refactor_suggestions.forEach(suggestion => {
            console.log(`  • ${suggestion.filename}: ${suggestion.suggestion}`);
          });
          console.log();
        }

        if (result.installed_tools_detected.length > 0) {
          console.log(chalk.green('✅ Already Installed:'));
          result.installed_tools_detected.forEach(tool => console.log(`  • ${tool}`));
          console.log();
        }

        if (result.code_insights && result.code_insights.length > 0) {
          console.log(chalk.yellow('🔬 Code Analysis Insights:'));
          result.code_insights.forEach(insight => {
            const severityColor = insight.severity === 'high' ? chalk.red : 
                                 insight.severity === 'medium' ? chalk.yellow : chalk.gray;
            console.log(`  • ${severityColor(insight.tool.toUpperCase())}: ${insight.reason}`);
            if (insight.evidence.length > 0) {
              insight.evidence.slice(0, 3).forEach(evidence => {
                console.log(`    - ${chalk.gray(evidence)}`);
              });
            }
          });
          console.log();
        }

        if (result.claude_automations && result.claude_automations.length > 0) {
          console.log(chalk.blue('🤖 Claude Automation Ideas:'));
          result.claude_automations.forEach(automation => console.log(`  • ${automation}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Automatically setup recommended tools')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--dry-run', 'Show what would be done without executing')
  .option('--force', 'Force setup even if tools are already configured')
  .option('--skip-backup', 'Skip creating backups before changes')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      
      if (!options.yes && !options.dryRun) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'This will modify your project files. Continue?',
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Setup cancelled.'));
          return;
        }
      }

      const setupOptions = {
        dryRun: options.dryRun,
        force: options.force,
        skipBackup: options.skipBackup,
        interactive: !options.yes
      };

      const success = await wauEngine.setupProject(projectPath, setupOptions);
      
      if (success) {
        console.log(chalk.green('\n🎉 Project setup completed successfully!'));
        
        if (!options.dryRun) {
          console.log(chalk.blue('\n💡 Next steps:'));
          console.log('  • Run your linter: npm run lint');
          console.log('  • Format your code: npm run format');
          console.log('  • Commit your changes to test the git hooks');
        }
      } else {
        console.log(chalk.red('\n❌ Setup completed with some failures. Check the output above for details.'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`❌ Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('update-db')
  .description('Update the tools database from remote source')
  .action(async () => {
    const success = await wauEngine.updateDatabase();
    process.exit(success ? 0 : 1);
  });

// Supervisor Commands
program
  .command('watch')
  .description('Start WAU supervisor to continuously monitor the project')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--dashboard', 'Show live dashboard')
  .option('--auto-setup', 'Automatically setup recommended tools')
  .option('--auto-fix', 'Automatically fix issues when possible')
  .option('--webhook <url>', 'Send notifications to webhook URL')
  .option('--no-desktop', 'Disable desktop notifications')
  .action(async (options) => {
    try {
      if (supervisor) {
        console.log(chalk.yellow('Supervisor is already running. Use "wau stop" first.'));
        return;
      }

      const projectPath = path.resolve(options.path);
      
      // Check if project path exists
      if (!await fs.pathExists(projectPath)) {
        console.error(chalk.red(`❌ Project path does not exist: ${projectPath}`));
        process.exit(1);
      }

      const config = {
        autoFix: options.autoFix,
        autoSetup: options.autoSetup,
        dashboard: options.dashboard,
        notifications: {
          terminal: true,
          desktop: !options.noDesktop,
          webhook: options.webhook
        },
        ignoreTools: [],
        watchPatterns: ['**/*']
      };

      supervisor = new WAUSupervisor(projectPath, config);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n📡 Shutting down supervisor...'));
        if (supervisor) {
          await supervisor.stop();
          supervisor = null;
        }
        process.exit(0);
      });

      await supervisor.start();
      
      if (options.dashboard) {
        console.log(chalk.cyan('🎮 Dashboard mode - Press Ctrl+C to stop'));
        // Dashboard would be implemented here
      } else {
        console.log(chalk.cyan('👁️  WAU is watching your project - Press Ctrl+C to stop'));
      }

      // Keep process alive
      await new Promise((resolve) => {
        supervisor?.on('stopped', resolve);
      });

    } catch (error) {
      console.error(chalk.red(`❌ Failed to start supervisor: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show WAU supervisor status and project health')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      
      if (!supervisor) {
        // Check if there's a state file indicating a previous session
        const stateFile = path.join(projectPath, '.wau', 'state.json');
        if (await fs.pathExists(stateFile)) {
          const state = await fs.readJson(stateFile);
          console.log(chalk.yellow('📊 WAU Status: Not running (previous session found)'));
          console.log(chalk.gray(`   Last analysis: ${new Date(state.lastAnalysis).toLocaleString()}`));
          console.log(chalk.gray(`   Language: ${state.language}`));
          console.log(chalk.gray(`   Health Score: ${state.healthScore}/100`));
          console.log(chalk.gray(`   Detected Tools: ${state.detectedTools.length}`));
          console.log(chalk.cyan('\n💡 Run "wau watch" to start monitoring'));
        } else {
          console.log(chalk.red('📊 WAU Status: Not running'));
          console.log(chalk.cyan('💡 Run "wau watch" to start monitoring'));
        }
        return;
      }

      const status = supervisor.getStatus();
      
      console.log(chalk.green('📊 WAU Status: Running'));
      console.log(chalk.gray(`   Project: ${path.basename(status.state.projectPath)}`));
      console.log(chalk.gray(`   Language: ${status.state.language}`));
      console.log(chalk.gray(`   Frameworks: ${status.state.frameworks.join(', ') || 'None'}`));
      console.log(chalk.gray(`   Health Score: ${status.state.healthScore}/100`));
      console.log(chalk.gray(`   Watched Files: ${status.watchedFiles}`));
      console.log(chalk.gray(`   Detected Tools: ${Array.from(status.state.detectedTools).join(', ')}`));
      
      if (status.state.missingTools.size > 0) {
        console.log(chalk.yellow(`   Missing Tools: ${Array.from(status.state.missingTools).join(', ')}`));
      }

    } catch (error) {
      console.error(chalk.red(`❌ Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the WAU supervisor')
  .action(async () => {
    try {
      if (!supervisor) {
        console.log(chalk.yellow('📊 No supervisor is currently running'));
        return;
      }

      await supervisor.stop();
      supervisor = null;
      console.log(chalk.green('✅ Supervisor stopped'));

    } catch (error) {
      console.error(chalk.red(`❌ Failed to stop supervisor: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('recommendations')
  .description('Show current tool recommendations')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      
      if (!supervisor) {
        console.log(chalk.yellow('📊 Supervisor not running. Starting quick analysis...'));
        // Fall back to one-time analysis
        const result = await wauEngine.analyzeProject(projectPath);
        
        if (options.json) {
          console.log(JSON.stringify(result.setup_recommendations, null, 2));
        } else {
          console.log(chalk.cyan('🔧 Quick Recommendations:'));
          result.setup_recommendations.forEach(rec => console.log(`  • ${rec}`));
        }
        return;
      }

      const recommendations = await supervisor.getCurrentRecommendations();
      
      if (options.json) {
        console.log(JSON.stringify(recommendations, null, 2));
        return;
      }

      if (recommendations.length === 0) {
        console.log(chalk.green('✅ No recommendations - your project looks good!'));
        return;
      }

      console.log(chalk.cyan('🔧 Current Recommendations:\n'));
      
      const byPriority = {
        critical: recommendations.filter(r => r.priority === 'critical'),
        high: recommendations.filter(r => r.priority === 'high'),
        medium: recommendations.filter(r => r.priority === 'medium'),
        low: recommendations.filter(r => r.priority === 'low')
      };

      if (byPriority.critical.length > 0) {
        console.log(chalk.red('🔴 Critical:'));
        byPriority.critical.forEach(rec => {
          console.log(chalk.red(`   ${rec.tool}: ${rec.reason}`));
          if (rec.setupCommand) {
            console.log(chalk.gray(`     → ${rec.setupCommand}`));
          }
        });
        console.log();
      }

      if (byPriority.high.length > 0) {
        console.log(chalk.yellow('🟡 High Priority:'));
        byPriority.high.forEach(rec => {
          console.log(chalk.yellow(`   ${rec.tool}: ${rec.reason}`));
          if (rec.setupCommand) {
            console.log(chalk.gray(`     → ${rec.setupCommand}`));
          }
        });
        console.log();
      }

      if (byPriority.medium.length > 0) {
        console.log(chalk.blue('🔵 Medium Priority:'));
        byPriority.medium.forEach(rec => {
          console.log(chalk.blue(`   ${rec.tool}: ${rec.reason}`));
        });
        console.log();
      }

      if (byPriority.low.length > 0) {
        console.log(chalk.gray('⚪ Low Priority:'));
        byPriority.low.forEach(rec => {
          console.log(chalk.gray(`   ${rec.tool}: ${rec.reason}`));
        });
        console.log();
      }

      console.log(chalk.cyan('💡 Run "wau setup" to install recommended tools'));

    } catch (error) {
      console.error(chalk.red(`❌ Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('ignore')
  .description('Add a tool to the ignore list')
  .argument('<tool>', 'Tool name to ignore')
  .action((tool) => {
    try {
      if (!supervisor) {
        console.log(chalk.yellow('📊 Supervisor not running. Tool will be ignored when supervisor starts.'));
        // Could save to config file
        return;
      }

      supervisor.addIgnoredTool(tool);
      console.log(chalk.green(`✅ Tool "${tool}" added to ignore list`));

    } catch (error) {
      console.error(chalk.red(`❌ Failed to ignore tool: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('Rollback changes made by a specific tool')
  .argument('<tool>', 'Tool name to rollback (e.g., prettier, eslint, husky)')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (tool, options) => {
    try {
      const projectPath = path.resolve(options.path);
      
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to rollback ${tool}? This will restore backup files and remove configurations.`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Rollback cancelled.'));
        return;
      }

      // This would need to be implemented in the ActionManager
      console.log(chalk.yellow(`🔄 Rollback for ${tool} is not yet implemented.`));
      console.log(chalk.gray('You can manually restore backup files ending with .wau-backup-*'));
      
    } catch (error) {
      console.error(chalk.red(`❌ Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('❌ Invalid command. Use --help to see available commands.'));
  process.exit(1);
});

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse();
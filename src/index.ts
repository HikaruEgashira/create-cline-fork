import path from 'path';
import fs from 'fs-extra';
import { Command } from 'commander';
import chalk from 'chalk';
import { execa } from 'execa';
import ora from 'ora';
import { processTemplateProject } from './utils.js';
import { REPO_URL } from './constants.js';

/**
 * Check if the project directory already exists
 * @param targetDir - Target directory path
 * @returns true if exists
 */
async function checkDirectoryExists(targetDir: string): Promise<boolean> {
  try {
    await fs.access(targetDir);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Clone the template repository from GitHub
 * @param targetDir - Clone destination directory
 */
async function cloneRepository(repo: keyof typeof REPO_URL, targetDir: string): Promise<void> {
  const spinner = ora('Cloning template repository...').start();

  try {
    await execa('git', ['clone', REPO_URL[repo], targetDir]);

    await fs.remove(path.join(targetDir, '.git'));

    spinner.succeed('Template repository cloning completed');
  } catch (error) {
    spinner.fail('Failed to clone repository');
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Install dependencies and build the package
 * @param targetDir - Project directory
 * @param projectName - Project name
 * @returns Path to the generated VSIX file
 */
async function installAndPackage(targetDir: string, projectName: string): Promise<string> {
  const spinner = ora('Installing dependencies...').start();

  try {
    // Save current directory
    const currentDir = process.cwd();

    // Change to target directory
    process.chdir(targetDir);

    // Install dependencies
    spinner.text = 'Installing dependencies...';
    await execa('npm', ['run', 'install:all']);

    // Package
    spinner.text = 'Packaging VSCode extension...';
    await execa('npx', ['vsce', 'package']);

    // Search for the packaged VSIX file
    const files = await fs.readdir(targetDir);
    const vsixFile = files.find(file => file.endsWith('.vsix'));

    if (!vsixFile) {
      throw new Error('VSIX file not found');
    }

    const vsixPath = path.join(targetDir, vsixFile);

    // Return to original directory
    process.chdir(currentDir);

    spinner.succeed('Dependencies installation and packaging completed');

    return vsixPath;
  } catch (error) {
    spinner.fail('Failed to install or package');
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Display success message
 * @param vsixPath - Path to the generated VSIX file
 */
function showSuccessMessage(vsixPath: string): void {
  console.log();
  console.log(`🎉  ${chalk.green('Successfully created!')} ${chalk.cyan(vsixPath)}`);
  console.log();
}

/**
 * Display error message
 * @param message - Error message
 */
function showErrorMessage(message: string): void {
  console.log();
  console.error(`🚫  ${chalk.red('Error:')} ${message}`);
  console.log();
  console.log('If the issue persists, please report it.');
  console.log();
  process.exit(1);
}

/**
 * Main process
 */
export async function main(): Promise<void> {
  try {
    const program = new Command();

    program
      .name('create-cline')
      .description('Create a Cline project with the specified name')
      .version('0.1.0')
      .argument('[project-name]', 'Project name')
      .option('--verbose', 'Output detailed logs')
      .action(async (projectName, options) => {
        if (!projectName) {
          console.error(chalk.red('Error: Please specify a project name'));
          program.help();
          return;
        }

        const targetDir = path.resolve(process.cwd(), projectName);

        const exists = await checkDirectoryExists(targetDir);
        if (exists) {
          showErrorMessage(`Directory '${projectName}' already exists. Please specify a different name or delete the existing directory.`);
          return;
        }

        try {
          // TODO roo code support
          await cloneRepository("cline", targetDir);

          await processTemplateProject(targetDir, projectName);

          const vsixPath = await installAndPackage(targetDir, projectName);

          showSuccessMessage(vsixPath);
        } catch (error) {
          if (await checkDirectoryExists(targetDir)) {
            try {
              await fs.remove(targetDir);
            } catch (cleanupError) {
              console.error(chalk.yellow('Warning: Failed to clean up. Please delete the directory manually:'), targetDir);
            }
          }

          showErrorMessage(error instanceof Error ? error.message : String(error));
        }
      });

    await program.parseAsync(process.argv);
  } catch (error) {
    showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}

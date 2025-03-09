import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Recursively search for files under the specified path
 * @param dir - Starting directory for search
 * @param ignorePatterns - Array of patterns to ignore
 * @returns Array of file paths
 */
export async function getAllFiles(dir: string, ignorePatterns: string[] = []): Promise<string[]> {
  const defaultIgnore = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.DS_Store'
  ];

  const patterns = [...defaultIgnore, ...ignorePatterns];

  let results: string[] = [];
  const items = await fs.readdir(dir);

  for (const item of items) {
    if (patterns.some(pattern => item.includes(pattern))) {
      continue;
    }

    const itemPath = path.join(dir, item);
    const stat = await fs.stat(itemPath);

    if (stat.isDirectory()) {
      const subResults = await getAllFiles(itemPath, patterns);
      results = [...results, ...subResults];
    } else {
      results.push(itemPath);
    }
  }

  return results;
}

/**
 * Replace strings in a file
 * @param filePath - Target file path
 * @param projectName - New project name
 */
export async function replaceInFile(filePath: string, projectName: string): Promise<void> {
  try {
    let content = await fs.readFile(filePath, 'utf8');

    // Special processing for TypeScript files or files that may contain identifiers
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.json')) {
      const projectNameSafe = projectName.replace(/-/g, '');
      const projectNameCapitalized = projectName
        .split("-")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');

      // Fix variable name mismatches (e.g.: const clineignorePattern = ...  other(testapp4ignorePattern))
      content = content.replace(/const\s+cline([a-zA-Z0-9]+)\s*=/g, function (match: string, suffix: string): string {
        return `const ${projectNameSafe}${suffix} =`;
      });

      // Convert within string literals (e.g.: "clineignore_error" -> "testapp2ignore_error")
      content = content.replace(/"([^"]*?)cline([^"]*?)"/g, function (match: string, prefix: string, suffix: string): string {
        return `"${prefix}${projectNameSafe}${suffix}"`;
      });

      // Convert within string literals (e.g.: 'clineignore_error' -> 'testapp2ignore_error')
      content = content.replace(/'([^']*?)cline([^']*?)'/g, function (match: string, prefix: string, suffix: string): string {
        return `'${prefix}${projectNameSafe}${suffix}'`;
      });

      // Convert .clineignore file references
      content = content.replace(/\.clineignore/g, `.${projectNameSafe}ignore`);

      // Convert method declarations (e.g.: private async saveClineMessages -> private async saveTestapp3Messages)
      content = content.replace(/(\s+)([a-z]+)(\s+async\s+)([a-z]+)(Cline)([A-Za-z0-9]+)(\()/g, function (match: string, space: string, modifier: string, asyncPart: string, prefix: string, cline: string, suffix: string, paren: string): string {
        return `${space}${modifier}${asyncPart}${prefix}${projectNameCapitalized}${suffix}${paren}`;
      });

      // Convert method calls (e.g.: this.saveClineMessages -> this.saveTestapp3Messages)
      content = content.replace(/([\.a-zA-Z0-9_]+\.)([a-z]+)(Cline)([A-Za-z0-9]+)/g, function (match: string, obj: string, prefix: string, cline: string, suffix: string): string {
        return `${obj}${prefix}${projectNameCapitalized}${suffix}`;
      });

      // Convert global variables and patterns (e.g.: clineIgnorePattern -> testapp4IgnorePattern)
      content = content.replace(/\b([a-z]+)(Cline)([A-Za-z0-9_]+)\b/g, function (match: string, prefix: string, cline: string, suffix: string): string {
        return `${prefix}${projectNameCapitalized}${suffix}`;
      });

      // Convert lowercase (cline -> myapp)
      content = content.replace(/\bcline\b/g, projectNameSafe);

      // Convert uppercase (Cline -> Myapp)
      content = content.replace(/\bCline\b/g, projectNameCapitalized);

      // Convert claude-dev -> <project-name>
      content = content.replace(/claude-dev/g, projectName);

      // Convert saoudrizwan -> <project-name>
      content = content.replace(/saoudrizwan/g, projectName);

      // Improve import path conversion
      // Convert paths containing filenames (e.g.: './cline/file', './core/cline/file', './core/ignore/ClineController')
      content = content.replace(/(['"])([^'"]*?)[Cc]line([^'"]*?)(['"])/g, function (match: string, quote1: string, prefix: string, suffix: string, quote2: string): string {
        // Handle case properly
        if (match.includes('Cline')) {
          const projectCap = projectName
            .split("-")
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
          return match.replace(/Cline/g, projectCap);
        } else {
          return match.replace(/cline/g, projectName.replace(/-/g, ''));
        }
      });

      // Special replacements for variable names, class names, function names, etc.
      // Handle patterns like import { ClineIgnoreController } from ...
      content = content.replace(/\b([Cc]line)([A-Z][a-zA-Z0-9]*)\b/g, function (match: string, prefix: string, suffix: string): string {
        if (prefix === 'Cline') {
          const projectCap = projectName
            .split("-")
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
          return projectCap + suffix;
        } else {
          return projectName.replace(/-/g, '') + suffix;
        }
      });

      // Enhanced import statement processing
      content = content.replace(/import\s+\{([^}]*)\}\s+from\s+(['"])([^'"]*?)(['"])/g, function (match: string, imports: string, q1: string, filePath: string, q2: string): string {
        // Process imports
        const processedImports = imports.replace(/\b([Cc]line)([A-Z][a-zA-Z0-9]*)\b/g, function (match: string, prefix: string, suffix: string): string {
          if (prefix === 'Cline') {
            const projectCap = projectName
              .split("-")
              .map(part => part.charAt(0).toUpperCase() + part.slice(1))
              .join('');
            return projectCap + suffix;
          } else {
            return projectName.replace(/-/g, '') + suffix;
          }
        });

        // Process path
        let processedPath = filePath;
        if (filePath.includes('cline') || filePath.includes('Cline')) {
          processedPath = filePath.replace(/[Cc]line/g, function (match: string): string {
            if (match === 'Cline') {
              return projectName
                .split("-")
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join('');
            } else {
              return projectName.replace(/-/g, '');
            }
          });
        }

        return `import {${processedImports}} from ${q1}${processedPath}${q2}`;
      });
    } else {
      // Regular replacements for other files
      content = content.replace(/cline/gi, function (match) {
        if (match === 'CLINE') return projectName.toUpperCase();
        if (match === 'Cline') return projectName
          .split("-")
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
        if (match === 'cline') return projectName.replace(/-/g, '');
        return match; // Other cases remain unchanged
      });
    }

    await fs.writeFile(filePath, content, 'utf8');
  } catch (error) {
    console.error(chalk.red(`Error occurred while processing file ${filePath}:`), error);
    throw error;
  }
}

/**
 * Convert a filename
 * @param sourcePath - Original file path
 * @param projectName - New project name
 * @returns Converted file path
 */
export async function renameFile(sourcePath: string, projectName: string): Promise<string> {
  const dir = path.dirname(sourcePath);
  const fileName = path.basename(sourcePath);
  const projectNameCapitalized = projectName
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  const projectNameSafe = projectName.replace(/-/g, '');

  // Convert filenames
  let newFileName = fileName;
  newFileName = newFileName.replace(/[Cc]line/g, function (match) {
    if (match === 'Cline') return projectNameCapitalized;
    if (match === 'cline') return projectNameSafe;
    return match;
  });

  if (newFileName !== fileName) {
    const targetPath = path.join(dir, newFileName);
    await fs.rename(sourcePath, targetPath);
    return targetPath;
  }

  return sourcePath;
}

/**
 * Convert directory names
 * @param targetDir - Target directory root
 * @param projectName - New project name
 */
export async function renameDirectories(targetDir: string, projectName: string): Promise<void> {
  const projectNameSafe = projectName.replace(/-/g, '');
  const projectNameCapitalized = projectName
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  // Sort directories by depth (deepest first) to process them
  const directories: string[] = [];
  const processDir = async (dir: string) => {
    const items = await fs.readdir(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);
      if (stat.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(item)) {
        directories.push(itemPath);
        await processDir(itemPath);
      }
    }
  };

  await processDir(targetDir);
  directories.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);

  // Convert directory names
  for (const dirPath of directories) {
    const parentDir = path.dirname(dirPath);
    const dirName = path.basename(dirPath);

    const newDirName = dirName.replace(/[Cc]line/g, function (match) {
      if (match === 'Cline') return projectNameCapitalized;
      if (match === 'cline') return projectNameSafe;
      return match;
    });

    if (newDirName !== dirName) {
      const newPath = path.join(parentDir, newDirName);
      await fs.rename(dirPath, newPath);
    }
  }
}

/**
 * Clone and customize the template project name
 * @param targetDir - Clone destination directory
 * @param projectName - New project name
 */
export async function processTemplateProject(targetDir: string, projectName: string): Promise<void> {
  try {
    console.log(chalk.blue('Starting file processing...'));

    // Replace file contents
    const files = await getAllFiles(targetDir);
    for (const file of files) {
      await replaceInFile(file, projectName);
    }

    // Convert filenames (returns new file paths)
    const newFiles = [];
    for (const file of files) {
      const newFilePath = await renameFile(file, projectName);
      newFiles.push(newFilePath);
    }

    // Convert directory names
    await renameDirectories(targetDir, projectName);

    console.log(chalk.green('All files processed successfully.'));
  } catch (error) {
    console.error(chalk.red('An error occurred while processing the project:'), error);
    throw error;
  }
}

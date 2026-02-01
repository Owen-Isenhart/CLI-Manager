import { execSync } from 'child_process';
import path from 'path';
import { GitError } from '../errors/CLISyntaxErrors';
import { System } from './System';

////////////////////////////////////////

export type GitConfig = {
  remoteUrl: string;
  remoteName?: string;
  branchName?: string;
};

const GIT_CONFIG_FILE = '.cli-manager-git.json';

////////////////////////////////////////

/**
 * Handles Git operations for task synchronization
 */
export class Git {
  private storagePath: string;
  private config?: GitConfig;
  private isInitialized: boolean = false;

  ////////////////////

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    this.loadConfig();
  }

  ////////////////////

  private loadConfig = (): void => {
    const configPath = this.getGitConfigPath();
    if (System.doesFileExists(configPath)) {
      try {
        this.config = System.readJSONFile(configPath) as GitConfig;
        this.isInitialized = true;
      } catch (error) {
        this.isInitialized = false;
        throw new GitError(
          `Failed to load Git configuration: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  private saveConfig = (): void => {
    if (!this.config) throw new Error('No Git configuration to save');
    System.writeJSONFile(this.getGitConfigPath(), this.config as any);
  };

  private getGitConfigPath = (): string => {
    const storageDir = path.dirname(System.getAbsolutePath(this.storagePath));
    return path.join(storageDir, GIT_CONFIG_FILE);
  };

  private getRepositoryPath = (): string => path.dirname(System.getAbsolutePath(this.storagePath));

  ////////////////////

  /**
   * Initialize Git repository with remote URL
   */
  public init = async (
    remoteUrl: string,
    remoteName: string = 'origin',
    branchName: string = 'main',
  ): Promise<void> => {
    try {
      const repoPath = this.getRepositoryPath();

      // Check if git is already initialized
      const gitDir = path.join(repoPath, '.git');
      if (!System.doesFileExists(gitDir)) {
        // Initialize git repository
        this.executeGitCommand('init', repoPath);
        this.executeGitCommand(`config user.email "cli-manager@local"`, repoPath);
        this.executeGitCommand(`config user.name "CLI Manager"`, repoPath);
      }

      // Add remote if it doesn't exist or update it
      try {
        this.executeGitCommand(`remote get-url ${remoteName}`, repoPath);
        // If it exists, remove and re-add
        this.executeGitCommand(`remote remove ${remoteName}`, repoPath);
      } catch {
        // Remote doesn't exist, which is fine
      }

      this.executeGitCommand(`remote add ${remoteName} ${remoteUrl}`, repoPath);

      // Set up tracking branch if it's the first time
      try {
        this.executeGitCommand(`rev-parse --verify refs/heads/${branchName}`, repoPath);
      } catch {
        // Branch doesn't exist yet, create it
        this.executeGitCommand(`checkout -b ${branchName}`, repoPath);
      }

      // Save configuration
      this.config = {
        remoteUrl,
        remoteName,
        branchName,
      };

      this.saveConfig();
      this.isInitialized = true;
    } catch (error) {
      throw new GitError(`Failed to initialize Git: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  /**
   * Commit changes with auto-generated or custom message
   */
  public commit = (message?: string): void => {
    if (!this.isInitialized || !this.config) {
      throw new GitError('Git is not initialized. Run "task git init" first.');
    }

    try {
      const repoPath = this.getRepositoryPath();
      // Stage the storage file
      this.executeGitCommand(`add "${this.storagePath}"`, repoPath);

      // Check if there are changes to commit
      try {
        this.executeGitCommand(`diff-index --quiet HEAD --`, repoPath);
        // No changes
        return;
      } catch {
        // There are changes, proceed with commit
      }

      const commitMessage = message || `Task update at ${new Date().toISOString()}`;
      this.executeGitCommand(`commit -m "${commitMessage}"`, repoPath);
    } catch (error) {
      // Silently fail for commit if there are no changes or other non-critical issues
      if (error instanceof Error && !error.message.includes('nothing to commit')) {
        console.error(`Git commit warning: ${error.message}`);
      }
    }
  };

  /**
   * Push changes to remote repository
   */
  public push = (): void => {
    if (!this.isInitialized || !this.config) {
      throw new GitError('Git is not initialized. Run "task git init" first.');
    }

    try {
      const repoPath = this.getRepositoryPath();
      const { remoteName, branchName } = this.config;

      this.executeGitCommand(`push -u ${remoteName} ${branchName}`, repoPath);
    } catch (error) {
      throw new GitError(`Failed to push to remote: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  /**
   * Pull changes from remote repository
   */
  public pull = (): void => {
    if (!this.isInitialized || !this.config) {
      throw new GitError('Git is not initialized. Run "task git init" first.');
    }

    try {
      const repoPath = this.getRepositoryPath();
      const { remoteName, branchName } = this.config;

      this.executeGitCommand(`pull ${remoteName} ${branchName}`, repoPath);
    } catch (error) {
      throw new GitError(`Failed to pull from remote: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  /**
   * Commit and push changes together
   */
  public commitAndPush = (message?: string): void => {
    this.commit(message);
    this.push();
  };

  /**
   * Get Git status
   */
  public getStatus = (): string => {
    if (!this.isInitialized) {
      return 'Git is not initialized';
    }

    try {
      const repoPath = this.getRepositoryPath();
      return this.executeGitCommand('status --short', repoPath);
    } catch (error) {
      return `Error getting status: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  /**
   * Check if Git is initialized
   */
  public isGitInitialized = (): boolean => this.isInitialized;

  /**
   * Get Git configuration
   */
  public getConfig = (): GitConfig | undefined => this.config;

  ////////////////////

  private executeGitCommand = (command: string, cwd: string): string => {
    try {
      const result = execSync(`git ${command}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return result.trim();
    } catch (error) {
      throw error;
    }
  };
}

////////////////////////////////////////

/**
 * Factory for creating Git instances
 */
export const GitFactory = {
  create: (storagePath: string): Git => new Git(storagePath),
};

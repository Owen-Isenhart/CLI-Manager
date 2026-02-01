# Git Synchronization Setup Guide

## Overview

The CLI Task Manager now supports Git integration for synchronizing your tasks across multiple devices using a remote Git repository (like GitHub, GitLab, or any Git server).

## How It Works

1. **Initialization**: Set up a Git repository with a remote URL using `task git init`
2. **Auto-sync**: Every task modification (add, edit, delete, etc.) automatically commits and pushes to your remote
3. **Cross-device sync**: Pull changes on other devices with `task git pull`

## Setup Instructions

### Step 1: Create a Remote Repository

Create a new Git repository on your preferred service:
- **GitHub**: https://github.com/new
- **GitLab**: https://gitlab.com/projects/new
- **Gitea**: Your self-hosted Gitea instance
- **Any Git server** with SSH or HTTPS access

### Step 2: Initialize Git for Your Tasks

```bash
task git init <remote-url> [remote-name] [branch-name]
```

**Examples:**

```bash
# Using GitHub
task git init https://github.com/username/my-tasks.git origin main

# Using GitLab with SSH
task git init git@gitlab.com:username/my-tasks.git origin main

# Using custom remote name and branch
task git init https://your-git-server.com/repo.git upstream develop
```

### Step 3: Start Using Your Tasks

Once initialized, all task modifications automatically sync:

```bash
# These will all auto-commit and push
task a "My new task"
task e 1 "Updated task name"
task c 2
task d 3
```

## Available Commands

### Initialize Git

```bash
task git init <remote-url> [remote-name] [branch-name]
```

- `<remote-url>`: URL of your remote repository
- `[remote-name]`: Remote name (default: `origin`)
- `[branch-name]`: Branch name (default: `main`)

### Push Changes

```bash
task git push
```

Manually commit and push any pending changes.

### Pull Changes

```bash
task git pull
```

Pull the latest task changes from the remote repository. Useful when working from another device.

### Check Status

```bash
task git status
```

View the Git status of your task repository.

### View Configuration

```bash
task git
```

Display current Git configuration.

## Multi-Device Workflow

### Device A (Initial Setup)

```bash
# Initialize Git
task git init https://github.com/user/tasks.git

# Create some tasks
task a "Buy groceries"
task a "Finish project"

# Tasks are automatically synced
```

### Device B (Sync Tasks)

```bash
# Pull the tasks from Device A
task git pull

# You now have the same tasks
task 1
task 2

# Make changes - they'll sync back
task e 1 "Buy groceries and cook"

# Changes are automatically pushed
```

### Back on Device A

```bash
# Pull the latest changes from Device B
task git pull

# You now see Device B's changes
task 1
```

## Configuration File

Git configuration is stored in `.cli-manager-git.json` in your storage directory:

```json
{
  "remoteUrl": "https://github.com/user/tasks.git",
  "remoteName": "origin",
  "branchName": "main"
}
```

Don't manually edit this file - use the `task git init` command instead.

## Important Notes

1. **Initial Commit**: The first `task git init` will set up the repository but won't automatically push existing tasks. You may need to do the initial push manually.

2. **Merge Conflicts**: If working on multiple devices without pulling/pushing between changes, you might encounter merge conflicts. Always pull before making changes and push after.

3. **Private Repositories**: For private repositories, ensure you have proper authentication set up (SSH keys or credentials).

4. **Network Issues**: If the remote is unreachable, task changes are still saved locally. Git operations will retry on the next change.

5. **Large Histories**: If your repository gets very large, consider archiving old tasks periodically.

## Disabling Auto-Sync

Auto-sync is only active if Git is initialized. To temporarily disable sync without losing the configuration:

Delete or rename `.cli-manager-git.json` in your storage directory.

To re-enable, run `task git init` again with your remote URL.

## Troubleshooting

### Git is not initialized

Error: `Git is not initialized. Run "task git init <remote-url>" first.`

**Solution**: Run `task git init` with your remote URL.

### Authentication failed

Error: `Failed to push to remote: Authentication failed`

**Solution**: 
- For HTTPS: Check your credentials
- For SSH: Ensure your SSH keys are properly configured
- Run `git config --global user.email` and `git config --global user.name` if needed

### Merge conflicts

Error: `Failed to pull from remote: Merge conflict`

**Solution**: 
- The .cli-manager-git.json file shows which files are in conflict
- Manually resolve using `git` commands in your storage directory
- Or delete your local tasks.json and pull fresh from remote

### Large repository size

**Solution**: 
- Use `git gc` to garbage collect old commits
- Consider splitting into multiple task files using `--storage` flag

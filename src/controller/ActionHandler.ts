import { PrinterFactory } from '../core/Printer';
import { StorageFactory } from '../core/Storage';
import { ITask, Task } from '../core/Task';
import { Prompt } from '../core/Prompt';
import { GitFactory } from '../core/Git';
import {
  EditingSyntaxError,
  CheckingTaskSyntaxError,
  IncrementingTaskSyntaxError,
  DeletingTaskSyntaxError,
  MovingTaskSyntaxError,
  ExtractSyntaxError,
  StorageError,
  GitError,
} from '../errors/CLISyntaxErrors';
import { Action, isTask, isText } from './CliArgHandler';
import { idsController } from './IDSController';
import { MainController } from './MainController';

export class ActionHandler {
  mainController: MainController;

  //////////

  constructor(mainController: MainController) {
    this.mainController = mainController;
  }

  //////////

  handleAction = async (): Promise<void> => {
    const { argHandler, storage, config, printer, finalStorageLocation } = this.mainController;
    const { words, flags, infos } = argHandler;
    const { dataAttributes, isRecursive } = flags;
    const { state, description, priority, group, dueDate, template } = dataAttributes;
    const [firstArg, secondArg, thirdArg] = words;

    if (!storage) throw new StorageError(`Can't find the task storage file '${finalStorageLocation}'`);

    switch (firstArg.value) {
      case Action.ADD_TASK: {
        let id: number | Promise<number>;

        const shouldPrompt = words.length === 1 || (words.length === 2 && isTask(secondArg));

        if (shouldPrompt) {
          id = await Prompt.addTask(storage, secondArg?.value as number);
          printer.setView('specific', id);
        } else {
          let taskData: ITask = {
            name: argHandler.getFirstText(),
            state: state || storage.meta.states[0].name,
            description,
            priority,
            group,

            dueDate,
          };

          if (template) {
            const templateData = storage.meta.templates?.find((t) => t.name === template);
            if (templateData) {
              taskData.subtasks = templateData.subtasks;
            }
          }

          const task: Task = new Task(taskData, storage.meta);

          let subTaskOf = undefined;
          if (isTask(secondArg)) {
            const id = secondArg.value as number;
            subTaskOf = id;
            printer.setView('specific', id);
          } else printer.setView('full');

          id = storage.addTask(task, subTaskOf);
        }

        printer.addFeedback(`Task n°${id} added`).print();
        break;
      }

      ////////////////////

      case Action.EDIT: {
        if (!isTask(secondArg)) {
          throw new EditingSyntaxError(
            "Your second arguments should be one or more tasks id join by ',' or a board name",
          );
        }

        const shouldPrompt = words.length === 2 && isTask(secondArg) && !infos.isThereDataAttribute;

        if (shouldPrompt) {
          const id = secondArg?.value as number;
          await Prompt.editTask(storage, id);

          printer.addFeedback(`Task '${id}' edited`).setView('specific', id);
        } else if (isTask(secondArg)) {
          const name = argHandler.getFirstText();

          const newAttributes: ITask = {
            name,
            state,
            description,
            priority,
            group,
            dueDate,
          };

          if (!name) delete newAttributes.name;
          if (!state) delete newAttributes.state;
          if (!description) delete newAttributes.description;
          if (!priority) delete newAttributes.priority;
          if (!group) delete newAttributes.group;
          if (!dueDate) delete newAttributes.dueDate;

          const { ids, textID, textTask } = idsController(storage, secondArg.value as number | number[]);

          storage.editTask(ids, newAttributes, isRecursive);

          printer.addFeedback(`${textTask} '${textID}' edited`).setView('specific', ids);
        }

        printer.print();
        break;
      }

      ////////////////////

      case Action.CHECK: {
        if (!isTask(secondArg)) {
          throw new CheckingTaskSyntaxError("Your second arguments should be a number or numbers join by ','");
        }

        const { ids, textID, textTask } = idsController(storage, secondArg.value as number | number[]);

        const lastState = storage.meta.states[storage.meta.states.length - 1].name;
        storage.editTask(ids, { state: lastState }, isRecursive);

        printer.addFeedback(`${textTask} '${textID}' checked`).setView('specific', ids).print();
        break;
      }

      ////////////////////

      case Action.INCREMENT: {
        if (!isTask(secondArg)) {
          throw new IncrementingTaskSyntaxError(`Second arg '${secondArg.value}' should be one or more task`);
        }

        const { ids, textID, textTask } = idsController(storage, secondArg.value as number | number[]);

        storage.incrementTask(ids, isRecursive);

        printer.addFeedback(`${textTask} '${textID}' incremented`).setView('specific', ids).print();
        break;
      }

      ////////////////////

      case Action.DELETE: {
        if (!isTask(secondArg)) {
          throw new DeletingTaskSyntaxError(`Second arg '${secondArg.value}' should be one or more task`);
        }

        const { ids, textID, textTask } = idsController(storage, secondArg.value as number | number[]);

        if (Array.isArray(ids) && ids.length > 1) {
          printer.setView('full');
        } else {
          let parent: Task = undefined;
          storage.tasks.retrieveTask(ids[0], ({ parentTask }) => (parent = parentTask));

          printer.setView(parent ? 'specific' : 'full', parent ? parent.id : undefined);
        }

        storage.deleteTask(ids);

        printer.addFeedback(`${textTask} '${textID}' deleted`).print();

        break;
      }

      ////////////////////

      case Action.MOVE: {
        if (!isTask(secondArg)) {
          throw new MovingTaskSyntaxError(`Second arg '${secondArg.value}' should be one or more task id`);
        }

        if (!isTask(thirdArg)) {
          throw new MovingTaskSyntaxError(`Third arg '${thirdArg.value}' should be one task id`);
        }

        if (Array.isArray(thirdArg.value)) {
          throw new MovingTaskSyntaxError(`Please provide only one destination task id`);
        }

        const { ids, textID, textTask } = idsController(storage, secondArg.value as number | number[]);

        const destTaskID = thirdArg.value as number;

        storage.moveTask(ids, destTaskID);
        printer.setView('specific', destTaskID);
        printer.addFeedback(`${textTask} '${textID}' moved to task n°${destTaskID}`).print();

        break;
      }

      ////////////////////

      case Action.EXTRACT: {
        if (!isTask(secondArg)) {
          throw new ExtractSyntaxError(`Second arg '${secondArg.value}' should be one or more task id`);
        }

        if (!isText(thirdArg)) {
          throw new ExtractSyntaxError(`Thrid arg '${thirdArg.value}' should be text`);
        }

        const { tasks, textID, textTask } = idsController(storage, secondArg.value as number | number[]);
        const destination = thirdArg.value as string;

        const newStorage = StorageFactory.extract(destination, storage, tasks);
        const newPrinter = PrinterFactory.create(argHandler, config, newStorage);

        newPrinter.setView('full');
        newPrinter.addFeedback(`${textTask} '${textID}' extracted to ${destination}`).print();

        break;
      }

      ////////////////////

      case Action.GROUP: {
        const subAction = secondArg?.value as string;
        const groupName = thirdArg?.value as string;
        const color = words[3]?.value as string;

        if (subAction === 'add') {
          if (!groupName || !color) {
            printer.addFeedback('Usage: task g add <name> <color>').print();
            return;
          }
          const existing = storage.meta.groups.find((g) => g.name === groupName);
          if (existing) {
            existing.hexColor = color;
            printer.addFeedback(`Group '${groupName}' updated with color ${color}`);
          } else {
            storage.meta.groups.push({ name: groupName, hexColor: color });
            printer.addFeedback(`Group '${groupName}' added with color ${color}`);
          }
          storage.save();
        } else if (subAction === 'remove') {
          if (!groupName) {
            printer.addFeedback('Usage: task g remove <name>').print();
            return;
          }
          storage.meta.groups = storage.meta.groups.filter((g) => g.name !== groupName);
          storage.save();
          printer.addFeedback(`Group '${groupName}' removed`);
        } else {
          printer
            .addFeedback('Groups management:')
            .addFeedback(storage.meta.groups.map((g) => `- ${g.name} (${g.hexColor})`));
        }
        printer.print();
        break;
      }

      case Action.TEMPLATE: {
        const subAction = secondArg?.value as string;
        const templateName = thirdArg?.value as string;
        const subtasks = dataAttributes?.subtasks;

        if (subAction === 'add') {
          if (!templateName) {
            printer.addFeedback('Usage: task t add <name> [-subs "sub1,sub2"]').print();
            return;
          }

          const templateSubtasks: ITask[] = subtasks ? subtasks.map((name: string) => ({ name })) : [];

          const existing = storage.meta.templates?.find((t) => t.name === templateName);
          if (existing) {
            existing.subtasks = templateSubtasks;
            printer.addFeedback(`Template '${templateName}' updated with ${templateSubtasks.length} subtasks`);
          } else {
            storage.meta.templates?.push({ name: templateName, subtasks: templateSubtasks });
            printer.addFeedback(`Template '${templateName}' created with ${templateSubtasks.length} subtasks`);
          }
          storage.save();
        } else if (subAction === 'remove') {
          if (!templateName) {
            printer.addFeedback('Usage: task t remove <name>').print();
            return;
          }
          const initialLength = storage.meta.templates?.length || 0;
          storage.meta.templates = storage.meta.templates?.filter((t) => t.name !== templateName);
          const finalLength = storage.meta.templates?.length || 0;
          if (initialLength === finalLength) {
            printer.addFeedback(`Template '${templateName}' not found`).print();
            return;
          }
          storage.save();
          printer.addFeedback(`Template '${templateName}' removed`);
        } else {
          printer
            .addFeedback('Templates:')
            .addFeedback(
              (storage.meta.templates || []).length === 0
                ? ['(no templates defined)']
                : (storage.meta.templates || []).map((t) => `- ${t.name}`),
            );
        }
        printer.print();
        break;
      }

      ////////////////////

      case Action.GIT_INIT: {
        const subAction = secondArg?.value as string;

        if (subAction === 'init') {
          // Get remote URL and optional parameters
          const remoteUrl = thirdArg?.value as string;

          if (!remoteUrl) {
            printer
              .addFeedback('Usage: task git init <remote-url> [remote-name] [branch-name]')
              .addFeedback('Example: task git init https://github.com/user/repo.git origin main')
              .print();
            return;
          }

          const remoteName = words[3]?.value as string | undefined;
          const branchName = words[4]?.value as string | undefined;

          const git = GitFactory.create(finalStorageLocation);

          try {
            await git.init(remoteUrl, remoteName || 'origin', branchName || 'main');
            printer.addFeedback(`Git repository initialized with remote: ${remoteUrl}`).print();
          } catch (error) {
            throw new GitError(`Failed to initialize Git: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else if (subAction === 'push') {
          const git = GitFactory.create(finalStorageLocation);

          if (!git.isGitInitialized()) {
            throw new GitError('Git is not initialized. Run "task git init <remote-url>" first.');
          }

          try {
            git.commitAndPush();
            printer.addFeedback('Changes committed and pushed to remote repository').print();
          } catch (error) {
            throw new GitError(`Failed to push: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else if (subAction === 'pull') {
          const git = GitFactory.create(finalStorageLocation);

          if (!git.isGitInitialized()) {
            throw new GitError('Git is not initialized. Run "task git init <remote-url>" first.');
          }

          try {
            git.pull();
            printer.addFeedback('Changes pulled from remote repository').print();
          } catch (error) {
            throw new GitError(`Failed to pull: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else if (subAction === 'status') {
          const git = GitFactory.create(finalStorageLocation);

          if (!git.isGitInitialized()) {
            printer.addFeedback('Git is not initialized. Run "task git init <remote-url>" first.').print();
            return;
          }

          const status = git.getStatus();
          printer
            .addFeedback('Git Status:')
            .addFeedback(status || '(no changes)')
            .print();
        } else {
          const git = GitFactory.create(finalStorageLocation);
          if (git.isGitInitialized()) {
            const config = git.getConfig();
            printer
              .addFeedback('Git is initialized with:')
              .addFeedback(`Remote: ${config?.remoteUrl}`)
              .addFeedback(`Remote Name: ${config?.remoteName}`)
              .addFeedback(`Branch: ${config?.branchName}`)
              .addFeedback('')
              .addFeedback('Available commands:')
              .addFeedback('  task git init <url> [remote-name] [branch-name] - Initialize Git')
              .addFeedback('  task git push - Commit and push changes')
              .addFeedback('  task git pull - Pull changes from remote')
              .addFeedback('  task git status - View Git status');
          } else {
            printer
              .addFeedback('Git is not initialized. Initialize Git with:')
              .addFeedback('  task git init <remote-url> [remote-name] [branch-name]')
              .addFeedback('')
              .addFeedback('Example:')
              .addFeedback('  task git init https://github.com/user/repo.git origin main');
          }
          printer.print();
        }

        break;
      }
    }
  };
}

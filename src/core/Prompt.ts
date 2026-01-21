import prompts from 'prompts';
import chalk from 'chalk';

import { Storage } from './Storage';
import { ITask, Task } from './Task';

////////////////////////////////////////

export class Prompt {
  static addTask = async (storage: Storage, subTaskOfId?: number): Promise<number> => {
    try {
      const { name, state, description, group, dueDate, template } = await doPrompt(storage);

      let taskData: ITask = {
        name: name.trim(),
        state,
        description: description.trim(),
        group: group !== 'none' ? group : undefined,
        dueDate,
      };

      if (template && template !== 'none') {
        const templateData = storage.meta.templates?.find((t) => t.name === template);
        if (templateData) {
          taskData.subtasks = templateData.subtasks;
        }
      }

      const task: Task = new Task(taskData);

      const id = storage.addTask(task, subTaskOfId);

      return id;
    } catch (err) {
      console.warn('No task added', err);
    }
  };

  static editTask = async (storage: Storage, taskId: number): Promise<void> => {
    try {
      let beforeTask: Task;
      storage.tasks.retrieveTask(taskId, async ({ task }) => {
        beforeTask = task;
      });

      console.log(
        chalk.italic('Press tab to edit previously set text, start typing for a new value or use space to remove it\n'),
      );

      const { name, state, description, group, dueDate } = await doPrompt(storage, beforeTask);

      const afterTask: Task = new Task({
        name: name.trim(),
        state: state,
        description: description.trim(),
        group: group !== 'none' ? group : undefined,
        dueDate,
      });

      storage.editTask([taskId], afterTask);
    } catch (err) {
      console.warn('No task edited', err);
    }
  };
}

////////////////////////////////////////

const getStateChoices = (storage: Storage) => {
  return storage.meta.states.map(({ name }) => ({ title: name, value: name }));
};

const getGroupChoices = (storage: Storage) => {
  const groups = storage.meta.groups || [];
  return [{ title: 'None', value: 'none' }, ...groups.map(({ name }) => ({ title: name, value: name }))];
};

const getTemplateChoices = (storage: Storage) => {
  const templates = storage.meta.templates || [];
  return [{ title: 'None', value: 'none' }, ...templates.map(({ name }) => ({ title: name, value: name }))];
};

const doPrompt = async (storage: Storage, task?: Task): Promise<prompts.Answers<Partial<keyof Task>>> => {
  const availableStates = getStateChoices(storage);
  const availableGroups = getGroupChoices(storage);
  const availableTemplates = getTemplateChoices(storage);

  ////////

  const textQuestion: prompts.PromptObject<keyof Task> = {
    type: 'text',
    name: 'name',
    message: 'Task name',
  };

  const stateQuestion: prompts.PromptObject<keyof Task> = {
    type: 'select',
    name: 'state',
    message: 'State',
    choices: availableStates,
  };

  const groupQuestion: prompts.PromptObject<keyof Task> = {
    type: 'select',
    name: 'group',
    message: 'Group',
    choices: availableGroups,
  };

  const descriptionQuestion: prompts.PromptObject<keyof Task> = {
    type: 'text',
    name: 'description',
    message: 'Description',
  };

  const dueDateQuestion: prompts.PromptObject<keyof Task> = {
    type: 'text',
    name: 'dueDate',
    message: 'Due Date (DD/MM/YYYY)',
  };

  const templateQuestion: prompts.PromptObject<keyof Task> = {
    type: 'select',
    name: 'template',
    message: 'Template',
    choices: availableTemplates,
  };

  ////////

  if (task) {
    textQuestion.initial = task.name;

    const indexOfChosenState = availableStates.findIndex(({ value }) => value === task.state);
    stateQuestion.initial = indexOfChosenState;

    const indexOfChosenGroup = availableGroups.findIndex(({ value }) => value === task.group);
    groupQuestion.initial = indexOfChosenGroup >= 0 ? indexOfChosenGroup : 0;

    descriptionQuestion.initial = task.description;
    dueDateQuestion.initial = task.dueDate;
  }

  ////////

  const questions = [textQuestion, stateQuestion, groupQuestion, descriptionQuestion, dueDateQuestion];
  if (!task) {
    questions.push(templateQuestion);
  }

  return prompts(questions);
};

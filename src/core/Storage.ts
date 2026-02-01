import { FileAlreadyExistsError } from '../errors/FileErrors';
import { TaskNotFoundError } from '../errors/TaskErrors';
import { ITask, Task } from './Task';
import { GroupByType, Order, TaskList } from './TaskList';
import { System } from './System';
import { Git, GitFactory } from './Git';

////////////////////////////////////////

export const DEFAULT_STORAGE_FILE_NAME = 'tasks.json';
export const DEFAULT_STORAGE_DATAS: StorageFile = {
  meta: {
    states: [
      {
        name: 'todo',
        hexColor: '#ff8f00',
        icon: '☐',
      },
      {
        name: 'wip',
        hexColor: '#ab47bc',
        icon: '✹',
      },
      {
        name: 'done',
        hexColor: '#66bb6a',
        icon: '✔',
      },
    ],
    groups: [],
  },
  datas: [
    {
      name: 'Add more stuff',
      description: "Run 'task d 0' to delete me or 'task c 0' to check me",
      state: 'todo',
      id: 0,
    },
  ],
};

////////////////////////////////////////

export type Meta = {
  states: TaskState[];
  groups?: TaskGroup[];
  templates?: TaskTemplate[];
};

export type TaskState = {
  name: string;
  hexColor: string;
  icon: string;
};

export type TaskGroup = {
  name: string;
  hexColor: string;
};

export type TaskTemplate = {
  name: string;
  subtasks: ITask[];
};

export type StorageFile = {
  meta: Meta;
  datas: ITask[];
};

////////////////////////////////////////

/**
 * Expose and handle tasks datas and metadatas
 */
export class Storage {
  relativePath: string;

  tasks: TaskList;
  meta: Meta;
  private git?: Git;

  ////////////////////////////////////////

  constructor(relativePath: string) {
    this.relativePath = relativePath;

    const { meta, datas } = System.readJSONFile(this.relativePath) as StorageFile;
    this.tasks = new TaskList(datas, meta);
    this.meta = meta;
    if (!this.meta.groups) this.meta.groups = [];
    if (!this.meta.templates) this.meta.templates = [];

    // Initialize Git instance if available
    try {
      this.git = GitFactory.create(this.relativePath);
    } catch {
      // Git not available, continue without it
    }
  }

  ////////////////////////////////////////

  addTask = (task: Task, subTaskOf?: number) => {
    const id = this.tasks.addTask(task, subTaskOf);
    this.save();
    return id;
  };

  editTask = (tasksID: number[], newAttributes: ITask, isRecurive?: boolean) => {
    const id = this.tasks.editTask(tasksID, newAttributes, isRecurive);
    this.save();
    return id;
  };

  incrementTask = (tasksID: number[], isRecurive?: boolean) => {
    const id = this.tasks.incrementTask(tasksID, isRecurive);
    this.save();
    return id;
  };

  deleteTask = (tasksID: number[]) => {
    const id = this.tasks.deleteTask(tasksID);
    this.save();
    return id;
  };

  moveTask = (tasksID: number[], subTaskOf: number) => {
    const id = this.tasks.moveTask(tasksID, subTaskOf);
    this.save();
    return id;
  };

  group = (groupBy: GroupByType = 'state') => this.tasks.group(groupBy, this.meta);

  order = (order: Order) => order === 'desc' && this.tasks.reverse();

  get = (id: number): Task => {
    let toReturn: Task = undefined;

    this.tasks.retrieveTask(id, ({ task }) => (toReturn = task));

    if (toReturn === undefined) throw new TaskNotFoundError(id);

    return toReturn;
  };

  ////////////////////////////////////////

  save = () => {
    System.writeJSONFile(this.relativePath, { meta: this.meta, datas: this.tasks });

    // Auto-commit and push if Git is initialized
    if (this.git && this.git.isGitInitialized()) {
      try {
        this.git.commitAndPush(`Task update at ${new Date().toISOString()}`);
      } catch (error) {
        // Silently fail if Git commit/push fails - don't break task operations
        console.error(`Git auto-commit warning: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
}

////////////////////////////////////////

export const StorageFactory = {
  init: (relativePath: string): Storage => {
    if (System.doesFileExists(relativePath)) throw new FileAlreadyExistsError(relativePath);

    System.writeJSONFile(relativePath, DEFAULT_STORAGE_DATAS);

    return new Storage(relativePath);
  },

  extract: (newFilePath: string, originStorage: Storage, tasks: Task[]): Storage => {
    if (System.doesFileExists(newFilePath)) throw new FileAlreadyExistsError(newFilePath);

    const newFile: StorageFile = {
      meta: originStorage.meta,
      datas: tasks,
    };

    System.writeJSONFile(newFilePath, newFile);

    tasks.forEach((task) => originStorage.deleteTask([task.id]));

    return new Storage(newFilePath);
  },
};

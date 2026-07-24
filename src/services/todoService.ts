import { TodoItem } from '../types';

const INITIAL_TODOS: TodoItem[] = [
  { id: '1', label: 'Review quarterly travel budget', done: false, priority: 'high', sourceType: 'manual' },
  { id: '2', label: 'Confirm dinner reservation – Le Bernardin', done: true, priority: 'medium', sourceType: 'calendar' },
  { id: '3', label: "Reply to Sarah Kim's email", done: false, priority: 'high', sourceType: 'email' },
  { id: '4', label: 'Book hotel for NYC trip (Aug 4–6)', done: false, priority: 'medium', sourceType: 'manual' },
  { id: '5', label: 'Review itinerary for Thursday flight', done: true, priority: 'low', sourceType: 'manual' },
];

export class TodoService {
  private static todos: TodoItem[] = [...INITIAL_TODOS];

  /**
   * Get all tasks for current user
   */
  static getTodos(): TodoItem[] {
    return this.todos;
  }

  /**
   * Toggle task completion status
   */
  static toggleTodo(id: string): TodoItem[] {
    this.todos = this.todos.map(t => (t.id === id ? { ...t, done: !t.done } : t));
    return this.todos;
  }

  /**
   * Add a new ToDo item
   */
  static addTodo(label: string, priority: 'high' | 'medium' | 'low' = 'medium', sourceType: 'manual' | 'email' | 'calendar' = 'manual'): TodoItem {
    const newTodo: TodoItem = {
      id: `td_${Date.now()}`,
      label,
      done: false,
      priority,
      sourceType,
      createdAt: new Date().toISOString(),
    };
    this.todos.unshift(newTodo);
    return newTodo;
  }

  /**
   * Sync high priority email action item to todo list if not already present
   */
  static syncActionItemFromEmail(actionLabel: string, emailId: string): void {
    const exists = this.todos.some(t => t.label === actionLabel || t.sourceRefId === emailId);
    if (!exists && actionLabel) {
      this.addTodo(actionLabel, 'high', 'email');
    }
  }

  /**
   * Get completion statistics
   */
  static getProgressStats(): { completed: number; total: number; progressPct: number } {
    const total = this.todos.length;
    const completed = this.todos.filter(t => t.done).length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, progressPct };
  }
}

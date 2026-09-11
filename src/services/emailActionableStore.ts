import { EmailMessage } from '../types';

let actionableEmails: EmailMessage[] = [];

const listeners = new Set<() => void>();

export const EmailActionableStore = {
  getEmails(): EmailMessage[] {
    return actionableEmails;
  },

  setEmails(emails: EmailMessage[]): void {
    actionableEmails = emails;

    listeners.forEach(listener => {
      listener();
    });
  },

  clear(): void {
    actionableEmails = [];

    listeners.forEach(listener => {
      listener();
    });
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },
};

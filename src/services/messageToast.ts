import {
  MessageToastOptions,
  MessageToastRef,
} from '../components/MessageToast';

let toastRef: MessageToastRef | null = null;

export const setMessageToastRef = (ref: MessageToastRef | null) => {
  toastRef = ref;
};

const show = (
  message: string,
  options: Omit<MessageToastOptions, 'message'> = {},
) => {
  toastRef?.show({
    message,
    ...options,
  });
};

export const MessageToast = {
  show,

  success: (message: string, duration = 3000, title?: string) => {
    show(message, {
      type: 'success',
      duration,
      title,
    });
  },

  error: (message: string, duration = 3000, title?: string) => {
    show(message, {
      type: 'error',
      duration,
      title,
    });
  },

  validation: (message: string, duration = 3000, title?: string) => {
    show(message, {
      type: 'validation',
      duration,
      title,
    });
  },

  hide: () => {
    toastRef?.hide();
  },
};
